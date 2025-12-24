/**
 * Firebase Cloud Functions for Listo
 * 
 * W-9 OCR Processing:
 * - Automatically processes W-9 uploads for laborers
 * - Extracts text using Google Cloud Vision OCR
 * - Parses W-9 fields and updates laborer records
 * 
 * Document Translator (scanContract):
 * - Uses OCR.Space API for OCR (replacing Google Vision for this tool)
 * - Uses Google Cloud Translation API to translate to Spanish
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const { Storage } = require("@google-cloud/storage");
const { v4: uuidv4 } = require("uuid");
const { TranslationServiceClient } = require("@google-cloud/translate");

admin.initializeApp();

// Initialize Google Cloud clients
let visionClient;
let translateClient;
let storageClient;

// Lazy initialization with error handling
function getVisionClient() {
  if (!visionClient) {
    try {
      visionClient = new vision.ImageAnnotatorClient();
    } catch (error) {
      console.error("Failed to initialize Vision client:", error.message);
      throw new Error("VISION_CLIENT_INIT_FAILED");
    }
  }
  return visionClient;
}

function getTranslateClient() {
  if (!translateClient) {
    try {
      translateClient = new TranslationServiceClient();
    } catch (error) {
      console.error("Failed to initialize Translation client:", error.message);
      throw new Error("TRANSLATE_CLIENT_INIT_FAILED");
    }
  }
  return translateClient;
}

function getStorageClient() {
  if (!storageClient) {
    try {
      storageClient = new Storage();
    } catch (error) {
      console.error("Failed to initialize Storage client:", error.message);
      throw new Error("STORAGE_CLIENT_INIT_FAILED");
    }
  }
  return storageClient;
}

// Debug mode flag (set via environment variable)
const DEBUG_MODE = process.env.DEBUG_MODE === "true" || process.env.DEBUG_MODE === "1";
const ENVIRONMENT = process.env.GCLOUD_PROJECT ? "production" : "development";

// Helper: Generate request ID
function generateRequestId() {
  return uuidv4();
}

// Helper: Structured logging
function logError(requestId, operation, error, context = {}) {
  const logEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    operation,
    environment: ENVIRONMENT,
    error: {
      message: error?.message || String(error),
      code: error?.code || "UNKNOWN",
      status: error?.status || null,
    },
    context: DEBUG_MODE ? context : {}, // Only log context in debug mode
  };
  
  console.error(JSON.stringify(logEntry));
  return logEntry;
}

// Helper: Create error response
function createErrorResponse(requestId, errorCode, message, details = null) {
  return {
    ok: false,
    errorCode,
    message,
    requestId,
    ...(DEBUG_MODE && details ? { details } : {}),
  };
}

// Helper: Check environment variables
function checkEnvVars() {
  const missing = [];
  
  // Check for Google Cloud credentials
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_PROJECT) {
    // In Firebase Functions, credentials are usually auto-detected
    // But we should check if we can initialize clients
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Storage trigger: Process W-9 uploads for laborers
 * Triggered when a file is uploaded to: users/{uid}/laborers/{laborerId}/documents/w9/{fileName}
 */
