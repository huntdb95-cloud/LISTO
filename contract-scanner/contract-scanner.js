// contract-scanner.js
// Contract Scanner Tool
// Uses Google OCR to extract text from contracts and translates to Spanish

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

// Helpers
function setMsg(elId, text, isError = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = isError ? "small danger" : "small muted";
}

function setBusy(isBusy) {
  const btnScan = $("btnScan");
  if (btnScan) btnScan.disabled = isBusy;
  
  if (isBusy) {
    setMsg("statusMsg", "Processing contract... This may take a moment.");
    setMsg("errorMsg", "");
  }
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
  
  // Set initial view to document
  switchView("document");
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
    "image/heic",
    "image/jpeg",
    "image/jpg",
    "image/png"
  ];
  
  const validExtensions = [".pdf", ".heic", ".jpg", ".jpeg", ".png"];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!validTypes.includes(file.type) && !hasValidExtension) {
    setMsg("errorMsg", "Please upload a PDF, HEIC, JPG, or PNG file.", true);
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
    
    setMsg("statusMsg", "Processing with Google OCR and Translation... This may take 30-60 seconds.");
    
    // Call Cloud Function to process the file
    // The function will:
    // 1. Download the file from the URL
    // 2. Use Google Cloud Vision API for OCR
    // 3. Use Google Cloud Translation API to translate to Spanish
    // 4. Return { english: "...", spanish: "..." }
    
    const scanContract = httpsCallable(functions, "scanContract");
    const result = await scanContract({
      fileUrl: downloadURL,
      fileName: file.name,
      fileType: file.type,
      filePath: filePath
    });
    
    if (result?.data?.error) {
      throw new Error(result.data.error);
    }
    
    const { english, spanish } = result.data || {};
    
    if (!english && !spanish) {
      throw new Error("No text was extracted from the document. Please ensure the document contains readable text.");
    }
    
    // Show results with the download URL for document display
    showResults(english || "", spanish || "", downloadURL);
    
    setMsg("statusMsg", "Contract scanned and translated successfully!", false);
    
  } catch (err) {
    console.error("Scan error:", err);
    const errorMessage = err?.message || "Failed to process contract. Please try again.";
    setMsg("errorMsg", errorMessage, true);
    setMsg("statusMsg", "");
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
      ? `contract_english_${currentFile.name.replace(/\.[^/.]+$/, "")}.txt`
      : "contract_english.txt";
    downloadText(englishText, filename);
  });
  
  $("btnDownloadSpanish").addEventListener("click", () => {
    const filename = currentFile 
      ? `contract_spanish_${currentFile.name.replace(/\.[^/.]+$/, "")}.txt`
      : "contract_spanish.txt";
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
  
  // Toggle view buttons
  $("btnShowDocument").addEventListener("click", () => switchView("document"));
  $("btnShowEnglish").addEventListener("click", () => switchView("english"));
  
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

