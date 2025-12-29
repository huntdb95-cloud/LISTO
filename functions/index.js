/**
 * Firebase Cloud Functions for Listo
 * 
 * W-9 OCR Processing:
 * - Automatically processes W-9 uploads for laborers
 * - Extracts text using Google Cloud Vision OCR
 * - Parses W-9 fields and updates laborer records
 * 
 * Document Translator (processDocument):
 * - Uses Google Cloud Vision OCR for images and PDFs
 * - Uses Google Cloud Translation API to translate to Spanish
 * - Stores results in Firestore translatorJobs collection
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const {Storage} = require("@google-cloud/storage");
const {v4: uuidv4} = require("uuid");
const {TranslationServiceClient} = require("@google-cloud/translate");

admin.initializeApp({
  storageBucket: "listo-c6a60.firebasestorage.app",
});

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
      // Use explicit bucket name to avoid "bucket name needed" errors
      storageClient = new Storage();
    } catch (error) {
      console.error("Failed to initialize Storage client:", error.message);
      throw new Error("STORAGE_CLIENT_INIT_FAILED");
    }
  }
  return storageClient;
}

// Helper: Get bucket with explicit name
function getBucket() {
  const bucketName = "listo-c6a60.firebasestorage.app";
  const storage = getStorageClient();
  return storage.bucket(bucketName);
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
    ...(DEBUG_MODE && details ? {details} : {}),
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
exports.processW9Upload = functions
    .region("us-central1")
    .runWith({serviceAccount: "listo-c6a60@appspot.gserviceaccount.com"})
    .storage
    .bucket("listo-c6a60.firebasestorage.app")
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const bucket = object.bucket;
    const contentType = object.contentType || "";

    // Only process W-9 uploads for laborers
    const w9PathMatch = filePath.match(
          /^users\/([^/]+)\/laborers\/([^/]+)\/documents\/w9\/(.+)$/,
    );

    if (!w9PathMatch) {
      console.log(`Skipping non-W9 file: ${filePath}`);
      return null;
    }

      const [, userId, laborerId] = w9PathMatch;

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
        const storageClient = getStorageClient();
        const bucketObj = storageClient.bucket(bucket);
      const file = bucketObj.file(filePath);
      const [fileBuffer] = await file.download();

      // Perform OCR using Google Cloud Vision
      let fullText = "";
      
      if (contentType === "application/pdf") {
        // For PDFs, use Document Text Detection
        const [result] = await visionClient.documentTextDetection({
            image: {content: fileBuffer},
        });
        
        if (result.fullTextAnnotation) {
          fullText = result.fullTextAnnotation.text;
        } else {
          throw new Error("No text detected in PDF");
        }
      } else {
        // For images, use Document Text Detection (better for forms)
        const [result] = await visionClient.documentTextDetection({
            image: {content: fileBuffer},
        });
        
        if (result.fullTextAnnotation) {
          fullText = result.fullTextAnnotation.text;
        } else {
          // Fallback to regular text detection
          const [fallbackResult] = await visionClient.textDetection({
              image: {content: fileBuffer},
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
            object.mediaLink || null,
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
          if (nextLine && nextLine.length > 2 && !nextLine.match(/^[0-9\s\-()]+$/)) {
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
                /^([A-Za-z\s]+(?:,\s*)?[A-Za-z\s]*?)\s*,?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
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
    downloadUrl,
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
      const addressParts = [parsedFields.addressLine1];
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
      tinLast4: parsedFields.ein ?
        parsedFields.ein.split("-")[1].slice(-4) :
        (parsedFields.ssnLast4 || existingData.w9Info?.tinLast4 || null),
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
 * Diagnostics: ping
 * Minimal crash-proof health check to verify callable functions work and auth is present
 */
exports.ping = functions.region("us-central1").https.onCall(async (data, context) => {
  try {
    const requestId = generateRequestId();
    const uid = context.auth ? context.auth.uid : null;

    console.log(JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      operation: "ping",
      uid: uid,
    }));

    const projectId = process.env.GCLOUD_PROJECT ||
      (admin.app().options ? admin.app().options.projectId : null) ||
      "unknown";

    return {
      ok: true,
      serverTime: new Date().toISOString(),
      uidPresent: context.auth != null,
      projectId: projectId,
    };
  } catch (error) {
    console.error(JSON.stringify({
      operation: "ping_error",
      error: error.message || String(error),
      stack: error.stack || "no stack",
      timestamp: new Date().toISOString(),
    }));
    throw new functions.https.HttpsError(
        "internal",
        `Ping failed: ${error.message || "Unknown error"}`,
        {error: error.message || "Unknown error"},
    );
  }
});