exports.processW9Upload = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const bucket = object.bucket;
    const contentType = object.contentType || "";

    // Only process W-9 uploads for laborers
    const w9PathMatch = filePath.match(
      /^users\/([^\/]+)\/laborers\/([^\/]+)\/documents\/w9\/(.+)$/
    );

    if (!w9PathMatch) {
      console.log(`Skipping non-W9 file: ${filePath}`);
      return null;
    }

    const [, userId, laborerId, fileName] = w9PathMatch;

    console.log(`Processing W-9 upload: ${filePath}`);
    console.log(`User: ${userId}, Laborer: ${laborerId}`);

    // Validate file type
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!validTypes.includes(contentType)) {
      console.warn(`Invalid file type for W-9: ${contentType}`);
      await updateOcrStatus(userId, laborerId, "failed", {
        error: "Invalid file type. Please upload a PDF or image (JPG/PNG).",
      });
      return null;
    }

    try {
      // Set OCR status to processing
      await updateOcrStatus(userId, laborerId, "processing", null);

      // Download file from Storage
      const bucketObj = storage.bucket(bucket);
      const file = bucketObj.file(filePath);
      const [fileBuffer] = await file.download();

      // Perform OCR using Google Cloud Vision
      let fullText = "";
      
      if (contentType === "application/pdf") {
        // For PDFs, use Document Text Detection
        const [result] = await visionClient.documentTextDetection({
          image: { content: fileBuffer },
        });
        
        if (result.fullTextAnnotation) {
          fullText = result.fullTextAnnotation.text;
        } else {
          throw new Error("No text detected in PDF");
        }
      } else {
        // For images, use Document Text Detection (better for forms)
        const [result] = await visionClient.documentTextDetection({
          image: { content: fileBuffer },
        });
        
        if (result.fullTextAnnotation) {
          fullText = result.fullTextAnnotation.text;
        } else {
          // Fallback to regular text detection
          const [fallbackResult] = await visionClient.textDetection({
            image: { content: fileBuffer },
          });
          
          if (fallbackResult.textAnnotations && fallbackResult.textAnnotations.length > 0) {
            fullText = fallbackResult.textAnnotations[0].description || "";
          } else {
            throw new Error("No text detected in image");
          }
        }
      }

      if (!fullText || fullText.trim().length === 0) {
        throw new Error("No text extracted from W-9 document");
      }

      console.log(`Extracted text length: ${fullText.length} characters`);

      // Parse W-9 fields from extracted text
      const parsedFields = parseW9Text(fullText);

      // Update laborer document with extracted fields
      await updateLaborerWithW9Data(
        userId,
        laborerId,
        parsedFields,
        filePath,
        object.mediaLink || null
      );

      console.log(`Successfully processed W-9 for laborer ${laborerId}`);
      return null;
    } catch (error) {
      console.error(`Error processing W-9: ${error.message}`, error);
      await updateOcrStatus(userId, laborerId, "failed", {
        error: error.message || "Failed to process W-9 document",
      });
      return null;
    }
  });

/**
 * Parse W-9 text to extract key fields
 */
