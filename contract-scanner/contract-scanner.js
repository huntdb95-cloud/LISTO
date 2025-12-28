// document-translator.js (renamed from contract-scanner.js)
// Document Translator Tool
// Uses Google Cloud Vision OCR to extract text from documents and translates to Spanish

import { auth, storage } from "../config.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Removed Firestore imports - no longer using translatorJobs collection

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { app } from "../config.js";

const $ = (id) => document.getElementById(id);

// Initialize Functions with explicit region (us-central1)
const functions = getFunctions(app, "us-central1");

// State
let currentUid = null;
let currentFile = null;
let currentFileUrl = null;
let englishText = "";
let spanishText = "";
let currentView = "document"; // "document" or "english"
let currentMobileView = "spanish"; // "english" or "spanish" for mobile
let lastErrorDetails = null; // Store last error for debugging

// Helpers
function setMsg(elId, text, isError = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = isError ? "small danger" : "small muted";
}

// Parse Firebase Functions error and return user-friendly message
function parseError(error) {
  // If error has a message, try to extract useful info
  const errorMessage = error?.message || String(error || "");
  
  // Firebase Functions returns "internal" for unhandled errors
  if (errorMessage === "internal" || errorMessage.includes("INTERNAL")) {
    return "An internal server error occurred. Please try again or contact support if the issue persists.";
  }
  
  // Check for specific error codes from Firebase Functions
  if (error?.code) {
    switch (error.code) {
      case "functions/not-found":
        return "The OCR service is not available. Please contact support.";
      case "functions/permission-denied":
        return "Permission denied. Please ensure you are signed in.";
      case "functions/unauthenticated":
        return "Please sign in to use this feature.";
      case "functions/deadline-exceeded":
        return "The request took too long. Please try with a smaller file.";
      case "functions/resource-exhausted":
        return "Service temporarily unavailable. Please try again later.";
      default:
        // Try to extract message from error details
        if (error.details) {
          const details = typeof error.details === "string" ? error.details : JSON.stringify(error.details);
          if (details.includes("OCR") || details.includes("Vision")) {
            return "OCR failed: " + (details.includes("API key") || details.includes("credentials") || details.includes("permission") 
              ? "Google Vision API authentication error" 
              : "Unable to extract text from document");
          }
          if (details.includes("Translation") || details.includes("Translate")) {
            return "Translation failed: " + (details.includes("API key") || details.includes("quota")
              ? "Translation API key missing or quota exceeded"
              : "Unable to translate text");
          }
        }
    }
  }
  
  // Check error message for common patterns
  if (errorMessage.includes("OCR") || errorMessage.includes("Vision")) {
    if (errorMessage.includes("API key") || errorMessage.includes("credentials") || errorMessage.includes("permission") || errorMessage.includes("auth")) {
      return "OCR failed: Google Vision API authentication error. Please contact support.";
    }
    if (errorMessage.includes("quota") || errorMessage.includes("limit") || errorMessage.includes("429")) {
      return "OCR failed: API quota exceeded. Please try again later.";
    }
    if (errorMessage.includes("No text") || errorMessage.includes("No text detected") || errorMessage.includes("No text extracted")) {
      return "No text was detected in the document. Please ensure the document contains readable text.";
    }
    return "OCR failed: " + errorMessage;
  }
  
  if (errorMessage.includes("Translation") || errorMessage.includes("Translate")) {
    if (errorMessage.includes("API key") || errorMessage.includes("credentials")) {
      return "Translation failed: Invalid API key or credentials missing";
    }
    if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      return "Translation failed: API quota exceeded. Please try again later.";
    }
    return "Translation failed: " + errorMessage;
  }
  
  if (errorMessage.includes("File too large") || errorMessage.includes("size")) {
    return "File too large. Maximum size is 20 MB.";
  }
  
  if (errorMessage.includes("Invalid file") || errorMessage.includes("file type")) {
    return "Invalid file type. Please upload a PDF, HEIC, JPG, or PNG file.";
  }
  
  // Return original message if it's meaningful, otherwise generic
  if (errorMessage && errorMessage.length > 0 && errorMessage !== "internal") {
    return errorMessage;
  }
  
  return "Failed to process contract. Please try again or contact support if the problem persists.";
}

