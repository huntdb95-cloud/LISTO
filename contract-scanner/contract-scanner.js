// contract-scanner.js
// Contract Scanner Tool
// Uses Google OCR to extract text from contracts and translates to Spanish

import { auth } from "../config.js";

import {
  getStorage,
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

const storage = getStorage();
const functions = getFunctions();

// State
let currentUid = null;
let currentFile = null;
let englishText = "";
let spanishText = "";

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

function showPreview(file) {
  const preview = $("filePreview");
  if (!preview) return;
  
  preview.innerHTML = "";
  
  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Contract preview";
    preview.appendChild(img);
  } else if (file.type === "application/pdf") {
    const div = document.createElement("div");
    div.innerHTML = `
      <div style="padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px;">
        <div style="font-size: 48px; margin-bottom: 8px;">📄</div>
        <div><strong>${file.name}</strong></div>
        <div class="small muted">PDF Document</div>
      </div>
    `;
    preview.appendChild(div);
  } else {
    const div = document.createElement("div");
    div.innerHTML = `
      <div style="padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px;">
        <div><strong>${file.name}</strong></div>
        <div class="small muted">File ready for processing</div>
      </div>
    `;
    preview.appendChild(div);
  }
}

function showResults(english, spanish) {
  englishText = english || "";
  spanishText = spanish || "";
  
  $("englishText").textContent = englishText;
  $("spanishText").textContent = spanishText;
  
  const resultsCard = $("resultsCard");
  if (resultsCard) {
    resultsCard.style.display = "block";
    resultsCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function hideResults() {
  const resultsCard = $("resultsCard");
  if (resultsCard) {
    resultsCard.style.display = "none";
  }
  englishText = "";
  spanishText = "";
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
    // Show file preview
    showPreview(file);
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
    
    // Show results
    showResults(english || "", spanish || "");
    
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
  
  const preview = $("filePreview");
  if (preview) preview.innerHTML = "";
  
  hideResults();
  currentFile = null;
  englishText = "";
  spanishText = "";
  
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
  
  // Show preview when file is selected
  $("contractFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      showPreview(file);
      hideResults();
      setMsg("statusMsg", "");
      setMsg("errorMsg", "");
    }
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

