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
 * Storage trigger: Process COI uploads for prequalification
 * Triggered when a file is uploaded to: users/{uid}/prequal/coi/{fileName}
 */
exports.processCoiUpload = functions
    .region("us-central1")
    .runWith({serviceAccount: "listo-c6a60@appspot.gserviceaccount.com"})
    .storage
    .bucket("listo-c6a60.firebasestorage.app")
    .object()
    .onFinalize(async (object) => {
      const filePath = object.name;
      const bucket = object.bucket;
      const contentType = object.contentType || "";

      // Only process COI uploads for prequalification
      const coiPathMatch = filePath.match(
          /^users\/([^/]+)\/prequal\/coi\/(.+)$/,
      );

      if (!coiPathMatch) {
        console.log(`Skipping non-COI file: ${filePath}`);
        return null;
      }

      const [, userId] = coiPathMatch;

      console.log(`Processing COI upload: ${filePath}`);
      console.log(`User: ${userId}`);

      // Validate file type
      const validTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!validTypes.includes(contentType)) {
        console.warn(`Invalid file type for COI: ${contentType}`);
        return null;
      }

      try {
        // Download file from Storage
        const storageClient = getStorageClient();
        const bucketObj = storageClient.bucket(bucket);
        const file = bucketObj.file(filePath);
        const [fileBuffer] = await file.download();

        // Perform OCR using Google Cloud Vision
        let fullText = "";
        const visionClient = getVisionClient();

        if (contentType === "application/pdf") {
          // For PDFs, use async batch processing for better results
          const gcsInputUri = `gs://${bucket}/${filePath}`;
          const outputPrefix = `gs://${bucket}/users/${userId}/ocr-output/coi/${Date.now()}/`;
          const outputPrefixPath = `users/${userId}/ocr-output/coi/${Date.now()}/`;

          console.log(`Starting PDF OCR for COI: ${filePath}`);

          // Start async batch operation
          const [operation] = await visionClient.asyncBatchAnnotateFiles({
            requests: [{
              inputConfig: {
                gcsSource: {uri: gcsInputUri},
                mimeType: "application/pdf",
              },
              features: [{type: "DOCUMENT_TEXT_DETECTION"}],
              outputConfig: {
                gcsDestination: {uri: outputPrefix},
              },
            }],
          });

          // Wait for operation to complete
          await operation.promise();

          // Read output files from GCS
          const [files] = await bucketObj.getFiles({prefix: outputPrefixPath});
          const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

          // Extract text from each JSON file
          const pageTexts = [];
          for (const outputFile of jsonFiles) {
            const [fileBuffer] = await outputFile.download();
            const parsed = JSON.parse(fileBuffer.toString());

            if (parsed.responses && parsed.responses.length > 0) {
              for (const response of parsed.responses) {
                if (response.fullTextAnnotation && response.fullTextAnnotation.text) {
                  pageTexts.push(response.fullTextAnnotation.text);
                } else if (response.textAnnotations && response.textAnnotations.length > 0 &&
                    response.textAnnotations[0].description) {
                  pageTexts.push(response.textAnnotations[0].description);
                }
              }
            }
          }

          fullText = pageTexts.join("\n\n").trim();
        } else {
          // For images, use Document Text Detection
          const [result] = await visionClient.documentTextDetection({
            image: {content: fileBuffer},
          });

          if (result.fullTextAnnotation) {
            fullText = result.fullTextAnnotation.text;
          } else if (result.textAnnotations && result.textAnnotations.length > 0) {
            fullText = result.textAnnotations[0].description || "";
          }
        }

        if (!fullText || fullText.trim().length === 0) {
          console.warn(`No text extracted from COI: ${filePath}`);
          return null;
        }

        console.log(`Extracted text length: ${fullText.length} characters`);

        // Parse COI expiration dates from extracted text
        const parsedPolicies = parseCoiText(fullText);

        // Update prequal document with extracted policy dates
        await updatePrequalWithCoiData(userId, parsedPolicies, filePath);

        console.log(`Successfully processed COI for user ${userId}`);
        return null;
      } catch (error) {
        console.error(`Error processing COI: ${error.message}`, error);
        return null; // Don't throw - allow manual entry if OCR fails
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
 * Parse COI text to extract policy expiration dates
 * Looks for Workers Compensation, Automobile Liability, and Commercial General Liability
 */
function parseCoiText(text) {
  const policies = {
    workersCompensation: null,
    automobileLiability: null,
    commercialGeneralLiability: null,
  };

  // Normalize text for searching
  const normalizedText = text.toLowerCase();
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);

  // Common patterns for policy types
  const policyPatterns = {
    workersCompensation: [
      /workers['\s]*comp(?:ensation)?/i,
      /workmen['\s]*comp(?:ensation)?/i,
      /wc/i,
      /workers['\s]*comp/i,
    ],
    automobileLiability: [
      /automobile\s*liability/i,
      /auto\s*liability/i,
      /vehicle\s*liability/i,
      /commercial\s*auto/i,
      /business\s*auto/i,
    ],
    commercialGeneralLiability: [
      /commercial\s*general\s*liability/i,
      /general\s*liability/i,
      /cgl/i,
      /commercial\s*liability/i,
    ],
  };

  // Date patterns - various formats
  const datePatterns = [
    // MM/DD/YYYY or M/D/YYYY
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    // MM-DD-YYYY or M-D-YYYY
    /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    // Month DD, YYYY
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  ];

  // Helper to parse date string to YYYY-MM-DD format
  function parseDateToYyyyMmDd(a, b, c) {
    // Check if it's YYYY-MM-DD format (first part is 4 digits and > 1900)
    if (a && a.length === 4 && parseInt(a) > 1900) {
      const year = parseInt(a);
      const month = parseInt(b);
      const day = parseInt(c);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    } else {
      // MM/DD/YYYY or MM-DD-YYYY
      const month = parseInt(a);
      const day = parseInt(b);
      const year = parseInt(c);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
    return null;
  }

  // Helper to parse month name date
  function parseMonthNameDate(match, monthName, day, year) {
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];
    const monthIndex = monthNames.indexOf(monthName.toLowerCase());
    if (monthIndex >= 0) {
      const month = monthIndex + 1;
      const dayNum = parseInt(day);
      const yearNum = parseInt(year);
      if (dayNum >= 1 && dayNum <= 31 && yearNum > 1900) {
        return `${yearNum}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      }
    }
    return null;
  }

  // Search for each policy type and find expiration dates
  for (const [policyKey, patterns] of Object.entries(policyPatterns)) {
    let foundPolicy = false;
    let expirationDate = null;

    // Search for policy type in text
    for (const pattern of patterns) {
      const policyMatch = text.match(pattern);
      if (policyMatch) {
        foundPolicy = true;
        const matchIndex = text.indexOf(policyMatch[0]);

        // Look for expiration date near the policy type
        // Search in a window around the policy match (within 500 characters)
        const searchStart = Math.max(0, matchIndex - 100);
        const searchEnd = Math.min(text.length, matchIndex + 500);
        const searchWindow = text.substring(searchStart, searchEnd);

        // Look for "expires", "expiration", "exp date", etc.
        const expirationKeywords = [
          /expires?\s*(?:on|date)?/i,
          /expiration\s*(?:date)?/i,
          /exp\s*date/i,
          /valid\s*until/i,
          /valid\s*through/i,
          /coverage\s*until/i,
        ];

        let expirationKeywordIndex = -1;
        for (const keyword of expirationKeywords) {
          const keywordMatch = searchWindow.match(keyword);
          if (keywordMatch) {
            expirationKeywordIndex = searchWindow.indexOf(keywordMatch[0]);
            break;
          }
        }

        // If we found an expiration keyword, search for date after it
        // Otherwise, search in the entire window
        const dateSearchStart = expirationKeywordIndex >= 0 ?
          expirationKeywordIndex : 0;
        const dateSearchWindow = searchWindow.substring(dateSearchStart, dateSearchStart + 200);

        // Try to find dates in various formats
        const dates = [];
        for (const datePattern of datePatterns) {
          const matches = [...dateSearchWindow.matchAll(datePattern)];
          for (const match of matches) {
            let parsedDate = null;
            if (match[0].match(/^(january|february|march|april|may|june|july|august|september|october|november|december)/i)) {
              parsedDate = parseMonthNameDate(match[0], match[1], match[2], match[3]);
            } else {
              // Pass only the capture groups (match[1], match[2], match[3]), not the full match string
              parsedDate = parseDateToYyyyMmDd(match[1], match[2], match[3]);
            }
            if (parsedDate) {
              dates.push(parsedDate);
            }
          }
        }

        // Use the most likely expiration date (usually the latest date in the future)
        if (dates.length > 0) {
          const now = new Date();
          const futureDates = dates.filter((d) => {
            const date = new Date(d);
            return date > now;
          });

          if (futureDates.length > 0) {
            // Sort and take the latest future date
            futureDates.sort();
            expirationDate = futureDates[futureDates.length - 1];
          } else {
            // If no future dates, take the latest date overall
            dates.sort();
            expirationDate = dates[dates.length - 1];
          }
        }

        break; // Found the policy, stop searching
      }
    }

    if (foundPolicy && expirationDate) {
      policies[policyKey] = expirationDate;
      console.log(`Found ${policyKey} expiration: ${expirationDate}`);
    }
  }

  return policies;
}

/**
 * Update prequal document with COI OCR data
 */
async function updatePrequalWithCoiData(userId, parsedPolicies, filePath) {
  const prequalRef = admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("private")
      .doc("prequal");

  const prequalDoc = await prequalRef.get();
  const existingData = prequalDoc.exists ? prequalDoc.data() : {};
  const existingCoi = existingData.coi || {};

  // Build policies object, preserving existing data if OCR didn't find a date
  const policies = {
    workersCompensation: parsedPolicies.workersCompensation || existingCoi.policies?.workersCompensation || null,
    automobileLiability: parsedPolicies.automobileLiability || existingCoi.policies?.automobileLiability || null,
    commercialGeneralLiability: parsedPolicies.commercialGeneralLiability || existingCoi.policies?.commercialGeneralLiability || null,
  };

  // Determine overall expiration (earliest of the three, or use existing expiresOn if set)
  let overallExpiration = existingCoi.expiresOn || null;
  const validDates = Object.values(policies).filter((d) => d !== null);
  if (validDates.length > 0) {
    validDates.sort();
    overallExpiration = validDates[0]; // Earliest expiration
  }

  const updateData = {
    coi: {
      ...existingCoi,
      policies: policies,
      expiresOn: overallExpiration || existingCoi.expiresOn || null,
      ocrProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      ocrProcessed: true,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Always update filePath to the newly uploaded file (this function is only called for new uploads)
  // Verify the filePath is in the expected prequal/coi directory
  if (filePath && filePath.includes(`users/${userId}/prequal/coi/`)) {
    // Extract filename from path
    const fileName = filePath.split("/").pop();
    updateData.coi.filePath = filePath;
    updateData.coi.fileName = fileName;
  } else if (filePath) {
    // Log warning if filePath doesn't match expected pattern (shouldn't happen, but log for debugging)
    console.warn(`Unexpected COI filePath format: ${filePath}. Expected: users/${userId}/prequal/coi/...`);
  }

  await prequalRef.set(updateData, {merge: true});
  console.log(`Updated prequal COI data for user ${userId}`);
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
 * Includes retry logic for race conditions after upload
 */
exports.debugStorageRead = functions.region("us-central1").https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Check authentication
  if (!context.auth) {
    console.error(JSON.stringify({
      requestId,
      operation: "debugStorageRead_auth_error",
      error: "Unauthenticated",
      timestamp: new Date().toISOString(),
    }));
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Please sign in to use this feature.",
        createErrorResponse(requestId, "UNAUTHENTICATED", "Please sign in to use this feature."),
    );
  }

  const userId = context.auth.uid;

  // Validate input
  if (!data || !data.storagePath) {
    console.error(JSON.stringify({
      requestId,
      operation: "debugStorageRead_validation_error",
      error: "Missing storagePath",
      uid: userId,
      timestamp: new Date().toISOString(),
    }));
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Storage path is required",
        createErrorResponse(requestId, "BAD_REQUEST", "Storage path is required"),
    );
  }

  // Validate storage path: must start with users/{uid}/translator/
  const expectedPathPrefix = `users/${userId}/translator/`;
  if (!data.storagePath.startsWith(expectedPathPrefix)) {
    console.error(JSON.stringify({
      requestId,
      operation: "debugStorageRead_validation_error",
      error: "Invalid storage path",
      storagePath: data.storagePath,
      expectedPrefix: expectedPathPrefix,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));
    throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid storage path. Expected path format: users/<uid>/translator/<filename>`,
        createErrorResponse(
            requestId,
            "INVALID_PATH",
            `Invalid storage path. Must start with ${expectedPathPrefix}`,
        ),
    );
  }

  // Get bucket explicitly (even though admin is initialized with storageBucket, be explicit)
  const bucketName = "listo-c6a60.firebasestorage.app";
  const bucket = admin.storage().bucket(bucketName);
  const file = bucket.file(data.storagePath);

  // Log request with bucket info
  console.log(JSON.stringify({
    requestId,
    timestamp: new Date().toISOString(),
    operation: "debugStorageRead_start",
    uid: userId,
    storagePath: data.storagePath,
    bucketName: bucketName,
  }));

  // Retry logic for race conditions (file may not be immediately available after upload)
  const maxRetries = 3;
  const retryDelay = 500; // 500ms
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        if (attempt < maxRetries) {
          console.log(JSON.stringify({
            requestId,
            operation: "debugStorageRead_retry",
            attempt,
            maxRetries,
            storagePath: data.storagePath,
            bucketName: bucketName,
            reason: "File not found, retrying...",
          }));
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        } else {
          throw new functions.https.HttpsError(
              "not-found",
              `Object not found in bucket ${bucketName} at path: ${data.storagePath}`,
              createErrorResponse(
                  requestId,
                  "FILE_NOT_FOUND",
                  `File not found at path: ${data.storagePath} after ${maxRetries} attempts`,
              ),
          );
        }
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();

      const duration = Date.now() - startTime;

      console.log(JSON.stringify({
        requestId,
        operation: "debugStorageRead_success",
        duration,
        attempt,
        bucketName: bucketName,
        storagePath: data.storagePath,
        size: metadata.size,
        contentType: metadata.contentType,
        name: metadata.name || data.storagePath,
      }));

      return {
        ok: true,
        bucket: bucketName,
        name: metadata.name || data.storagePath,
        size: metadata.size ? parseInt(metadata.size, 10) : 0,
        contentType: metadata.contentType || "unknown",
        requestId,
      };
    } catch (error) {
      lastError = error;

      // If it's an HttpsError (like not-found), handle it
      if (error instanceof functions.https.HttpsError) {
        // If it's a not-found error and we have retries left, retry
        if (error.code === "not-found" && attempt < maxRetries) {
          console.log(JSON.stringify({
            requestId,
            operation: "debugStorageRead_retry",
            attempt,
            maxRetries,
            storagePath: data.storagePath,
            bucketName: bucketName,
            reason: error.message,
          }));
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        // Otherwise, re-throw the HttpsError
        throw error;
      }

      // Check for NotFound errors (404) or "No such object" messages
      const isNotFoundError = error.code === 404 ||
        error.message?.includes("No such object") ||
        error.message?.includes("not found") ||
        error.message?.includes("NotFound");

      if (isNotFoundError && attempt < maxRetries) {
        console.log(JSON.stringify({
          requestId,
          operation: "debugStorageRead_retry",
          attempt,
          maxRetries,
          storagePath: data.storagePath,
          bucketName: bucketName,
          reason: error.message || "File not found, retrying...",
        }));
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // If we've exhausted retries or it's not a not-found error, break and handle below
      break;
    }
  }

  // Handle final error
  let errorCode = "STORAGE_READ_FAILED";
  let errorMessage = "Failed to read file from storage.";
  let httpsErrorCode = "internal";

  if (lastError) {
    // Permission errors
    if (lastError.code === 7 || lastError.message?.includes("PERMISSION_DENIED")) {
      errorCode = "STORAGE_PERMISSION";
      errorMessage = "Storage read failed: Permission denied. Check Cloud Function service account IAM roles.";
      httpsErrorCode = "permission-denied";
    } else if (lastError.code === 16 || lastError.message?.includes("UNAUTHENTICATED")) {
      errorCode = "STORAGE_AUTH";
      errorMessage = "Storage read failed: Authentication failed. Check service account credentials.";
      httpsErrorCode = "unauthenticated";
    } else if (lastError.code === 404 ||
        lastError.message?.includes("No such object") ||
        lastError.message?.includes("not found")) {
      errorCode = "FILE_NOT_FOUND";
      errorMessage = `Object not found in bucket ${bucketName} at path: ${data.storagePath}`;
      httpsErrorCode = "not-found";
    } else {
      errorMessage = lastError.message || "Failed to read file from storage.";
    }
  }

  // Log error with full details
  console.error(JSON.stringify({
    requestId,
    operation: "debugStorageRead_failed",
    uid: userId,
    storagePath: data.storagePath,
    bucketName: bucketName,
    error: lastError?.message || "Unknown error",
    errorCode: lastError?.code || "UNKNOWN",
    stack: lastError?.stack || "no stack",
    attempts: maxRetries,
    timestamp: new Date().toISOString(),
  }));

  throw new functions.https.HttpsError(
      httpsErrorCode,
      errorMessage,
      createErrorResponse(requestId, errorCode, errorMessage),
  );
});

/**
 * Document Translator: processDocumentForTranslation
 * Performs OCR on PDFs (async) and images, then translates to target language
 */
exports.processDocumentForTranslation = functions.region("us-central1").https.onCall(async (data, context) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const bucketName = "listo-c6a60.firebasestorage.app";

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

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || data.mimeType || "unknown";
    const fileSize = metadata.size ? parseInt(metadata.size, 10) : 0;
    const isPdf = contentType === "application/pdf";

    // Perform OCR
    let extractedText = "";

    if (isPdf) {
      // PDF: Use asyncBatchAnnotateFiles
      const gcsInputUri = `gs://${bucketName}/${data.storagePath}`;
      const outputPrefix = `gs://${bucketName}/users/${userId}/ocr-output/${requestId}/`;
      const outputPrefixPath = `users/${userId}/ocr-output/${requestId}/`;

      console.log(JSON.stringify({
        requestId,
        operation: "PDF_OCR_START",
        gcsInputUri: gcsInputUri,
        outputPrefix: outputPrefix,
        mimeType: contentType,
        size: fileSize,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));

      const visionClient = getVisionClient();

      // Start async batch operation
      const [operation] = await visionClient.asyncBatchAnnotateFiles({
        requests: [{
          inputConfig: {
            gcsSource: {uri: gcsInputUri},
            mimeType: "application/pdf",
          },
          features: [{type: "DOCUMENT_TEXT_DETECTION"}],
          outputConfig: {
            gcsDestination: {uri: outputPrefix},
          },
        }],
      });

      // Wait for operation to complete
      await operation.promise();

      // Read output files from GCS
      const [files] = await bucket.getFiles({prefix: outputPrefixPath});
      const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

      console.log(JSON.stringify({
        requestId,
        operation: "PDF_OCR_OUTPUT_FILES",
        count: jsonFiles.length,
        firstNames: jsonFiles.slice(0, 5).map((f) => f.name),
        uid: userId,
        timestamp: new Date().toISOString(),
      }));

      // Extract text from each JSON file
      const pageTexts = [];
      for (const outputFile of jsonFiles) {
        const [fileBuffer] = await outputFile.download();
        const parsed = JSON.parse(fileBuffer.toString());

        // Extract text from responses
        if (parsed.responses && parsed.responses.length > 0) {
          for (const response of parsed.responses) {
            if (response.fullTextAnnotation && response.fullTextAnnotation.text) {
              pageTexts.push(response.fullTextAnnotation.text);
            } else if (response.textAnnotations && response.textAnnotations.length > 0 &&
                response.textAnnotations[0].description) {
              pageTexts.push(response.textAnnotations[0].description);
            }
          }
        }
      }

      extractedText = pageTexts.join("\n\n").trim();
    } else {
      // Image: Use documentTextDetection
      console.log(JSON.stringify({
        requestId,
        operation: "OCR_START",
        mimeType: contentType,
        storagePath: data.storagePath,
        size: fileSize,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));

      const visionClient = getVisionClient();
      const gcsUri = `gs://${bucketName}/${data.storagePath}`;

      // Use documentTextDetection with proper request structure
      const [result] = await visionClient.documentTextDetection({
        image: {
          source: {
            imageUri: gcsUri,
          },
        },
      });

      // Extract text
      if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
        extractedText = result.fullTextAnnotation.text;
      } else if (result.textAnnotations && result.textAnnotations.length > 0 &&
          result.textAnnotations[0].description) {
        extractedText = result.textAnnotations[0].description;
      }

      extractedText = extractedText.trim();
    }

    // Log OCR completion and text stats
    const previewFirst200 = extractedText.substring(0, 200);
    console.log(JSON.stringify({
      requestId,
      operation: "OCR_DONE",
      extractedTextLength: extractedText.length,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    console.log(JSON.stringify({
      requestId,
      operation: "TEXT_STATS",
      extractedTextLength: extractedText.length,
      previewFirst200: previewFirst200,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    // Check if text was extracted (only after OCR completes)
    if (extractedText.trim().length === 0) {
      console.error(JSON.stringify({
        requestId,
        operation: "NO_TEXT_DETECTED",
        extractedTextLength: extractedText.length,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "failed-precondition",
          "Document doesn't have readable text",
          {requestId, errorCode: "NO_TEXT_DETECTED"},
      );
    }

    // Translate text
    const targetLanguage = data.targetLanguage || "es";
    let translatedText = "";

    console.log(JSON.stringify({
      requestId,
      operation: "TRANSLATE_START",
      targetLanguage: targetLanguage,
      extractedTextLength: extractedText.length,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    try {
      const translateClient = getTranslateClient();
      const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
      const location = "global";

      // Chunk text if too long (Translation API has limits)
      const MAX_CHUNK_SIZE = 100000;
      const textChunks = [];

      if (extractedText.length > MAX_CHUNK_SIZE) {
        const paragraphs = extractedText.split(/\n\n+/);
        let currentChunk = "";

        for (const para of paragraphs) {
          if (para.length > MAX_CHUNK_SIZE) {
            if (currentChunk) {
              textChunks.push(currentChunk);
              currentChunk = "";
            }
            // Split large paragraph
            for (let i = 0; i < para.length; i += MAX_CHUNK_SIZE) {
              textChunks.push(para.substring(i, i + MAX_CHUNK_SIZE));
            }
          } else if (currentChunk.length + para.length > MAX_CHUNK_SIZE) {
            if (currentChunk) textChunks.push(currentChunk);
            currentChunk = para;
          } else {
            currentChunk += (currentChunk ? "\n\n" : "") + para;
          }
        }
        if (currentChunk) textChunks.push(currentChunk);
      } else {
        textChunks.push(extractedText);
      }

      // Translate each chunk
      const translatedChunks = [];
      for (const chunk of textChunks) {
        const request = {
          parent: `projects/${projectId}/locations/${location}`,
          contents: [chunk],
          mimeType: "text/plain",
          sourceLanguageCode: "en",
          targetLanguageCode: targetLanguage,
        };

        const [response] = await translateClient.translateText(request);

        if (response.translations && response.translations.length > 0) {
          translatedChunks.push(response.translations[0].translatedText);
        } else {
          throw new Error("Translation returned empty result");
        }
      }

      translatedText = translatedChunks.join("\n\n");
    } catch (translateError) {
      console.error(JSON.stringify({
        requestId,
        operation: "processDocumentForTranslation_translate_error",
        error: translateError.message,
        uid: userId,
        timestamp: new Date().toISOString(),
      }));
      throw new functions.https.HttpsError(
          "internal",
          "Translation failed: " + translateError.message,
          {requestId, errorCode: "TRANSLATE_FAILED"},
      );
    }

    // Log translation completion
    console.log(JSON.stringify({
      requestId,
      operation: "TRANSLATE_DONE",
      targetLanguage: targetLanguage,
      translatedLength: translatedText.length,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    const duration = Date.now() - startTime;

    // Log final success (only after OCR + translation completes)
    console.log(JSON.stringify({
      requestId,
      operation: "FINAL_SUCCESS",
      duration,
      extractedTextLength: extractedText.length,
      translatedTextLength: translatedText.length,
      targetLanguage: targetLanguage,
      uid: userId,
      timestamp: new Date().toISOString(),
    }));

    // Return response (matches frontend contract)
    return {
      ok: true,
      extractedText: extractedText,
      translatedText: translatedText,
      targetLanguage: targetLanguage,
      requestId,
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