function parseW9Text(text) {
  const normalizedText = text.toLowerCase();
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);

  const fields = {
    legalName: null,
    businessName: null,
    taxClassification: null,
    ein: null,
    ssnLast4: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    zip: null,
    confidence: "medium", // low, medium, high
  };

  // Find name (usually near "name (as shown on your income tax return)")
  const namePatterns = [
    /name\s*\(as\s*shown\s*on\s*your\s*income\s*tax\s*return\)/i,
    /name\s*\(as\s*shown\s*on\s*return\)/i,
    /legal\s*name/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for name field label
    for (const pattern of namePatterns) {
      if (pattern.test(line)) {
        // Name is usually on the next line or same line after colon
        const nameMatch = line.match(/[:]\s*(.+)/i);
        if (nameMatch && nameMatch[1]) {
          fields.legalName = nameMatch[1].trim();
          fields.confidence = "high";
          break;
        }
        // Check next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && nextLine.length > 2 && !nextLine.match(/^[0-9\s\-\(\)]+$/)) {
            fields.legalName = nextLine;
            fields.confidence = "high";
            break;
          }
        }
      }
    }
  }

  // Find business name (usually near "business name" or "disregarded entity")
  const businessPatterns = [
    /business\s*name/i,
    /disregarded\s*entity\s*name/i,
    /name\s*of\s*disregarded\s*entity/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of businessPatterns) {
      if (pattern.test(line)) {
        const nameMatch = line.match(/[:]\s*(.+)/i);
        if (nameMatch && nameMatch[1]) {
          fields.businessName = nameMatch[1].trim();
          break;
        }
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && nextLine.length > 2) {
            fields.businessName = nextLine;
            break;
          }
        }
      }
    }
  }

  // Find address (usually near "address (number, street, and apt. or suite no.)")
  const addressPatterns = [
    /address\s*\(number/i,
    /address\s*\(number,\s*street/i,
    /mailing\s*address/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of addressPatterns) {
      if (pattern.test(line)) {
        // Address is usually on the next 1-2 lines
        if (i + 1 < lines.length) {
          const addrLine1 = lines[i + 1];
          if (addrLine1 && addrLine1.length > 5) {
            fields.addressLine1 = addrLine1;
            
            // Check for line 2
            if (i + 2 < lines.length) {
              const addrLine2 = lines[i + 2];
              // If it doesn't look like city/state/zip, it's probably address line 2
              if (addrLine2 && !addrLine2.match(/^[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/)) {
                fields.addressLine2 = addrLine2;
              }
            }
            break;
          }
        }
      }
    }
  }

  // Find city, state, ZIP (usually near "City, state, and ZIP code")
  const cityStatePatterns = [
    /city,\s*state,\s*and\s*zip\s*code/i,
    /city,\s*state\s*and\s*zip/i,
    /city\s*state\s*zip/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of cityStatePatterns) {
      if (pattern.test(line)) {
        // City/State/ZIP is usually on the next line
        if (i + 1 < lines.length) {
          const cityStateZip = lines[i + 1];
          if (cityStateZip) {
            // Parse format: "City, ST 12345" or "City ST 12345"
            const match = cityStateZip.match(
              /^([A-Za-z\s]+(?:,\s*)?[A-Za-z\s]*?)\s*,?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
            );
            if (match) {
              fields.city = match[1].replace(/,/g, "").trim();
              fields.state = match[2].trim().toUpperCase();
              fields.zip = match[3].trim();
              fields.confidence = "high";
            } else {
              // Try simpler pattern
              const simpleMatch = cityStateZip.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5})/);
              if (simpleMatch) {
                fields.city = simpleMatch[1].trim();
                fields.state = simpleMatch[2].trim().toUpperCase();
                fields.zip = simpleMatch[3].trim();
              }
            }
            break;
          }
        }
      }
    }
  }

  // Find EIN or SSN
  // EIN format: XX-XXXXXXX (2 digits, dash, 7 digits)
  const einPattern = /\b(\d{2})-(\d{7})\b/;
  const einMatch = text.match(einPattern);
  if (einMatch) {
    fields.ein = `${einMatch[1]}-${einMatch[2]}`;
    fields.confidence = fields.confidence === "low" ? "medium" : "high";
  }

  // SSN format: XXX-XX-XXXX (3 digits, dash, 2 digits, dash, 4 digits)
  // Only extract last 4 for privacy
  const ssnPattern = /\b(\d{3})-(\d{2})-(\d{4})\b/;
  const ssnMatch = text.match(ssnPattern);
  if (ssnMatch) {
    fields.ssnLast4 = ssnMatch[3]; // Last 4 digits only
    fields.confidence = fields.confidence === "low" ? "medium" : "high";
  }

  // If we found EIN, it's likely a business
  if (fields.ein && !fields.taxClassification) {
    fields.taxClassification = "C-Corporation"; // Default, user can correct
  }

  // Determine confidence level
  const requiredFields = [fields.legalName, fields.addressLine1, fields.city, fields.state, fields.zip];
  const foundRequiredCount = requiredFields.filter(Boolean).length;
  
  if (foundRequiredCount < 3) {
    fields.confidence = "low";
  } else if (foundRequiredCount < 5) {
    fields.confidence = "medium";
  } else {
    fields.confidence = "high";
  }

  return fields;
}

/**
 * Update laborer document with W-9 OCR data
 */
