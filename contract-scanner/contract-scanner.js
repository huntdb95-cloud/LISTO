// document-translator.js (renamed from contract-scanner.js)
// Document Translator Tool
// Uses OCR.Space API to extract text from documents and translates to Spanish

import { auth, storage } from "../config.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id) => document.getElementById(id);

const functions = getFunctions();

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
    return "An internal server error occurred. Please check that Google Cloud Vision and Translation APIs are properly configured.";
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
            return "OCR failed: " + (details.includes("credentials") || details.includes("permission") 
              ? "Google Vision API credentials missing or invalid" 
              : "Unable to extract text from image");
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
    if (errorMessage.includes("credentials") || errorMessage.includes("permission") || errorMessage.includes("auth")) {
      return "OCR failed: Google Vision API credentials missing or invalid";
    }
    if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      return "OCR failed: API quota exceeded. Please try again later.";
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
    
    // Upload file to Firebase Storage first
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = Date.now();
    const filePath = `users/${currentUid}/contracts/${timestamp}_${safeName}`;
    const storageRef = ref(storage, filePath);
    
    setMsg("statusMsg", "Uploading file...");
    
    await uploadBytes(storageRef, file, {
      contentType: file.type || "application/octet-stream"
    });
    
    const downloadURL = await getDownloadURL(storageRef);
    
    setMsg("statusMsg", "Processing with OCR and Translation... This may take 30-60 seconds.");
    
    // Call Cloud Function to process the file
    // The function will:
    // 1. Download the file from the URL
    // 2. Use OCR.Space API for OCR
    // 3. Use Google Cloud Translation API to translate to Spanish
    // 4. Return { english: "...", spanish: "..." }
    
    const scanContract = httpsCallable(functions, "scanContract");
    const result = await scanContract({
      fileUrl: downloadURL,
      fileName: file.name,
      fileType: file.type,
      filePath: filePath,
      fileSize: file.size
    });
    
    // Log full result for debugging (remove in production if needed)
    console.log("Scan result:", result?.data);
    
    // Check for error in response
    if (result?.data?.error) {
      const errorData = result.data.error;
      
      // Handle structured error response
      if (typeof errorData === "object" && errorData !== null) {
        // If it has a code, use structured error format
        if (errorData.code) {
          throw { 
            code: errorData.code, 
            message: errorData.message || errorData.error || "An error occurred", 
            details: errorData.details 
          };
        }
        // If it's an object without code, extract message from common properties
        const message = errorData.message || errorData.error || errorData.details || 
                       (typeof errorData.details === "string" ? errorData.details : null) ||
                       JSON.stringify(errorData);
        throw new Error(message);
      }
      
      // If errorData is a string or primitive, use it directly
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
    
    const { english, spanish, originalText, translatedText } = result.data || {};
    
    // Support both old format (english/spanish) and new format (originalText/translatedText)
    const finalEnglish = english || originalText || "";
    const finalSpanish = spanish || translatedText || "";
    
    if (!finalEnglish && !finalSpanish) {
      throw new Error("No text was extracted from the document. Please ensure the document contains readable text.");
    }
    
    // Show results with the download URL for document display
    showResults(finalEnglish, finalSpanish, downloadURL);
    
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
    } else {
      currentUid = null;
    }
  });
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