function setBusy(isBusy) {
  const btnScan = $("btnScan");
  if (btnScan) btnScan.disabled = isBusy;
  
  if (isBusy) {
    // Starting a new operation - clear previous errors and hide error details
    const errorDetailsEl = $("errorDetails");
    if (errorDetailsEl) errorDetailsEl.style.display = "none";
    
    setMsg("statusMsg", "Processing contract... This may take a moment.");
    setMsg("errorMsg", "");
    lastErrorDetails = null;
  }
  // When isBusy is false, we don't hide error details - they should remain visible
  // if they were shown by the error handler
}

function showDocument(file, fileUrl = null) {
  const documentDisplay = $("documentDisplay");
  if (!documentDisplay) return;
  
  documentDisplay.innerHTML = "";
  
  const url = fileUrl || URL.createObjectURL(file);
  
  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Contract document";
    documentDisplay.appendChild(img);
  } else if (file.type === "application/pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Contract PDF";
    documentDisplay.appendChild(iframe);
  } else {
    const div = document.createElement("div");
    div.className = "pdf-placeholder";
    div.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 8px;">📄</div>
      <div><strong>${file.name}</strong></div>
      <div class="small muted">Document ready for viewing</div>
    `;
    documentDisplay.appendChild(div);
  }
}

function showResults(english, spanish, fileUrl = null) {
  englishText = english || "";
  spanishText = spanish || "";
  
  if (fileUrl) {
    currentFileUrl = fileUrl;
  }
  
  // Update text displays
  const englishTextEl = $("englishText");
  const spanishTextEl = $("spanishText");
  if (englishTextEl) englishTextEl.textContent = englishText;
  if (spanishTextEl) spanishTextEl.textContent = spanishText;
  
  // Show document if we have a file
  if (currentFile && currentFileUrl) {
    showDocument(currentFile, currentFileUrl);
  } else if (currentFile) {
    showDocument(currentFile);
  }
  
  // Show comparison container
  const comparisonContainer = $("comparisonContainer");
  if (comparisonContainer) {
    comparisonContainer.style.display = "block";
    comparisonContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  
  // Set initial view based on screen size
  const isMobile = window.innerWidth <= 480;
  if (isMobile) {
    // Mobile: default to Spanish after translation
    switchMobileView("spanish");
  } else {
    // Desktop: show document view
    switchView("document");
  }
}

function hideResults() {
  const comparisonContainer = $("comparisonContainer");
  if (comparisonContainer) {
    comparisonContainer.style.display = "none";
  }
  englishText = "";
  spanishText = "";
  currentFileUrl = null;
  currentView = "document";
}

function switchView(view) {
  currentView = view;
  
  const documentView = $("documentView");
  const englishView = $("englishView");
  const btnShowDocument = $("btnShowDocument");
  const btnShowEnglish = $("btnShowEnglish");
  
  if (view === "document") {
    if (documentView) documentView.classList.add("active");
    if (englishView) englishView.classList.remove("active");
    if (btnShowDocument) btnShowDocument.classList.add("active");
    if (btnShowEnglish) btnShowEnglish.classList.remove("active");
  } else {
    if (documentView) documentView.classList.remove("active");
    if (englishView) englishView.classList.add("active");
    if (btnShowDocument) btnShowDocument.classList.remove("active");
    if (btnShowEnglish) btnShowEnglish.classList.add("active");
  }
}

// Switch mobile view between English and Spanish
function switchMobileView(view) {
  currentMobileView = view;
  
  const englishPane = $("englishPane");
  const spanishPane = $("spanishPane");
  const btnMobileEnglish = $("btnMobileEnglish");
  const btnMobileSpanish = $("btnMobileSpanish");
  const mobileEnglishHeader = $("mobileEnglishHeader");
  const mobileSpanishHeader = $("mobileSpanishHeader");
  
  const isMobile = window.innerWidth <= 480;
  
  if (view === "english") {
    if (englishPane) englishPane.classList.add("active");
    if (spanishPane) spanishPane.classList.remove("active");
    if (btnMobileEnglish) btnMobileEnglish.classList.add("active");
    if (btnMobileSpanish) btnMobileSpanish.classList.remove("active");
    if (isMobile) {
      if (mobileEnglishHeader) mobileEnglishHeader.style.display = "block";
      if (mobileSpanishHeader) mobileSpanishHeader.style.display = "none";
      // On mobile, show English text view directly (no document toggle)
      const englishView = $("englishView");
      const documentView = $("documentView");
      if (englishView) englishView.classList.add("active");
      if (documentView) documentView.classList.remove("active");
    }
  } else {
    if (englishPane) englishPane.classList.remove("active");
    if (spanishPane) spanishPane.classList.add("active");
    if (btnMobileEnglish) btnMobileEnglish.classList.remove("active");
    if (btnMobileSpanish) btnMobileSpanish.classList.add("active");
    if (isMobile) {
      if (mobileEnglishHeader) mobileEnglishHeader.style.display = "none";
      if (mobileSpanishHeader) mobileSpanishHeader.style.display = "block";
    }
  }
}

// Copy text to clipboard
function copyToClipboard(text, label) {
  if (!text) {
    setMsg("statusMsg", `No ${label.toLowerCase()} text to copy.`, true);
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    setMsg("statusMsg", `${label} text copied to clipboard!`);
    setTimeout(() => setMsg("statusMsg", ""), 3000);
  }).catch(err => {
    console.error("Copy failed:", err);
    setMsg("statusMsg", "Failed to copy text.", true);
  });
}

// Download text as file
function downloadText(text, filename) {
  if (!text) {
    setMsg("statusMsg", "No text to download.", true);
    return;
  }
  
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  setMsg("statusMsg", `Downloaded ${filename}`);
  setTimeout(() => setMsg("statusMsg", ""), 3000);
}

// Scan and translate contract
async function scanAndTranslate() {
  const fileInput = $("contractFile");
  const file = fileInput?.files?.[0];
  
  if (!file) {
    setMsg("errorMsg", "Please select a file first.", true);
    return;
  }
  
  if (!currentUid) {
    setMsg("errorMsg", "Please sign in first.", true);
    return;
  }
  
  // Validate file type
  const validTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png"
  ];
  
  const validExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!validTypes.includes(file.type) && !hasValidExtension) {
    setMsg("errorMsg", "Please upload a PDF, JPG, or PNG file.", true);
    return;
  }
  
  // Validate file size (20 MB max)
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    setMsg("errorMsg", `File too large. Maximum size is 20 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`, true);
    return;
  }
  
  if (file.size === 0) {
    setMsg("errorMsg", "File is empty. Please select a valid file.", true);
    return;
  }
  
  setBusy(true);
  hideResults();
  
  try {
    currentFile = file;
    
    // Verify authentication before proceeding
    if (!auth.currentUser) {
      throw new Error("User not authenticated. Please sign in and try again.");
    }
    
    // Storage path: users/{uid}/translator/{timestamp}_{filename}
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = Date.now();
    const storagePath = `users/${currentUid}/translator/${timestamp}_${safeName}`;
    
    // Upload file to Firebase Storage
    const storageRef = ref(storage, storagePath);
    
    setMsg("statusMsg", "Uploading file...");
    
    try {
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream"
      });
    } catch (storageError) {
      console.error("Storage upload error:", storageError);
      console.error("Error code:", storageError.code);
      console.error("Error message:", storageError.message);
      throw new Error(`Failed to upload file: ${storageError.message || storageError.code || "Permission denied"}`);
    }
    
    const downloadURL = await getDownloadURL(storageRef);
    
    setMsg("statusMsg", "Processing with OCR and Translation... This may take 30-60 seconds for images, or 2-5 minutes for PDFs.");
    
    // Call Cloud Function to process the document
    // Function uses Google Cloud Vision OCR + Google Cloud Translation
    const processDocumentForTranslation = httpsCallable(functions, "processDocumentForTranslation");
    const result = await processDocumentForTranslation({
      storagePath: storagePath,
      targetLanguage: "es",
      originalFilename: file.name,
      mimeType: file.type
    });
    
    // Log full result for debugging
    console.log("Process result:", result?.data);
    
    // Check for error in response
    if (result?.data?.error) {
      const errorData = result.data.error;
      
      // Handle structured error response
      if (typeof errorData === "object" && errorData !== null) {
        if (errorData.code) {
          throw { 
            code: errorData.code, 
            message: errorData.message || errorData.error || "An error occurred", 
            details: errorData.details 
          };
        }
        const message = errorData.message || errorData.error || errorData.details || 
                       (typeof errorData.details === "string" ? errorData.details : null) ||
                       JSON.stringify(errorData);
        throw new Error(message);
      }
      
      throw new Error(String(errorData || "An error occurred"));
    }
    
    // Check for structured error response format
    if (result?.data?.ok === false) {
      const errorData = result.data;
      throw { 
        code: errorData.code || "UNKNOWN_ERROR", 
        message: errorData.message || "An error occurred",
        details: errorData.details 
      };
    }
    
    const { extractedText, translatedText } = result.data || {};
    
    if (!extractedText && !translatedText) {
      throw new Error("No text was extracted from the document. Please ensure the document contains readable text.");
    }
    
    // Show results with the download URL for document display
    showResults(extractedText || "", translatedText || "", downloadURL);
    
    setMsg("statusMsg", "Document translated successfully!", false);
    
  } catch (err) {
    console.error("Scan error:", err);
    
    // Extract error details from Firebase Functions error
    let errorData = null;
    let requestId = null;
    let errorCode = null;
    
    if (err?.details) {
      // Firebase Functions wraps the error in details
      if (typeof err.details === "object") {
        errorData = err.details;
      } else {
        // Try to parse as JSON, but handle malformed JSON gracefully
        try {
          errorData = JSON.parse(err.details || "{}");
        } catch (parseError) {
          // If JSON parsing fails, treat the details as a plain string message
          console.warn("Failed to parse error details as JSON:", parseError);
          errorData = { message: String(err.details) };
        }
      }
      requestId = errorData?.requestId || null;
      errorCode = errorData?.errorCode || null;
    } else if (err?.code && err?.message) {
      // Direct error object
      errorData = { code: err.code, message: err.message };
    }
    
    // Store error details for debugging
    lastErrorDetails = {
      requestId,
      errorCode,
      message: err?.message,
      timestamp: new Date().toISOString(),
      error: errorData,
    };
    
    console.error("Error details:", lastErrorDetails);
    
    // Parse error to get user-friendly message
    const errorMessage = parseError(err);
    
    // Display error message
    setMsg("errorMsg", errorMessage, true);
    setMsg("statusMsg", "");
    
    // Show error details if we have a requestId
    const errorDetailsEl = $("errorDetails");
    const errorRequestIdEl = $("errorRequestId");
    
    if (errorDetailsEl && errorRequestIdEl && requestId) {
      errorRequestIdEl.textContent = `Request ID: ${requestId}${errorCode ? ` • Error Code: ${errorCode}` : ""}`;
      errorDetailsEl.style.display = "block";
    } else if (errorDetailsEl) {
      errorDetailsEl.style.display = "none";
    }
  } finally {
    setBusy(false);
  }
}

// Clear form
function clearForm() {
  const fileInput = $("contractFile");
  if (fileInput) fileInput.value = "";
  
  const documentDisplay = $("documentDisplay");
  if (documentDisplay) documentDisplay.innerHTML = "";
  
  hideResults();
  currentFile = null;
  currentFileUrl = null;
  englishText = "";
  spanishText = "";
  currentView = "document";
  
  setMsg("statusMsg", "");
  setMsg("errorMsg", "");
}

// Initialize
function init() {
  // Event listeners
  $("btnScan").addEventListener("click", scanAndTranslate);
  $("btnClear").addEventListener("click", clearForm);
  
  $("btnCopyEnglish").addEventListener("click", () => copyToClipboard(englishText, "English"));
  $("btnCopySpanish").addEventListener("click", () => copyToClipboard(spanishText, "Spanish"));
  
  $("btnDownloadEnglish").addEventListener("click", () => {
    const filename = currentFile 
      ? `document_english_${currentFile.name.replace(/\.[^/.]+$/, "")}.txt`
      : "document_english.txt";
    downloadText(englishText, filename);
  });
  
  $("btnDownloadSpanish").addEventListener("click", () => {
    const filename = currentFile 
      ? `document_spanish_${currentFile.name.replace(/\.[^/.]+$/, "")}.txt`
      : "document_spanish.txt";
    downloadText(spanishText, filename);
  });
  
  // File input change handler
  $("contractFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      hideResults();
      setMsg("statusMsg", "");
      setMsg("errorMsg", "");
    }
  });
  
  // Toggle view buttons (desktop)
  $("btnShowDocument").addEventListener("click", () => switchView("document"));
  $("btnShowEnglish").addEventListener("click", () => switchView("english"));
  
  // Mobile language toggle buttons
  $("btnMobileEnglish").addEventListener("click", () => switchMobileView("english"));
  $("btnMobileSpanish").addEventListener("click", () => switchMobileView("spanish"));
  
  // Copy error details button
  $("btnCopyErrorDetails").addEventListener("click", () => {
    if (!lastErrorDetails) {
      setMsg("statusMsg", "No error details to copy.", true);
      return;
    }
    
    const debugText = `Request ID: ${lastErrorDetails.requestId || "N/A"}
Error Code: ${lastErrorDetails.errorCode || "N/A"}
Timestamp: ${lastErrorDetails.timestamp}
Message: ${lastErrorDetails.message || "N/A"}`;
    
    navigator.clipboard.writeText(debugText).then(() => {
      setMsg("statusMsg", "Debug details copied to clipboard!");
      setTimeout(() => setMsg("statusMsg", ""), 3000);
    }).catch(err => {
      console.error("Copy failed:", err);
      setMsg("statusMsg", "Failed to copy debug details.", true);
    });
  });
  
  // Handle window resize to adjust view
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const isMobile = window.innerWidth <= 480;
      if (isMobile && englishText && spanishText) {
        // On mobile, ensure correct view is shown
        switchMobileView(currentMobileView);
      } else if (!isMobile && englishText && spanishText) {
        // On desktop, ensure document/english toggle works
        switchView(currentView);
      }
    }, 250);
  });
  
  // Auth state listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUid = user.uid;
      console.log("User authenticated:", user.uid);
    } else {
      currentUid = null;
      console.log("User signed out");
    }
  });
  
  // ========== DIAGNOSTICS HANDLERS ==========
  
  // Toggle diagnostics section
  const btnToggleDiagnostics = $("btnToggleDiagnostics");
  const diagnosticsContent = $("diagnosticsContent");
  const diagnosticsResults = $("diagnosticsResults");
  const diagnosticsOutput = $("diagnosticsOutput");
  
  if (btnToggleDiagnostics && diagnosticsContent) {
    btnToggleDiagnostics.addEventListener("click", () => {
      const isVisible = diagnosticsContent.style.display !== "none";
      diagnosticsContent.style.display = isVisible ? "none" : "block";
      btnToggleDiagnostics.textContent = isVisible ? "Show" : "Hide";
    });
  }
  
  // Helper: Log diagnostics result
  function logDiagnostics(message, data = null) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? "\n" + JSON.stringify(data, null, 2) : ""}\n\n`;
    
    if (diagnosticsOutput) {
      diagnosticsOutput.textContent += logLine;
      diagnosticsResults.style.display = "block";
      diagnosticsResults.scrollTop = diagnosticsResults.scrollHeight;
    }
    
    console.log(message, data || "");
  }
  
  // Helper: Clear diagnostics output
  function clearDiagnostics() {
    if (diagnosticsOutput) {
      diagnosticsOutput.textContent = "";
    }
    if (diagnosticsResults) {
      diagnosticsResults.style.display = "none";
    }
  }
  
  // Helper: Format callable error for display
  function formatCallableError(error) {
    let message = "";
    if (error.code) {
      message += `Code: ${error.code}\n`;
    }
    if (error.message) {
      message += `Message: ${error.message}\n`;
    }
    if (error.details) {
      message += `Details: ${JSON.stringify(error.details, null, 2)}\n`;
    }
    return message || String(error);
  }
  
  // Run Ping
  const btnPing = $("btnPing");
  if (btnPing) {
    btnPing.addEventListener("click", async () => {
      clearDiagnostics();
      logDiagnostics("🔍 Running Ping test...");
      
      try {
        logDiagnostics("Current user UID:", currentUid);
        logDiagnostics("Functions region: us-central1");
        
        const ping = httpsCallable(functions, "ping");
        const result = await ping({});
        
        logDiagnostics("✅ Ping successful!", result.data);
        
        if (result.data.ok && result.data.uidPresent) {
          logDiagnostics("✓ Authentication: OK");
        } else if (result.data.ok && !result.data.uidPresent) {
          logDiagnostics("⚠️ Authentication: User not signed in");
        }
      } catch (error) {
        logDiagnostics("❌ Ping failed!", {
          error: formatCallableError(error),
          fullError: error
        });
      }
    });
  }
  
  // Verify Upload + Read
  const btnVerifyUpload = $("btnVerifyUpload");
  if (btnVerifyUpload) {
    btnVerifyUpload.addEventListener("click", async () => {
      clearDiagnostics();
      logDiagnostics("🔍 Running Upload + Read verification...");
      
      try {
        if (!currentUid) {
          throw new Error("User not authenticated. Please sign in first.");
        }
        
        const fileInput = $("contractFile");
        const file = fileInput?.files?.[0];
        
        if (!file) {
          throw new Error("Please select a file first.");
        }
        
        logDiagnostics("Selected file:", {
          name: file.name,
          size: file.size,
          type: file.type
        });
        
        // Upload file to Storage
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const timestamp = Date.now();
        const storagePath = `users/${currentUid}/translator/${timestamp}_${safeName}`;
        
        logDiagnostics("Uploading to Storage path:", storagePath);
        
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || "application/octet-stream"
        });
        
        logDiagnostics("✅ File uploaded successfully");
        
        // Call debugStorageRead
        logDiagnostics("Calling debugStorageRead...");
        const debugStorageRead = httpsCallable(functions, "debugStorageRead");
        const result = await debugStorageRead({ storagePath });
        
        logDiagnostics("✅ Storage read successful!", result.data);
        
        if (result.data.ok && result.data.bytes > 0) {
          logDiagnostics(`✓ File read: ${result.data.bytes} bytes, Content-Type: ${result.data.contentType}`);
        }
      } catch (error) {
        logDiagnostics("❌ Upload + Read failed!", {
          error: formatCallableError(error),
          fullError: error
        });
      }
    });
  }
  
  // Run OCR + Translate Smoke Test
  const btnSmokeTest = $("btnSmokeTest");
  if (btnSmokeTest) {
    btnSmokeTest.addEventListener("click", async () => {
      clearDiagnostics();
      logDiagnostics("🔍 Running OCR + Translate smoke test...");
      
      try {
        if (!currentUid) {
          throw new Error("User not authenticated. Please sign in first.");
        }
        
        const fileInput = $("contractFile");
        const file = fileInput?.files?.[0];
        
        if (!file) {
          throw new Error("Please select a file first.");
        }
        
        logDiagnostics("Selected file:", {
          name: file.name,
          size: file.size,
          type: file.type
        });
        
        // Upload file to Storage
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const timestamp = Date.now();
        const storagePath = `users/${currentUid}/translator/${timestamp}_${safeName}`;
        
        logDiagnostics("Uploading to Storage path:", storagePath);
        
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || "application/octet-stream"
        });
        
        logDiagnostics("✅ File uploaded successfully");
        
        // Call processDocumentForTranslation
        logDiagnostics("Calling processDocumentForTranslation...");
        const processDocumentForTranslation = httpsCallable(functions, "processDocumentForTranslation");
        const result = await processDocumentForTranslation({
          storagePath: storagePath,
          targetLanguage: "es",
          originalFilename: file.name,
          mimeType: file.type
        });
        
        logDiagnostics("✅ OCR + Translation successful!", {
          extractedTextLength: result.data.extractedText?.length || 0,
          translatedTextLength: result.data.translatedText?.length || 0,
          pageCount: result.data.pageCount || null,
          mimeType: result.data.mimeType
        });
        
        if (result.data.extractedText && result.data.extractedText.length > 0) {
          logDiagnostics(`✓ Extracted text: ${result.data.extractedText.length} characters`);
          logDiagnostics("Extracted text preview:", result.data.extractedText.substring(0, 200) + "...");
        } else {
          logDiagnostics("⚠️ Warning: No text extracted");
        }
        
        if (result.data.translatedText && result.data.translatedText.length > 0) {
          logDiagnostics(`✓ Translated text: ${result.data.translatedText.length} characters`);
          logDiagnostics("Translated text preview:", result.data.translatedText.substring(0, 200) + "...");
        } else {
          logDiagnostics("⚠️ Warning: No translated text");
        }
        
        // Also update the UI with results
        if (result.data.extractedText && result.data.translatedText) {
          showResults(result.data.extractedText, result.data.translatedText);
          logDiagnostics("✅ Results displayed in UI");
        }
      } catch (error) {
        logDiagnostics("❌ OCR + Translation failed!", {
          error: formatCallableError(error),
          fullError: error
        });
      }
    });
  }
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