async function updateLaborerWithW9Data(
  userId,
  laborerId,
  parsedFields,
  filePath,
  downloadUrl
) {
  const laborerRef = admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("laborers")
    .doc(laborerId);

  const laborerDoc = await laborerRef.get();
  if (!laborerDoc.exists) {
    console.warn(`Laborer ${laborerId} not found, but continuing with OCR update`);
    // Laborer might have been deleted, but we'll still try to update
    // The update will fail gracefully if the document doesn't exist
  }

  const existingData = laborerDoc.exists ? laborerDoc.data() : {};
  const updateData = {
    w9OcrStatus: parsedFields.confidence === "low" ? "needs_review" : "complete",
    w9OcrUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    w9SourceFilePath: filePath,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Only update fields if we have high or medium confidence, or if field is currently empty
  // For low confidence, mark as needs_review and don't overwrite existing data
  if (parsedFields.confidence !== "low") {
    // Update name if we found it and it's not already set
    if (parsedFields.legalName && (!existingData.displayName || existingData.displayName.trim() === "")) {
      updateData.displayName = parsedFields.legalName;
    }

    // Update address components
    if (parsedFields.addressLine1) {
      // Build full address string
      let addressParts = [parsedFields.addressLine1];
      if (parsedFields.addressLine2) {
        addressParts.push(parsedFields.addressLine2);
      }
      if (parsedFields.city && parsedFields.state && parsedFields.zip) {
        addressParts.push(`${parsedFields.city}, ${parsedFields.state} ${parsedFields.zip}`);
      }
      const fullAddress = addressParts.join(", ");
      
      if (!existingData.address || existingData.address.trim() === "") {
        updateData.address = fullAddress;
      }
    }

    // Update W9 info object
    const w9Info = {
      legalName: parsedFields.legalName || existingData.w9Info?.legalName || null,
      businessName: parsedFields.businessName || existingData.w9Info?.businessName || null,
      addressLine1: parsedFields.addressLine1 || existingData.w9Info?.addressLine1 || null,
      addressLine2: parsedFields.addressLine2 || existingData.w9Info?.addressLine2 || null,
      city: parsedFields.city || existingData.w9Info?.city || null,
      state: parsedFields.state || existingData.w9Info?.state || null,
      zip: parsedFields.zip || existingData.w9Info?.zip || null,
      taxClassification: parsedFields.taxClassification || existingData.w9Info?.taxClassification || null,
      // Prioritize EIN over SSN if both are found (consistent priority for both fields)
      tinType: parsedFields.ein ? "EIN" : parsedFields.ssnLast4 ? "SSN" : existingData.w9Info?.tinType || null,
      tinLast4: parsedFields.ein ? parsedFields.ein.split("-")[1].slice(-4) : (parsedFields.ssnLast4 || existingData.w9Info?.tinLast4 || null),
      ein: parsedFields.ein || existingData.w9Info?.ein || null,
      updatedAt: Date.now(),
      ocrConfidence: parsedFields.confidence,
    };

    updateData.w9Info = w9Info;
  } else {
    // Low confidence - preserve existing data, just mark for review
    if (existingData.w9Info) {
      updateData.w9Info = {
        ...existingData.w9Info,
        ocrConfidence: "low",
        needsReview: true,
        updatedAt: Date.now(),
      };
    }
  }

  await laborerRef.update(updateData);
  console.log(`Updated laborer ${laborerId} with W-9 data (confidence: ${parsedFields.confidence})`);
}

/**
 * Update OCR status in laborer document
 */
async function updateOcrStatus(userId, laborerId, status, error) {
  const laborerRef = admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("laborers")
    .doc(laborerId);

  const updateData = {
    w9OcrStatus: status,
    w9OcrUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (error) {
    updateData.w9OcrError = error.error || error.message || "Unknown error";
  }

  try {
    await laborerRef.update(updateData);
    console.log(`Updated OCR status for laborer ${laborerId}: ${status}`);
  } catch (err) {
    console.error(`Error updating OCR status: ${err.message}`);
  }
}

/**
 * Document Translator: OCR + Translation
 * Called from frontend to extract text from uploaded document and translate to Spanish
 * Uses OCR.Space API for OCR (replacing Google Vision)
 */
exports.scanContract = functions.https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Log request
  if (DEBUG_MODE) {
    console.log(JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      operation: "scanContract_start",
      environment: ENVIRONMENT,
      hasFileUrl: !!data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
    }));
  }
  
  // Check authentication
  if (!context.auth) {
    logError(requestId, "scanContract_auth", new Error("Unauthenticated"));
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Please sign in to use this feature.",
      createErrorResponse(requestId, "UNAUTHENTICATED", "Please sign in to use this feature.")
    );
  }
  
  const userId = context.auth.uid;
  
  // Validate input
  if (!data.fileUrl) {
    logError(requestId, "scanContract_validation", new Error("Missing fileUrl"));
    throw new functions.https.HttpsError(
      "invalid-argument",
      "File URL is required",
      createErrorResponse(requestId, "BAD_REQUEST", "File URL is required")
    );
  }
  
  // Validate file size (20 MB max)
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  if (data.fileSize && data.fileSize > MAX_FILE_SIZE) {
    logError(requestId, "scanContract_validation", new Error(`File too large: ${data.fileSize} bytes`));
    throw new functions.https.HttpsError(
      "invalid-argument",
      "File too large",
      createErrorResponse(requestId, "FILE_TOO_LARGE", `File too large. Maximum size is 20 MB.`)
    );
  }
  
  // Validate file type
  const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  const validExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const fileName = (data.fileName || "").toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!validTypes.includes(data.fileType) && !hasValidExtension) {
    logError(requestId, "scanContract_validation", new Error(`Invalid file type: ${data.fileType}`));
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid file type",
      createErrorResponse(requestId, "BAD_REQUEST", "Invalid file type. Please upload a PDF, JPG, or PNG file.")
    );
  }
  
  try {
    // Step 1: Download file from Storage
    let fileBuffer;
    try {
      const storage = getStorageClient();
      const fileUrl = data.fileUrl;
      
      // Extract bucket and file path from Firebase Storage URL
      // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
      const urlMatch = fileUrl.match(/\/b\/([^\/]+)\/o\/([^?]+)/);
      if (!urlMatch) {
        throw new Error("Invalid file URL format");
      }
      
      const bucketName = urlMatch[1];
      const encodedPath = decodeURIComponent(urlMatch[2]);
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(encodedPath);
      
      [fileBuffer] = await file.download();
      
      if (DEBUG_MODE) {
        console.log(JSON.stringify({
          requestId,
          operation: "file_downloaded",
          fileSize: fileBuffer.length,
        }));
      }
    } catch (error) {
      logError(requestId, "scanContract_download", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to download file",
        createErrorResponse(requestId, "FILE_DOWNLOAD_FAILED", "Failed to download file from storage.")
      );
    }
    
    // Step 2: Perform OCR using OCR.Space API
    // Note: Get your free API key from https://ocr.space/ocrapi/freekey
    // Set it as environment variable: OCR_SPACE_API_KEY
    // Free tier: 25,000 requests/month
    let extractedText = "";
    try {
      // Get OCR.Space API key from Firebase config or environment variable
      // Set via: firebase functions:config:set ocr_space.api_key="YOUR_KEY"
      // Or set as environment variable: OCR_SPACE_API_KEY
      let ocrSpaceApiKey = null;
      try {
        // Try Firebase Functions config first (recommended)
        ocrSpaceApiKey = functions.config().ocr_space?.api_key;
      } catch (e) {
        // Config not available, will try env var
      }
      // Fallback to environment variable
      if (!ocrSpaceApiKey) {
        ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;
      }
      if (!ocrSpaceApiKey) {
        throw new Error("OCR_SPACE_API_KEY environment variable is not set");
      }
      
      // OCR.Space API endpoint
      const ocrSpaceUrl = "https://api.ocr.space/parse/image";
      
      // Convert file buffer to base64
      const base64File = fileBuffer.toString("base64");
      
      // Determine file type for OCR.Space
      const isPdf = data.fileType === "application/pdf";
      let mimeType = "image/jpeg";
      if (isPdf) {
        mimeType = "application/pdf";
      } else if (data.fileType === "image/png") {
        mimeType = "image/png";
      } else if (data.fileType === "image/jpeg" || data.fileType === "image/jpg") {
        mimeType = "image/jpeg";
      }
      
      // OCR.Space accepts base64 images with data URI format
      const base64Image = `data:${mimeType};base64,${base64File}`;
      
      // Make request to OCR.Space using built-in https module
      const https = require("https");
      const { URL } = require("url");
      
      const makeRequest = (url, options) => {
        return new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          
          // Calculate Content-Length if body is provided
          const body = options.body || "";
          const bodyLength = Buffer.byteLength(body, "utf8");
          
          const requestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || "POST",
            headers: {
              ...options.headers,
              "Content-Length": bodyLength,
            },
            timeout: 30000, // 30 second timeout
          };
          
          const req = https.request(requestOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
              try {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  json: async () => JSON.parse(data),
                });
              } catch (e) {
                reject(new Error(`Failed to parse OCR response: ${e.message}`));
              }
            });
          });
          
          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new Error("OCR request timed out after 30 seconds"));
          });
          
          if (body) {
            req.write(body);
          }
          
          req.end();
        });
      };
      
      // Prepare request body as URL-encoded form data (OCR.Space accepts this format)
      const formParams = new URLSearchParams();
      formParams.append("apikey", ocrSpaceApiKey);
      formParams.append("base64Image", base64Image);
      formParams.append("language", "eng"); // English (can be "eng", "spa", "auto", etc.)
      formParams.append("isOverlayRequired", "false");
      formParams.append("OCREngine", "2"); // Use OCR Engine 2 (more accurate)
      
      const requestBody = formParams.toString();
      const contentType = "application/x-www-form-urlencoded";
      
      // Add timeout to request (30 seconds)
      const requestTimeout = 30000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OCR request timed out after 30 seconds")), requestTimeout);
      });
      
      const response = await Promise.race([
        makeRequest(ocrSpaceUrl, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
          },
          body: requestBody,
        }),
        timeoutPromise,
      ]);
      
      // Check HTTP status code
      if (!response.ok) {
        const statusText = response.status === 401 
          ? "Unauthorized - Invalid API key" 
          : response.status === 429 
          ? "Rate limit exceeded" 
          : response.status === 400 
          ? "Bad request - Invalid file format or parameters" 
          : `HTTP ${response.status}`;
        throw new Error(`OCR.Space API error: ${statusText}`);
      }
      
      const ocrResult = await response.json();
      
      // Log response for debugging (without sensitive data)
      if (DEBUG_MODE) {
        console.log(JSON.stringify({
          requestId,
          operation: "ocr_response",
          status: response.status,
          hasError: ocrResult.IsErroredOnProcessing,
          hasResults: !!(ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0),
        }));
      }
      
      // Check for errors in OCR.Space response
      if (ocrResult.IsErroredOnProcessing === true) {
        const errorMessages = ocrResult.ErrorMessage || [];
        const errorDetails = ocrResult.ErrorDetails || [];
        const errorMsg = Array.isArray(errorMessages) 
          ? errorMessages.join(", ") 
          : String(errorMessages);
        const detailsMsg = Array.isArray(errorDetails) 
          ? errorDetails.join(", ") 
          : String(errorDetails);
        const fullErrorMsg = errorMsg + (detailsMsg ? ` (${detailsMsg})` : "");
        throw new Error(`OCR.Space error: ${fullErrorMsg || "Unknown error"}`);
      }
      
      // Extract text from OCR.Space response
      if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
        throw new Error("No text detected in document");
      }
      
      // Get text from first parsed result
      const parsedResult = ocrResult.ParsedResults[0];
      if (!parsedResult.ParsedText || parsedResult.ParsedText.trim().length === 0) {
        throw new Error("No text extracted from document");
      }
      
      extractedText = parsedResult.ParsedText.trim();
      
      if (DEBUG_MODE) {
        console.log(JSON.stringify({
          requestId,
          operation: "ocr_completed",
          textLength: extractedText.length,
          textPreview: extractedText.substring(0, 200),
          ocrEngine: "OCR.Space",
        }));
      }
    } catch (error) {
      // Check for specific OCR.Space errors
      let errorCode = "OCR_FAILED";
      let errorMessage = "Failed to extract text from document.";
      let errorDetails = null;
      
      if (error.message?.includes("OCR_SPACE_API_KEY") || error.message?.includes("not set")) {
        errorCode = "OCR_API_KEY_MISSING";
        errorMessage = "OCR failed: OCR.Space API key is not configured. Please set OCR_SPACE_API_KEY environment variable.";
      } else if (error.message?.includes("quota") || error.message?.includes("limit") || error.message?.includes("429") || error.message?.includes("Rate limit")) {
        errorCode = "OCR_QUOTA";
        errorMessage = "OCR failed: API quota exceeded. Please try again later.";
      } else if (error.message?.includes("No text") || error.message?.includes("No text detected") || error.message?.includes("No text extracted")) {
        errorCode = "NO_TEXT_DETECTED";
        errorMessage = "No text was detected in the document. Please ensure the document contains readable text.";
      } else if (error.message?.includes("timed out") || error.message?.includes("timeout")) {
        errorCode = "OCR_TIMEOUT";
        errorMessage = "OCR request timed out. The file may be too large or the service is slow. Please try again with a smaller file.";
      } else if (error.message?.includes("Unauthorized") || error.message?.includes("401")) {
        errorCode = "OCR_AUTH_FAILED";
        errorMessage = "OCR failed: Invalid API key. Please check your OCR.Space API key configuration.";
      } else if (error.message?.includes("Bad request") || error.message?.includes("400")) {
        errorCode = "OCR_BAD_REQUEST";
        errorMessage = "OCR failed: Invalid file format or request parameters. Please ensure the file is a valid PDF, JPG, or PNG.";
      } else if (error.message?.includes("OCR.Space error")) {
        errorCode = "OCR_SPACE_ERROR";
        errorMessage = error.message;
      } else if (error.message?.includes("Failed to parse OCR response")) {
        errorCode = "OCR_PARSE_ERROR";
        errorMessage = "OCR failed: Invalid response from OCR service. Please try again.";
        errorDetails = error.message;
      }
      
      // Log error with context (no sensitive data)
      logError(requestId, "scanContract_ocr", error, {
        errorCode,
        errorMessage,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });
      
      throw new functions.https.HttpsError(
        "internal",
        errorMessage,
        createErrorResponse(requestId, errorCode, errorMessage, errorDetails)
      );
    }
    
    // Step 3: Translate to Spanish
    let translatedText = "";
    try {
      const translate = getTranslateClient();
      
      // Get project ID from environment or Firebase Admin
      let projectId = process.env.GCLOUD_PROJECT;
      if (!projectId) {
        // Try to get from Firebase Admin
        const projectIdFromAdmin = admin.app().options.projectId;
        if (projectIdFromAdmin) {
          projectId = projectIdFromAdmin;
        } else {
          throw new Error("Project ID not found. Please set GCLOUD_PROJECT environment variable.");
        }
      }
      
      // Translation API v3 requires location
      const location = "global";
      
      // Chunk text if too long (Translation API has limits)
      const MAX_CHUNK_SIZE = 100000; // 100k characters per request
      const textChunks = [];
      
      // Helper function to split a large text into smaller chunks
      function splitLargeText(text, maxSize) {
        const chunks = [];
        
        // If text is small enough, return as single chunk
        if (text.length <= maxSize) {
          return [text];
        }
        
        // First try splitting by sentences (preserve structure)
        const sentences = text.split(/([.!?]+\s+)/);
        let currentChunk = "";
        
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          
          // If adding this sentence would exceed limit
          if (currentChunk.length + sentence.length > maxSize) {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = "";
            }
            
            // If sentence itself is too large, split by character
            if (sentence.length > maxSize) {
              // Split into character chunks
              for (let j = 0; j < sentence.length; j += maxSize) {
                chunks.push(sentence.substring(j, j + maxSize));
              }
            } else {
              currentChunk = sentence;
            }
          } else {
            currentChunk += sentence;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        return chunks;
      }
      
      if (extractedText.length > MAX_CHUNK_SIZE) {
        // Split by paragraphs to preserve structure
        const paragraphs = extractedText.split(/\n\n+/);
        let currentChunk = "";
        
        for (const para of paragraphs) {
          // Check if paragraph itself exceeds limit
          if (para.length > MAX_CHUNK_SIZE) {
            // Save current chunk if it exists
            if (currentChunk) {
              textChunks.push(currentChunk);
              currentChunk = "";
            }
            // Split the large paragraph
            const paraChunks = splitLargeText(para, MAX_CHUNK_SIZE);
            textChunks.push(...paraChunks);
          } else if (currentChunk.length + para.length > MAX_CHUNK_SIZE) {
            // Current chunk + paragraph would exceed limit
            if (currentChunk) textChunks.push(currentChunk);
            currentChunk = para;
          } else {
            // Add paragraph to current chunk
            currentChunk += (currentChunk ? "\n\n" : "") + para;
          }
        }
        if (currentChunk) textChunks.push(currentChunk);
      } else {
        textChunks.push(extractedText);
      }
      
      // Final safety check: ensure no chunk exceeds limit
      const finalChunks = [];
      for (const chunk of textChunks) {
        if (chunk.length > MAX_CHUNK_SIZE) {
          // Split any remaining oversized chunks
          finalChunks.push(...splitLargeText(chunk, MAX_CHUNK_SIZE));
        } else {
          finalChunks.push(chunk);
        }
      }
      
      // Use final chunks (guaranteed to be <= MAX_CHUNK_SIZE)
      const safeChunks = finalChunks;
      
      // Translate each chunk
      const translatedChunks = [];
      for (let i = 0; i < safeChunks.length; i++) {
        const chunk = safeChunks[i];
        
        const request = {
          parent: `projects/${projectId}/locations/${location}`,
          contents: [chunk],
          mimeType: "text/plain",
          sourceLanguageCode: "en",
          targetLanguageCode: "es",
        };
        
        const [response] = await translate.translateText(request);
        
        if (response.translations && response.translations.length > 0) {
          translatedChunks.push(response.translations[0].translatedText);
        } else {
          throw new Error("Translation returned empty result");
        }
      }
      
      // Reassemble translated text
      translatedText = translatedChunks.join("\n\n");
      
      if (DEBUG_MODE) {
        console.log(JSON.stringify({
          requestId,
          operation: "translation_completed",
          originalLength: extractedText.length,
          translatedLength: translatedText.length,
          chunksProcessed: safeChunks.length,
        }));
      }
    } catch (error) {
      // Check for specific Google API errors
      let errorCode = "TRANSLATE_FAILED";
      let errorMessage = "Failed to translate text.";
      
      if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
        errorCode = "TRANSLATE_PERMISSION";
        errorMessage = "Translation failed: Google Translation API permission denied. Please check IAM roles.";
      } else if (error.code === 16 || error.message?.includes("UNAUTHENTICATED")) {
        errorCode = "TRANSLATE_AUTH";
        errorMessage = "Translation failed: Google Translation API authentication failed. Please check credentials.";
      } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
        errorCode = "TRANSLATE_QUOTA";
        errorMessage = "Translation failed: API quota exceeded. Please try again later.";
      } else if (error.message?.includes("not enabled") || error.message?.includes("API not enabled")) {
        errorCode = "TRANSLATE_API_DISABLED";
        errorMessage = "Translation failed: Google Translation API is not enabled. Please enable it in Google Cloud Console.";
      }
      
      logError(requestId, "scanContract_translation", error, {
        errorCode: error.code,
        errorMessage: error.message,
      });
      
      throw new functions.https.HttpsError(
        "internal",
        errorMessage,
        createErrorResponse(requestId, errorCode, errorMessage)
      );
    }
    
    // Step 4: Return results
    const duration = Date.now() - startTime;
    
    if (DEBUG_MODE) {
      console.log(JSON.stringify({
        requestId,
        operation: "scanContract_success",
        duration,
        textLength: extractedText.length,
        translatedLength: translatedText.length,
      }));
    }
    
    return {
      ok: true,
      english: extractedText,
      spanish: translatedText,
      originalText: extractedText, // Support both formats
      translatedText: translatedText,
      requestId,
    };
    
  } catch (error) {
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise, wrap it
    logError(requestId, "scanContract_unknown", error);
    throw new functions.https.HttpsError(
      "internal",
      "An internal server error occurred. Please try again or contact support if the issue persists.",
      createErrorResponse(requestId, "UNKNOWN", "An internal server error occurred.")
    );
  }
});