/**
 * Diagnostics: debugStorageRead
 * Verifies that the Cloud Function can read files from Storage
 * Tests Storage access and path validation
 */
exports.debugStorageRead = functions.region("us-central1").https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Log request
  console.log(JSON.stringify({
    requestId,
    timestamp: new Date().toISOString(),
    operation: "debugStorageRead_start",
    storagePath: data.storagePath,
    uid: context.auth?.uid || null,
  }));

  // Check authentication
  if (!context.auth) {
    logError(requestId, "debugStorageRead_auth", new Error("Unauthenticated"));
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Please sign in to use this feature.",
        createErrorResponse(requestId, "UNAUTHENTICATED", "Please sign in to use this feature."),
    );
  }

  const userId = context.auth.uid;

  // Validate input
  if (!data.storagePath) {
    logError(requestId, "debugStorageRead_validation", new Error("Missing storagePath"));
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Storage path is required",
        createErrorResponse(requestId, "BAD_REQUEST", "Storage path is required"),
    );
  }

  // Validate storage path: must start with users/{uid}/translator/
  const expectedPathPrefix = `users/${userId}/translator/`;
  if (!data.storagePath.startsWith(expectedPathPrefix)) {
    logError(requestId, "debugStorageRead_validation", new Error("Invalid storage path"));
    throw new functions.https.HttpsError(
        "permission-denied",
        "Invalid storage path. Files must be in users/{uid}/translator/",
        createErrorResponse(
            requestId,
            "PERMISSION_DENIED",
            `Invalid storage path. Must start with ${expectedPathPrefix}`,
        ),
    );
  }

  try {
    // Get Storage client and file reference
    const bucket = getBucket();
    const file = bucket.file(data.storagePath);
    
    console.log(JSON.stringify({
      requestId,
      operation: "debugStorageRead_bucket_info",
      bucketName: bucket.name,
      storagePath: data.storagePath,
    }));

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new functions.https.HttpsError(
          "not-found",
          "File not found in storage",
          createErrorResponse(requestId, "FILE_NOT_FOUND", `File not found at path: ${data.storagePath}`),
      );
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();

    // Download file to get size
    const [fileBuffer] = await file.download();
    const bytes = fileBuffer.length;

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      operation: "debugStorageRead_success",
      duration,
      bytes,
      contentType: metadata.contentType,
      name: metadata.name,
    }));

    return {
      ok: true,
      bytes: bytes,
      contentType: metadata.contentType || "unknown",
      name: metadata.name || data.storagePath,
      size: metadata.size || bytes,
      requestId,
    };
  } catch (error) {
    let errorCode = "STORAGE_READ_FAILED";
    let errorMessage = "Failed to read file from storage.";

    if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
      errorCode = "STORAGE_PERMISSION";
      errorMessage = "Storage read failed: Permission denied. Check Cloud Function service account IAM roles.";
    } else if (error.code === 16 || error.message?.includes("UNAUTHENTICATED")) {
      errorCode = "STORAGE_AUTH";
      errorMessage = "Storage read failed: Authentication failed. Check service account credentials.";
    } else if (error instanceof functions.https.HttpsError) {
      // Re-throw HttpsError as-is
      throw error;
    }

    logError(requestId, "debugStorageRead_error", error, {
      errorCode,
      errorMessage,
      storagePath: data.storagePath,
    });

    throw new functions.https.HttpsError(
        "internal",
        errorMessage,
        createErrorResponse(requestId, errorCode, errorMessage),
    );
  }
});

/**
 * Document Translator: processDocumentForTranslation
 * TEMPORARY ECHO TEST: Validates callable + Storage access without OCR/Translation
 * After this works, re-enable Vision OCR + Translation API calls
 */