/**
 * Health check endpoint for Google APIs
 * Returns diagnostic information about API configuration
 */
exports.healthGoogle = functions.https.onRequest(async (req, res) => {
  const requestId = generateRequestId();
  const diagnostics = {
    ok: true,
    requestId,
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    checks: {},
  };
  
  // Check environment variables
  const envCheck = checkEnvVars();
  diagnostics.checks.environment = {
    valid: envCheck.valid,
    missing: envCheck.missing,
  };
  
  // Check Vision client initialization
  try {
    const vision = getVisionClient();
    diagnostics.checks.vision = {
      initialized: true,
      message: "Vision client initialized successfully",
    };
  } catch (error) {
    diagnostics.checks.vision = {
      initialized: false,
      error: error.message,
    };
    diagnostics.ok = false;
  }
  
  // Check Translation client initialization
  try {
    const translate = getTranslateClient();
    diagnostics.checks.translation = {
      initialized: true,
      message: "Translation client initialized successfully",
    };
  } catch (error) {
    diagnostics.checks.translation = {
      initialized: false,
      error: error.message,
    };
    diagnostics.ok = false;
  }
  
  // Check Storage client initialization
  try {
    const storage = getStorageClient();
    diagnostics.checks.storage = {
      initialized: true,
      message: "Storage client initialized successfully",
    };
  } catch (error) {
    diagnostics.checks.storage = {
      initialized: false,
      error: error.message,
    };
    diagnostics.ok = false;
  }
  
  // Check project ID
  diagnostics.checks.projectId = {
    value: process.env.GCLOUD_PROJECT || "not set",
    set: !!process.env.GCLOUD_PROJECT,
  };
  
  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  const statusCode = diagnostics.ok ? 200 : 503;
  res.status(statusCode).json(diagnostics);
});