exports.processDocumentForTranslation = functions.region("us-central1").https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Log request
  console.log(JSON.stringify({
    requestId,
    timestamp: new Date().toISOString(),
    operation: "processDocumentForTranslation_start",
    storagePath: data?.storagePath || "missing",
    mimeType: data?.mimeType || "missing",
    uid: context.auth?.uid || null,
  }));

  try {
    // Check authentication
    if (!context.auth) {
      console.error(JSON.stringify({
        requestId,
        operation: "processDocumentForTranslation_auth_error",
        error: "Unauthenticated",
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "unauthenticated",
          "Please sign in to use this feature.",
          {requestId, errorCode: "UNAUTHENTICATED"},
      );
    }

    const userId = context.auth.uid;

    // Validate input
    if (!data || !data.storagePath) {
      console.error(JSON.stringify({
        requestId,
        operation: "processDocumentForTranslation_validation_error",
        error: "Missing storagePath",
        uid: userId,
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Storage path is required",
          {requestId, errorCode: "BAD_REQUEST"},
      );
    }

    // Validate storage path: must start with users/{uid}/translator/
    const expectedPathPrefix = `users/${userId}/translator/`;
    if (!data.storagePath.startsWith(expectedPathPrefix)) {
      console.error(JSON.stringify({
        requestId,
        operation: "processDocumentForTranslation_validation_error",
        error: "Invalid storage path",
        storagePath: data.storagePath,
        expectedPrefix: expectedPathPrefix,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "permission-denied",
          `Invalid storage path. Files must be in ${expectedPathPrefix}`,
          {requestId, errorCode: "PERMISSION_DENIED"},
      );
    }

    // Get Storage client and file reference
    const bucket = getBucket();
    const file = bucket.file(data.storagePath);
    
    console.log(JSON.stringify({
      requestId,
      operation: "processDocumentForTranslation_bucket_info",
      bucketName: bucket.name,
      storagePath: data.storagePath,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error(JSON.stringify({
        requestId,
        operation: "processDocumentForTranslation_file_not_found",
        storagePath: data.storagePath,
        bucketName: bucket.name,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "not-found",
          "File not found in storage",
          {requestId, errorCode: "FILE_NOT_FOUND"},
      );
    }

    // Get file metadata (echo test - just return metadata)
    const [metadata] = await file.getMetadata();
    const size = metadata.size ? parseInt(metadata.size, 10) : 0;
    const contentType = metadata.contentType || data.mimeType || "unknown";

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      operation: "processDocumentForTranslation_success",
      duration,
      storagePath: data.storagePath,
      contentType,
      size,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    // Return echo test result (Storage metadata only)
    return {
      ok: true,
      storagePath: data.storagePath,
      contentType: contentType,
      size: size,
      uid: userId,
    };
  } catch (error) {
    // Catch any errors and log with full details
    const errorDetails = {
      requestId,
      operation: "processDocumentForTranslation_error",
      error: error.message || String(error),
      stack: error.stack || "no stack",
      uid: context.auth?.uid || null,
      storagePath: data?.storagePath || "missing",
      timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(errorDetails));

    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Wrap in HttpsError with real error message (not just "internal")
    throw new functions.https.HttpsError(
        "internal",
        error.message || "An unexpected error occurred during document processing.",
        {requestId, errorCode: "UNEXPECTED_ERROR", originalError: error.message},
    );
  }
});

/**
 * Document Translator: processDocument (legacy - kept for backward compatibility)
 * Uses Google Cloud Vision OCR for images and PDFs
 * Uses Google Cloud Translation API to translate to Spanish
 * Stores results in Firestore translatorJobs collection
 */
exports.processDocument = functions.https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Log request
  if (DEBUG_MODE) {
    console.log(JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      operation: "processDocument_start",
      environment: ENVIRONMENT,
      jobId: data.jobId,
      filePath: data.filePath,
      fileType: data.fileType,
    }));
  }
  
  // Check authentication
  if (!context.auth) {
    logError(requestId, "processDocument_auth", new Error("Unauthenticated"));
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Please sign in to use this feature.",
        createErrorResponse(requestId, "UNAUTHENTICATED", "Please sign in to use this feature."),
    );
  }
  
  const userId = context.auth.uid;
  
  // Validate input
  if (!data.jobId || !data.filePath || !data.fileType) {
    logError(requestId, "processDocument_validation", new Error("Missing required fields"));
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Job ID, file path, and file type are required",
        createErrorResponse(requestId, "BAD_REQUEST", "Job ID, file path, and file type are required"),
    );
  }
  
  // Validate file type
  const validTypes = ["image", "pdf"];
  if (!validTypes.includes(data.fileType)) {
    logError(requestId, "processDocument_validation", new Error(`Invalid file type: ${data.fileType}`));
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid file type",
        createErrorResponse(requestId, "BAD_REQUEST", "Invalid file type. Must be 'image' or 'pdf'."),
    );
  }
  
  const db = admin.firestore();
  const jobRef = db.collection("translatorJobs").doc(data.jobId);
  
  try {
    // Verify job exists and belongs to user
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
    throw new functions.https.HttpsError(
        "not-found",
        "Job not found",
          createErrorResponse(requestId, "JOB_NOT_FOUND", "Translation job not found."),
      );
    }
    
    const jobData = jobDoc.data();
    if (jobData.uid !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Access denied",
          createErrorResponse(requestId, "PERMISSION_DENIED", "You do not have access to this job."),
      );
    }
    
    // Update status to processing
    await jobRef.update({
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Get Storage client and file reference
    const bucket = getBucket();
    const file = bucket.file(data.filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("File not found in storage");
    }
  
    // Perform OCR using Google Cloud Vision
    let extractedText = "";
    let sourceLanguage = "en"; // Default to English
    
    try {
      const vision = getVisionClient();
      
      if (data.fileType === "image") {
        // For images: use textDetection
        const gcsUri = `gs://${bucket.name}/${data.filePath}`;
        
        const [result] = await vision.textDetection(gcsUri);
        const detections = result.textAnnotations;
        
        if (detections && detections.length > 0) {
          // Use fullTextAnnotation if available (better quality), otherwise use first detection
          if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
            extractedText = result.fullTextAnnotation.text;
          } else {
            extractedText = detections[0].description || "";
          }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error("No text detected in image");
        }
        
        extractedText = extractedText.trim();
        
        if (DEBUG_MODE) {
          console.log(JSON.stringify({
            requestId,
            operation: "ocr_image_completed",
            textLength: extractedText.length,
            textPreview: extractedText.substring(0, 200),
          }));
        }
      } else if (data.fileType === "pdf") {
        // For PDFs: use asyncBatchAnnotateFiles
        const gcsSourceUri = `gs://${bucket.name}/${data.filePath}`;
        const gcsDestinationUri = `gs://${bucket.name}/ocr-output/${userId}/${data.jobId}/`;
        
        const inputConfig = {
          mimeType: "application/pdf",
          gcsSource: {
            uri: gcsSourceUri,
          },
        };
        
        const outputConfig = {
          gcsDestination: {
            uri: gcsDestinationUri,
          },
          batchSize: 2, // Process 2 pages at a time
        };
        
        const request = {
          requests: [
            {
              inputConfig: inputConfig,
              features: [{type: "DOCUMENT_TEXT_DETECTION"}],
              outputConfig: outputConfig,
            },
          ],
        };
        
        // Start async batch operation
        const [operation] = await vision.asyncBatchAnnotateFiles(request);
        const operationName = operation.name;
        
        if (DEBUG_MODE) {
          console.log(JSON.stringify({
            requestId,
            operation: "ocr_pdf_started",
            operationName,
          }));
        }
        
        // Poll for completion (max 5 minutes)
        // Note: asyncBatchAnnotateFiles returns a long-running operation
        // We need to wait for it to complete by checking the output bucket
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 10000; // 10 seconds
        const startPollTime = Date.now();
        
        let completed = false;
        while (!completed && (Date.now() - startPollTime) < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          
          // Check if output files exist in the destination bucket
          const outputPrefix = `ocr-output/${userId}/${data.jobId}/`;
          const [files] = await bucket.getFiles({prefix: outputPrefix});
          
          // If we have JSON output files, the operation is likely complete
          const hasJsonFiles = files.some((f) => f.name.endsWith(".json"));
          if (hasJsonFiles) {
            // Wait a bit more to ensure all files are written
            await new Promise((resolve) => setTimeout(resolve, 5000));
            completed = true;
          }
        }
        
        if (!completed) {
          throw new Error("OCR operation timed out. PDF processing may take longer for large files.");
        }
        
        // Read results from output bucket
        const outputPrefix = `ocr-output/${userId}/${data.jobId}/`;
        const [files] = await bucket.getFiles({prefix: outputPrefix});
        
        // Sort files by name (page order)
        files.sort((a, b) => {
          const aNum = parseInt(a.name.match(/-(\d+)-output/)?.[1] || "0");
          const bNum = parseInt(b.name.match(/-(\d+)-output/)?.[1] || "0");
          return aNum - bNum;
        });
        
        // Extract text from each output file
        const pageTexts = [];
        for (const outputFile of files) {
          if (outputFile.name.endsWith(".json")) {
            const [fileBuffer] = await outputFile.download();
            const jsonData = JSON.parse(fileBuffer.toString());
            
            // Extract text from response
            if (jsonData.responses && jsonData.responses.length > 0) {
              for (const response of jsonData.responses) {
                if (response.fullTextAnnotation && response.fullTextAnnotation.text) {
                  pageTexts.push(response.fullTextAnnotation.text);
                } else if (response.textAnnotations && response.textAnnotations.length > 0) {
                  pageTexts.push(response.textAnnotations[0].description || "");
                }
              }
            }
          }
        }
        
        extractedText = pageTexts.join("\n\n");
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error("No text detected in PDF");
        }
        
        extractedText = extractedText.trim();
        
        if (DEBUG_MODE) {
          console.log(JSON.stringify({
            requestId,
            operation: "ocr_pdf_completed",
            textLength: extractedText.length,
            pagesProcessed: pageTexts.length,
            textPreview: extractedText.substring(0, 200),
          }));
        }
      }
    } catch (error) {
      let errorCode = "OCR_FAILED";
      let errorMessage = "Failed to extract text from document.";
      
      if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
        errorCode = "OCR_PERMISSION";
        errorMessage = "OCR failed: Google Vision API permission denied. Please check IAM roles.";
      } else if (error.code === 16 || error.message?.includes("UNAUTHENTICATED")) {
        errorCode = "OCR_AUTH";
        errorMessage = "OCR failed: Google Vision API authentication failed. Please check credentials.";
      } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
        errorCode = "OCR_QUOTA";
        errorMessage = "OCR failed: API quota exceeded. Please try again later.";
      } else if (error.message?.includes("not enabled") || error.message?.includes("API not enabled")) {
        errorCode = "OCR_API_DISABLED";
        errorMessage = "OCR failed: Google Vision API is not enabled. Please enable it in Google Cloud Console.";
      } else if (error.message?.includes("No text detected") || error.message?.includes("No text")) {
        errorCode = "NO_TEXT_DETECTED";
        errorMessage = "No text was detected in the document. Please ensure the document contains readable text.";
      } else if (error.message?.includes("timed out") || error.message?.includes("timeout")) {
        errorCode = "OCR_TIMEOUT";
        errorMessage = "OCR request timed out. The file may be too large. Please try again with a smaller file.";
      }
      
      logError(requestId, "processDocument_ocr", error, {
        errorCode,
        errorMessage,
        fileType: data.fileType,
      });
      
      // Update job status to error
      await jobRef.update({
        status: "error",
        errorMessage: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      throw new functions.https.HttpsError(
        "internal",
        errorMessage,
          createErrorResponse(requestId, errorCode, errorMessage),
      );
    }
    
    // Translate to Spanish
    let translatedText = "";
    try {
      const translate = getTranslateClient();
      
      // Get project ID
      let projectId = process.env.GCLOUD_PROJECT;
      if (!projectId) {
        projectId = admin.app().options.projectId;
      }
      if (!projectId) {
        throw new Error("Project ID not found");
      }
      
      // Translation API v3 requires location
      const location = "global";
      
      // Chunk text if too long (Translation API has limits)
      const MAX_CHUNK_SIZE = 100000; // 100k characters per request
      const textChunks = [];
      
      // Helper function to split a large text into smaller chunks
      const splitLargeText = (text, maxSize) => {
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
      };
      
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
          
          // Try to get detected source language from first chunk
          if (translatedChunks.length === 1 && response.translations[0].detectedLanguageCode) {
            sourceLanguage = response.translations[0].detectedLanguageCode;
          }
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
        errorMessage =
          "Translation failed: Google Translation API is not enabled. " +
          "Please enable it in Google Cloud Console.";
      }
      
      logError(requestId, "processDocument_translation", error);
      
      // Update job status to error
      await jobRef.update({
        status: "error",
        errorMessage: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      throw new functions.https.HttpsError(
        "internal",
        errorMessage,
          createErrorResponse(requestId, errorCode, errorMessage),
      );
    }
    
    // Save results to Firestore
    await jobRef.update({
      status: "done",
      extractedText: extractedText,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: data.targetLanguage || "es",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const duration = Date.now() - startTime;
    
    if (DEBUG_MODE) {
      console.log(JSON.stringify({
        requestId,
        operation: "processDocument_success",
        duration,
        textLength: extractedText.length,
        translatedLength: translatedText.length,
      }));
    }
    
    return {
      ok: true,
      extractedText: extractedText,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      requestId,
    };
  } catch (error) {
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Update job status to error if we have a jobRef
    try {
      if (data.jobId) {
        const jobRef = db.collection("translatorJobs").doc(data.jobId);
        await jobRef.update({
          status: "error",
          errorMessage: error.message || "An error occurred",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (updateError) {
      // Ignore update errors if job doesn't exist
    }
    
    // Otherwise, wrap it
    logError(requestId, "processDocument_unknown", error);
    throw new functions.https.HttpsError(
      "internal",
      "An internal server error occurred. Please try again or contact support if the issue persists.",
        createErrorResponse(requestId, "UNKNOWN", "An internal server error occurred."),
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
    getVisionClient(); // Test initialization
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
    getTranslateClient(); // Test initialization
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
    getStorageClient(); // Test initialization
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

