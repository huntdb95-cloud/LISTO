// bookkeeping.js
// 1099 Laborer Bookkeeping Tool

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { db, auth, storage } from "../config.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/* -----------------------------
   Helpers
------------------------------ */
const $ = (id) => document.getElementById(id);

function money(n) {
  const val = Number(n || 0);
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthStartISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function yearStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function setMessage(elId, text, isError = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = `bookkeeping-message ${isError ? "bookkeeping-message-error" : "bookkeeping-message-success"}`;
  el.style.display = text ? "block" : "none";
}

function showMessage(text, isError = false) {
  setMessage("laborerMessage", text, isError);
  if (!isError) {
    setTimeout(() => setMessage("laborerMessage", "", false), 3000);
  }
}

/* -----------------------------
   State
------------------------------ */
let currentUid = null;
let laborers = []; // { id, displayName, laborerType, phone, email, address, tinLast4, notes, isArchived, documents: { w9, coi }, createdAt, updatedAt }
let payments = []; // { id, laborerId, datePaid, amount, method, memo, createdAt }
let selectedLaborerId = null;
let dateRangeFrom = monthStartISO();
let dateRangeTo = todayISO();
let pendingLaborerId = null; // Store laborerId from URL params to open after load
let pendingFocus = null; // Store focus parameter from URL (e.g., "w9")

/* -----------------------------
   Firestore Collections
------------------------------ */
function laborersCol() {
  if (!currentUid) throw new Error("Not authenticated");
  return collection(db, "users", currentUid, "laborers");
}

function paymentsCol() {
  if (!currentUid) throw new Error("Not authenticated");
  return collection(db, "users", currentUid, "payments");
}

/* -----------------------------
   Load Data
------------------------------ */
let laborersUnsubscribe = null; // Store unsubscribe function for real-time listener

async function loadLaborers() {
  if (!currentUid) return;
  
  // Unsubscribe from previous listener if it exists
  if (laborersUnsubscribe) {
    laborersUnsubscribe();
    laborersUnsubscribe = null;
  }
  
  try {
    const q = query(laborersCol(), orderBy("displayName"));
    
    // Set up real-time listener for immediate updates
    laborersUnsubscribe = onSnapshot(q, (snap) => {
      const previousLaborerIds = new Set(laborers.map(l => l.id));
      laborers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const currentLaborerIds = new Set(laborers.map(l => l.id));
      
      // Check if selected laborer was deleted
      if (selectedLaborerId && !currentLaborerIds.has(selectedLaborerId)) {
        // Selected laborer was deleted
        selectedLaborerId = null;
        $("laborerDetailPanel").style.display = "none";
        showMessage("The selected laborer was removed.", false);
      }
      
      renderLaborersList();
      
      // If a laborer was selected and still exists, refresh the detail view
      if (selectedLaborerId && currentLaborerIds.has(selectedLaborerId)) {
        const laborer = laborers.find(l => l.id === selectedLaborerId);
        if (laborer) {
          renderLaborerDetail(laborer);
        }
      }
      
      // Handle pending laborer selection from URL params (URL params take precedence)
      if (pendingLaborerId) {
        handlePendingLaborerSelection();
      }
    }, (err) => {
      console.error("Error in laborers listener:", err);
      showMessage("Error loading laborers", true);
    });
  } catch (err) {
    console.error("Error setting up laborers listener:", err);
    showMessage("Error loading laborers", true);
  }
}

async function loadPayments() {
  if (!currentUid) return;
  try {
    const q = query(paymentsCol(), orderBy("datePaid", "desc"));
    const snap = await getDocs(q);
    payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSummaries();
    if (selectedLaborerId) {
      renderPayments();
    }
  } catch (err) {
    console.error("Error loading payments:", err);
    showMessage("Error loading payments", true);
  }
}

/* -----------------------------
   Render Laborers List
------------------------------ */
function renderLaborersList() {
  const container = $("laborersList");
  if (!container) return;

  const searchTerm = ($("laborerSearch")?.value || "").toLowerCase();
  const filtered = laborers.filter(l => {
    if (l.isArchived) return false;
    if (!searchTerm) return true;
    return (l.displayName || "").toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="bookkeeping-empty-state">${searchTerm ? "No laborers found" : "No laborers yet. Click \"+ Add\" to create one."}</div>`;
    return;
  }

  container.innerHTML = filtered.map(l => `
    <div class="bookkeeping-laborer-item ${l.id === selectedLaborerId ? "active" : ""}" data-laborer-id="${l.id}">
      <div class="bookkeeping-laborer-item-name">${escapeHtml(l.displayName || "Unnamed")}</div>
      <div class="bookkeeping-laborer-item-type">${escapeHtml(l.laborerType || "")}</div>
    </div>
  `).join("");

  // Add click handlers
  container.querySelectorAll(".bookkeeping-laborer-item").forEach(item => {
    item.addEventListener("click", () => {
      const laborerId = item.dataset.laborerId;
      selectLaborer(laborerId);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Format date to MM/DD/YY (display format for mobile and desktop)
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  
  try {
    // Handle ISO date string (YYYY-MM-DD)
    if (dateStr.includes("-")) {
      const [year, month, day] = dateStr.split("-");
      const yearShort = year.slice(-2);
      return `${month}/${day}/${yearShort}`;
    }
    
    // Handle Date object or timestamp
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  } catch (err) {
    console.warn("Error formatting date:", err);
    return dateStr;
  }
}

// Alias for backward compatibility
const formatDateMobile = formatDateShort;

// Check if current viewport is mobile
function isMobile() {
  return window.innerWidth <= 768;
}

/* -----------------------------
   Select Laborer
------------------------------ */
function selectLaborer(laborerId, focusSection = null) {
  selectedLaborerId = laborerId;
  const laborer = laborers.find(l => l.id === laborerId);
  
  if (!laborer) {
    $("laborerDetailPanel").style.display = "none";
    return;
  }

  // Update UI
  renderLaborersList();
  renderLaborerDetail(laborer);
  renderPayments();
  $("laborerDetailPanel").style.display = "block";
  
  // Scroll detail panel into view (especially important on mobile)
  const detailPanel = $("laborerDetailPanel");
  if (detailPanel) {
    detailPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  
  // Handle focus section (e.g., "w9")
  if (focusSection === "w9") {
    // Scroll to W-9 section after a brief delay to ensure it's rendered
    setTimeout(() => {
      const w9Section = $("w9Status")?.closest(".bookkeeping-document-item");
      if (w9Section) {
        w9Section.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 300);
  }
}

function renderLaborerDetail(laborer) {
  if (!laborer) return;

  $("detailLaborerName").textContent = laborer.displayName || "Laborer Details";
  
  // Store laborer ID for navigation (use robust DOM manipulation)
  let laborerIdEl = document.getElementById("laborerId");
  if (!laborerIdEl) {
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = "laborerId";
    hiddenInput.value = laborer.id || "";
    // Append to detail panel (safer than insertBefore with firstChild)
    const detailPanel = $("laborerDetailPanel");
    if (detailPanel) {
      detailPanel.appendChild(hiddenInput);
    }
  } else {
    laborerIdEl.value = laborer.id || "";
  }

  // Show/hide COI section based on type
  const coiSection = $("coiDocumentSection");
  if (laborer.laborerType === "Subcontractor") {
    coiSection.style.display = "block";
    renderDocumentStatus("coi", laborer.documents?.coi, laborer);
  } else {
    coiSection.style.display = "none";
  }

  // Render document statuses (read-only)
  renderDocumentStatus("w9", laborer.documents?.w9, laborer);
}

function renderDocumentStatus(docType, docData, laborer = null) {
  const statusEl = $(`${docType}Status`);
  const infoEl = $(`${docType}Info`);
  
  if (!docData || !docData.downloadURL) {
    // Not uploaded
    if (statusEl) {
      statusEl.textContent = "Not uploaded";
      statusEl.className = "bookkeeping-document-status bookkeeping-document-status-missing";
    }
    if (infoEl) infoEl.style.display = "none";
    
    // Hide OCR status if no document
    if (docType === "w9") {
      const ocrStatusEl = $("w9OcrStatus");
      if (ocrStatusEl) ocrStatusEl.style.display = "none";
    }
  } else {
    // Uploaded
    if (statusEl) {
      statusEl.textContent = "Uploaded";
      statusEl.className = "bookkeeping-document-status bookkeeping-document-status-uploaded";
    }
    if (infoEl) {
      const uploadDate = docData.uploadedAt ? new Date(docData.uploadedAt).toLocaleDateString() : "Unknown";
      // Remove filename display - only show upload date and view/download link
      infoEl.innerHTML = `
        <div>Uploaded: ${uploadDate}</div>
        <div><a href="${escapeHtml(docData.downloadURL)}" target="_blank" style="color: #059669; text-decoration: underline;">View/Download</a></div>
      `;
      infoEl.style.display = "block";
    }
    
    // Show OCR status for W-9 documents
    if (docType === "w9" && laborer) {
      renderW9OcrStatus(laborer);
    }
  }
}

function renderW9OcrStatus(laborer) {
  const ocrStatusEl = $("w9OcrStatus");
  if (!ocrStatusEl) return;
  
  const ocrStatus = laborer.w9OcrStatus;
  const w9Info = laborer.w9Info;
  
  if (!ocrStatus) {
    ocrStatusEl.style.display = "none";
    return;
  }
  
  ocrStatusEl.style.display = "block";
  
  if (ocrStatus === "processing") {
    ocrStatusEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #059669;">
        <span style="display: inline-block; width: 12px; height: 12px; border: 2px solid #059669; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
        <span>Scanning W-9...</span>
      </div>
    `;
    ocrStatusEl.style.background = "#f0fdf4";
    ocrStatusEl.style.border = "1px solid #86efac";
    ocrStatusEl.style.color = "#059669";
  } else if (ocrStatus === "complete" || ocrStatus === "needs_review") {
    const confidence = w9Info?.ocrConfidence || "medium";
    const confidenceLabel = confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low";
    const confidenceColor = confidence === "high" ? "#059669" : confidence === "medium" ? "#f59e0b" : "#dc2626";
    
    let infoHtml = `<div style="font-weight: 600; margin-bottom: 6px; color: ${confidenceColor};">✓ W-9 scanned (${confidenceLabel} confidence)</div>`;
    
    if (w9Info) {
      const extractedFields = [];
      if (w9Info.legalName) extractedFields.push(`Name: ${escapeHtml(w9Info.legalName)}`);
      if (w9Info.businessName) extractedFields.push(`Business: ${escapeHtml(w9Info.businessName)}`);
      if (w9Info.addressLine1) {
        let addr = escapeHtml(w9Info.addressLine1);
        if (w9Info.city && w9Info.state && w9Info.zip) {
          addr += `, ${escapeHtml(w9Info.city)}, ${escapeHtml(w9Info.state)} ${escapeHtml(w9Info.zip)}`;
        }
        extractedFields.push(`Address: ${addr}`);
      }
      if (w9Info.tinLast4) {
        const tinType = w9Info.tinType === "EIN" ? "EIN" : "SSN";
        extractedFields.push(`${tinType} Last 4: ${escapeHtml(w9Info.tinLast4)}`);
      }
      
      if (extractedFields.length > 0) {
        infoHtml += `<div style="font-size: 0.8rem; color: #374151; margin-top: 4px;">${extractedFields.join(" • ")}</div>`;
      }
    }
    
    if (ocrStatus === "needs_review" || confidence === "low") {
      infoHtml += `<div style="font-size: 0.75rem; color: #dc2626; margin-top: 4px; font-style: italic;">Please review extracted information</div>`;
    }
    
    ocrStatusEl.innerHTML = infoHtml;
    ocrStatusEl.style.background = confidence === "high" ? "#f0fdf4" : "#fef3c7";
    ocrStatusEl.style.border = `1px solid ${confidence === "high" ? "#86efac" : "#fcd34d"}`;
    ocrStatusEl.style.color = confidence === "high" ? "#059669" : "#92400e";
  } else if (ocrStatus === "failed") {
    const errorMsg = laborer.w9OcrError || "Couldn't scan W-9. Please enter details manually.";
    ocrStatusEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #dc2626;">
        <span>⚠</span>
        <span>${escapeHtml(errorMsg)}</span>
      </div>
    `;
    ocrStatusEl.style.background = "#fef2f2";
    ocrStatusEl.style.border = "1px solid #fecaca";
    ocrStatusEl.style.color = "#dc2626";
  } else {
    ocrStatusEl.style.display = "none";
  }
}

// Add CSS animation for spinner
if (!document.getElementById("ocrSpinnerStyle")) {
  const style = document.createElement("style");
  style.id = "ocrSpinnerStyle";
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/* -----------------------------
   Save Laborer
------------------------------ */
async function saveLaborer() {
  if (!currentUid) {
    showMessage("Please sign in first", true);
    return;
  }

  const displayName = ($("laborerDisplayName")?.value || "").trim();
  const laborerType = $("laborerType")?.value || "";
  
  if (!displayName) {
    showMessage("Display name is required", true);
    return;
  }
  if (!laborerType) {
    showMessage("Laborer type is required", true);
    return;
  }

  const laborerId = $("laborerId")?.value || null;
  const data = {
    displayName,
    laborerType,
    phone: ($("laborerPhone")?.value || "").trim() || null,
    email: ($("laborerEmail")?.value || "").trim() || null,
    address: ($("laborerAddress")?.value || "").trim() || null,
    tinLast4: ($("laborerTinLast4")?.value || "").trim() || null,
    notes: ($("laborerNotes")?.value || "").trim() || null,
    isArchived: $("laborerIsArchived")?.checked || false,
    updatedAt: serverTimestamp()
  };

  try {
    if (laborerId) {
      // Update existing
      const laborerRef = doc(db, "users", currentUid, "laborers", laborerId);
      const laborerDoc = await getDoc(laborerRef);
      if (laborerDoc.exists()) {
        const existing = laborerDoc.data();
        data.documents = existing.documents || {}; // Preserve documents
        data.createdAt = existing.createdAt; // Preserve createdAt
      }
      await updateDoc(laborerRef, data);
      showMessage("Laborer updated successfully");
    } else {
      // Create new
      data.createdAt = serverTimestamp();
      data.documents = {};
      const newRef = await addDoc(laborersCol(), data);
      selectedLaborerId = newRef.id;
      showMessage("Laborer created successfully");
    }
    
    await loadLaborers();
    if (selectedLaborerId) {
      const laborer = laborers.find(l => l.id === selectedLaborerId);
      if (laborer) renderLaborerDetail(laborer);
    }
  } catch (err) {
    console.error("Error saving laborer:", err);
    showMessage("Error saving laborer: " + (err.message || "Unknown error"), true);
  }
}

/* -----------------------------
   Document Upload
------------------------------ */
async function uploadDocument(docType) {
  if (!currentUid || !selectedLaborerId) {
    showMessage("Please select a laborer first", true);
    return;
  }

  // COI only for Subcontractors
  if (docType === "coi") {
    const laborer = laborers.find(l => l.id === selectedLaborerId);
    if (laborer?.laborerType !== "Subcontractor") {
      showMessage("COI is only required for Subcontractors", true);
    return;
    }
  }

  const fileInput = $(`${docType}FileInput`);
  const file = fileInput?.files?.[0];
  
  if (!file) {
    showMessage("Please select a file", true);
    return;
  }

  // Validate file type
  const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  if (!validTypes.includes(file.type)) {
    showMessage("Invalid file type. Please upload a PDF or image (JPG/PNG)", true);
    return;
  }

  // Validate file size (15MB max)
  const maxSize = 15 * 1024 * 1024;
  if (file.size > maxSize) {
    showMessage("File too large. Maximum size is 15MB", true);
    return;
  }

  const progressEl = $(`${docType}Progress`);
  const errorEl = $(`${docType}Error`);
  const uploadBtn = $(`upload${docType.charAt(0).toUpperCase() + docType.slice(1)}Btn`);

  try {
    if (progressEl) {
      progressEl.textContent = "Uploading...";
      progressEl.style.display = "block";
    }
    if (errorEl) errorEl.style.display = "none";
    if (uploadBtn) uploadBtn.disabled = true;

    // Delete old file if exists
    const laborer = laborers.find(l => l.id === selectedLaborerId);
    const oldDoc = laborer?.documents?.[docType];
    if (oldDoc?.storagePath) {
      try {
        const oldRef = ref(storage, oldDoc.storagePath);
        await deleteObject(oldRef);
  } catch (err) {
        console.warn("Error deleting old file:", err);
        // Continue even if deletion fails
      }
    }

    // Upload new file
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const timestamp = Date.now();
    const storagePath = `users/${currentUid}/laborers/${selectedLaborerId}/documents/${docType}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream"
  });
  
    const downloadURL = await getDownloadURL(storageRef);

    // Update laborer document
    const laborerRef = doc(db, "users", currentUid, "laborers", selectedLaborerId);
    const laborerDoc = await getDoc(laborerRef);
    const existingData = laborerDoc.exists() ? laborerDoc.data() : {};
    
    const documents = existingData.documents || {};
    documents[docType] = {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      storagePath,
      downloadURL,
      uploadedAt: Date.now(),
      updatedAt: Date.now()
    };

    await updateDoc(laborerRef, {
      documents,
      updatedAt: serverTimestamp()
    });

    // Reload and update UI
    await loadLaborers();
    const updatedLaborer = laborers.find(l => l.id === selectedLaborerId);
    if (updatedLaborer) {
      renderLaborerDetail(updatedLaborer);
      showMessage(`${docType.toUpperCase()} uploaded successfully`);
    }

    // Clear file input
    if (fileInput) fileInput.value = "";
  } catch (err) {
    console.error("Error uploading document:", err);
    if (errorEl) {
      errorEl.textContent = "Upload failed: " + (err.message || "Unknown error");
      errorEl.style.display = "block";
    }
    showMessage("Upload failed: " + (err.message || "Unknown error"), true);
  } finally {
    if (progressEl) progressEl.style.display = "none";
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

async function removeDocument(docType) {
  if (!currentUid || !selectedLaborerId) {
    return;
  }

  if (!confirm(`Are you sure you want to remove the ${docType.toUpperCase()}? This will delete the file.`)) {
    return;
  }
  
  try {
    const laborer = laborers.find(l => l.id === selectedLaborerId);
    const docData = laborer?.documents?.[docType];
    
    // Delete from storage
    if (docData?.storagePath) {
      try {
        const fileRef = ref(storage, docData.storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn("Error deleting file from storage:", err);
        // Continue even if deletion fails
      }
    }

    // Remove from Firestore
    const laborerRef = doc(db, "users", currentUid, "laborers", selectedLaborerId);
    const laborerDoc = await getDoc(laborerRef);
    const existingData = laborerDoc.exists() ? laborerDoc.data() : {};
    
    const documents = existingData.documents || {};
    delete documents[docType];

    await updateDoc(laborerRef, {
      documents,
      updatedAt: serverTimestamp()
    });

    // Reload and update UI
    await loadLaborers();
    const updatedLaborer = laborers.find(l => l.id === selectedLaborerId);
    if (updatedLaborer) {
      renderLaborerDetail(updatedLaborer);
      showMessage(`${docType.toUpperCase()} removed successfully`);
    }
  } catch (err) {
    console.error("Error removing document:", err);
    showMessage("Error removing document: " + (err.message || "Unknown error"), true);
  }
}

/* -----------------------------
   Payments
------------------------------ */
async function addPayment() {
  if (!currentUid || !selectedLaborerId) {
    showMessage("Please select a laborer first", true);
    return;
  }

  const datePaid = $("paymentDate")?.value;
  const amount = parseFloat($("paymentAmount")?.value || 0);
  const method = $("paymentMethod")?.value || "";
  const memo = ($("paymentMemo")?.value || "").trim() || null;

  if (!datePaid) {
    showMessage("Payment date is required", true);
    return;
  }
  if (!amount || amount <= 0) {
    showMessage("Payment amount must be greater than 0", true);
    return;
  }
  if (!method) {
    showMessage("Payment method is required", true);
    return;
  }

  try {
    await addDoc(paymentsCol(), {
      laborerId: selectedLaborerId,
      datePaid,
      amount,
      method,
      memo,
      createdAt: serverTimestamp()
    });

    // Clear form
    if ($("paymentDate")) $("paymentDate").value = todayISO();
    if ($("paymentAmount")) $("paymentAmount").value = "";
    if ($("paymentMethod")) $("paymentMethod").value = "";
    if ($("paymentMemo")) $("paymentMemo").value = "";

    await loadPayments();
    showMessage("Payment added successfully");
  } catch (err) {
    console.error("Error adding payment:", err);
    showMessage("Error adding payment: " + (err.message || "Unknown error"), true);
  }
}

async function deletePayment(paymentId) {
  if (!confirm("Are you sure you want to delete this payment?")) {
    return;
  }

  try {
    const paymentRef = doc(db, "users", currentUid, "payments", paymentId);
    await deleteDoc(paymentRef);
    await loadPayments();
    showMessage("Payment deleted successfully");
  } catch (err) {
    console.error("Error deleting payment:", err);
    showMessage("Error deleting payment: " + (err.message || "Unknown error"), true);
  }
}

function renderPayments() {
  const tbody = $("paymentsTableBody");
  const thead = $("paymentsTableHead");
  if (!tbody || !thead) return;
  
  const mobile = isMobile();
  const colspan = mobile ? 3 : 5; // 3 columns on mobile (Date, Amount, Method), 5 on desktop
  
  // Handle empty state (no laborer selected or no payments)
  if (!selectedLaborerId) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="bookkeeping-empty-state">No payments yet</td></tr>`;
    return;
  }

  // Helper function to parse MM/DD/YY date format
  function parseMMDDYY(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle ISO date string (YYYY-MM-DD)
      if (dateStr.includes("-")) {
        return new Date(dateStr);
      }
      
      // Handle MM/DD/YY format
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
          const day = parseInt(parts[1], 10);
          let year = parseInt(parts[2], 10);
          
          // Convert 2-digit year to 4-digit (00-69 => 2000-2069, 70-99 => 1970-1999)
          if (year < 70) {
            year += 2000;
          } else if (year < 100) {
            year += 1900;
          }
          
          return new Date(year, month, day);
        }
      }
      
      // Fallback: try Date constructor
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (err) {
      console.warn("Error parsing date:", dateStr, err);
    }
    
    return null;
  }

  const laborerPayments = payments
    .filter(p => p.laborerId === selectedLaborerId)
    .filter(p => {
      // Parse dates before comparison to handle MM/DD/YY and ISO formats
      const paymentDate = parseMMDDYY(p.datePaid);
      const rangeFrom = dateRangeFrom ? parseMMDDYY(dateRangeFrom) : null;
      const rangeTo = dateRangeTo ? parseMMDDYY(dateRangeTo) : null;
      
      // Handle invalid/missing dates - exclude from range if date can't be parsed
      if (!paymentDate) return false;
      
      if (rangeFrom && paymentDate < rangeFrom) return false;
      if (rangeTo && paymentDate > rangeTo) return false;
      return true;
    })
    .sort((a, b) => {
      // Parse dates safely
      const dateA = parseMMDDYY(a.datePaid);
      const dateB = parseMMDDYY(b.datePaid);
      
      // Handle missing/invalid dates - send to bottom
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // a goes to bottom
      if (!dateB) return -1; // b goes to bottom
      
      // Sort newest first (descending)
      return dateB.getTime() - dateA.getTime();
    });

  if (laborerPayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="bookkeeping-empty-state">No payments in date range</td></tr>`;
    return;
  }

  if (mobile) {
    // Mobile: tappable rows, formatted dates, consistent typography, 3-column layout
    tbody.innerHTML = laborerPayments.map(p => `
      <tr class="bookkeeping-payment-row-mobile" data-payment-id="${p.id}" style="cursor: pointer;">
        <td class="bookkeeping-payment-cell bookkeeping-payment-date" style="padding: 12px; border-bottom: 1px solid var(--border);">
          ${escapeHtml(formatDateShort(p.datePaid))}
        </td>
        <td class="bookkeeping-payment-cell bookkeeping-payment-amount bookkeeping-num" style="padding: 12px; border-bottom: 1px solid var(--border); text-align: right;">
          ${money(p.amount || 0)}
        </td>
        <td class="bookkeeping-payment-cell bookkeeping-payment-method" style="padding: 12px; border-bottom: 1px solid var(--border);">
          ${escapeHtml(p.method || "")}
        </td>
      </tr>
    `).join("");
    
    // Add click handlers for mobile rows
    tbody.querySelectorAll(".bookkeeping-payment-row-mobile").forEach(row => {
      row.addEventListener("click", (e) => {
        const paymentId = row.dataset.paymentId;
        openEditPaymentModal(paymentId);
      });
    });
  } else {
    // Desktop: full table with all columns, proper alignment, formatted dates
    tbody.innerHTML = laborerPayments.map(p => `
      <tr>
        <td class="bookkeeping-payment-date-desktop" style="padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top;">${escapeHtml(formatDateShort(p.datePaid || ""))}</td>
        <td class="bookkeeping-num bookkeeping-payment-amount-desktop" style="padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: right; vertical-align: top;">${money(p.amount || 0)}</td>
        <td class="bookkeeping-payment-method-desktop" style="padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top;">${escapeHtml(p.method || "")}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top;">${escapeHtml(p.memo || "")}</td>
        <td class="bookkeeping-num" style="padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: right; vertical-align: top;">
          <button type="button" class="btn bookkeeping-btn-danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="window.deletePayment('${p.id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  }
}

// Make deletePayment available globally for onclick handlers
window.deletePayment = deletePayment;

// Open edit payment modal (mobile only)
function openEditPaymentModal(paymentId) {
  if (!isMobile()) return; // Only on mobile
  
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    showMessage("Payment not found", true);
    return;
  }

  // Populate form
  $("editPaymentId").value = payment.id;
  $("editPaymentDate").value = payment.datePaid || "";
  $("editPaymentAmount").value = payment.amount || "";
  $("editPaymentMethod").value = payment.method || "";
  $("editPaymentMemo").value = payment.memo || "";

  // Show modal
  const modal = $("paymentEditModal");
  if (modal) {
    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  }
}

// Close edit payment modal
function closeEditPaymentModal() {
  const modal = $("paymentEditModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = ""; // Restore scrolling
  }
  
  // Clear form
  $("editPaymentId").value = "";
  $("editPaymentDate").value = "";
  $("editPaymentAmount").value = "";
  $("editPaymentMethod").value = "";
  $("editPaymentMemo").value = "";
}

// Update payment
async function updatePayment() {
  if (!currentUid || !selectedLaborerId) {
    showMessage("Please select a laborer first", true);
    return;
  }

  const paymentId = $("editPaymentId")?.value;
  if (!paymentId) {
    showMessage("Payment ID missing", true);
    return;
  }

  const datePaid = $("editPaymentDate")?.value;
  const amount = parseFloat($("editPaymentAmount")?.value || 0);
  const method = $("editPaymentMethod")?.value || "";
  const memo = ($("editPaymentMemo")?.value || "").trim() || null;

  if (!datePaid) {
    showMessage("Payment date is required", true);
    return;
  }
  if (!amount || amount <= 0) {
    showMessage("Payment amount must be greater than 0", true);
    return;
  }
  if (!method) {
    showMessage("Payment method is required", true);
    return;
  }

  try {
    const paymentRef = doc(db, "users", currentUid, "payments", paymentId);
    await updateDoc(paymentRef, {
      datePaid,
      amount,
      method,
      memo,
      updatedAt: serverTimestamp()
    });

    await loadPayments();
    closeEditPaymentModal();
    showMessage("Payment updated successfully");
  } catch (err) {
    console.error("Error updating payment:", err);
    showMessage("Error updating payment: " + (err.message || "Unknown error"), true);
  }
}

// Delete payment from modal
async function deletePaymentFromModal() {
  const paymentId = $("editPaymentId")?.value;
  if (!paymentId) {
    showMessage("Payment ID missing", true);
    return;
  }

  if (!confirm("Are you sure you want to delete this payment?")) {
    return;
  }

  try {
    const paymentRef = doc(db, "users", currentUid, "payments", paymentId);
    await deleteDoc(paymentRef);
    await loadPayments();
    closeEditPaymentModal();
    showMessage("Payment deleted successfully");
  } catch (err) {
    console.error("Error deleting payment:", err);
    showMessage("Error deleting payment: " + (err.message || "Unknown error"), true);
  }
}

/* -----------------------------
   Summaries
------------------------------ */
function updateSummaries() {
  // Helper function to parse MM/DD/YY date format
  function parseMMDDYY(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle ISO date string (YYYY-MM-DD)
      if (dateStr.includes("-")) {
        return new Date(dateStr);
      }
      
      // Handle MM/DD/YY format
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
          const day = parseInt(parts[1], 10);
          let year = parseInt(parts[2], 10);
          
          // Convert 2-digit year to 4-digit (00-69 => 2000-2069, 70-99 => 1970-1999)
          if (year < 70) {
            year += 2000;
          } else if (year < 100) {
            year += 1900;
          }
          
          return new Date(year, month, day);
        }
      }
      
      // Fallback: try Date constructor
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (err) {
      console.warn("Error parsing date:", dateStr, err);
    }
    
    return null;
  }

  // Filter payments by date range
  const filteredPayments = payments.filter(p => {
    // Parse dates before comparison to handle MM/DD/YY and ISO formats
    const paymentDate = parseMMDDYY(p.datePaid);
    const rangeFrom = dateRangeFrom ? parseMMDDYY(dateRangeFrom) : null;
    const rangeTo = dateRangeTo ? parseMMDDYY(dateRangeTo) : null;
    
    // Handle invalid/missing dates - exclude from range if date can't be parsed
    if (!paymentDate) return false;
    
    if (rangeFrom && paymentDate < rangeFrom) return false;
    if (rangeTo && paymentDate > rangeTo) return false;
    return true;
  });

  // Total paid in date range
  const totalPaid = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalPaidEl = $("summaryTotalPaid");
  if (totalPaidEl) totalPaidEl.textContent = money(totalPaid);

  // Laborers paid in date range
  const uniqueLaborers = new Set(filteredPayments.map(p => p.laborerId).filter(Boolean));
  const laborersPaidEl = $("summaryLaborersPaid");
  if (laborersPaidEl) laborersPaidEl.textContent = uniqueLaborers.size;

  // YTD total
  const yearStart = yearStartISO();
  const yearStartDate = parseMMDDYY(yearStart);
  const ytdPayments = payments.filter(p => {
    const paymentDate = parseMMDDYY(p.datePaid);
    if (!paymentDate || !yearStartDate) return false;
    return paymentDate >= yearStartDate;
  });
  const ytdTotal = ytdPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const ytdTotalEl = $("summaryYtdPaid");
  if (ytdTotalEl) ytdTotalEl.textContent = money(ytdTotal);
}

/* -----------------------------
   Date Range
------------------------------ */
function updateDateRange() {
  dateRangeFrom = $("dateRangeFrom")?.value || monthStartISO();
  dateRangeTo = $("dateRangeTo")?.value || todayISO();
  updateSummaries();
  if (selectedLaborerId) {
    renderPayments();
  }
}

function resetDateRange() {
  dateRangeFrom = monthStartISO();
  dateRangeTo = todayISO();
  if ($("dateRangeFrom")) $("dateRangeFrom").value = dateRangeFrom;
  if ($("dateRangeTo")) $("dateRangeTo").value = dateRangeTo;
  updateDateRange();
}

/* -----------------------------
   Initialize
------------------------------ */
function init() {
  // Set default dates
  if ($("dateRangeFrom")) $("dateRangeFrom").value = monthStartISO();
  if ($("dateRangeTo")) $("dateRangeTo").value = todayISO();
  if ($("paymentDate")) $("paymentDate").value = todayISO();

  // Event listeners
  const addLaborerBtn = $("addLaborerBtn");
  if (addLaborerBtn) {
    addLaborerBtn.addEventListener("click", () => {
      // Navigate to Employee Management to add new laborer
      window.location.href = "../employees/employees.html";
    });
  }

  const editLaborerBtn = $("editLaborerBtn");
  if (editLaborerBtn) {
    editLaborerBtn.addEventListener("click", () => {
      const laborerId = $("laborerId")?.value;
      if (laborerId) {
        window.location.href = `../employees/employees.html?laborerId=${encodeURIComponent(laborerId)}`;
      } else {
        showMessage("No laborer selected", true);
      }
    });
  }

  const laborerSearch = $("laborerSearch");
  if (laborerSearch) {
    laborerSearch.addEventListener("input", renderLaborersList);
  }

  // W9 and COI upload removed - now handled in Employee Management

  const addPaymentBtn = $("addPaymentBtn");
  if (addPaymentBtn) {
    addPaymentBtn.addEventListener("click", addPayment);
  }

  // Payment form collapse/expand toggle (mobile only)
  const paymentFormToggle = $("paymentFormToggle");
  const paymentFormContainer = $("paymentFormContainer");
  if (paymentFormToggle && paymentFormContainer) {
    // Check if we're on mobile (window width <= 768px)
    function isMobile() {
      return window.innerWidth <= 768;
    }
    
    // Set initial state: collapsed on mobile, expanded on desktop
    function updateFormState() {
      if (isMobile()) {
        // On mobile, check localStorage for user preference, default to collapsed
        const userPreference = localStorage.getItem("bookkeeping_payment_form_collapsed");
        const shouldCollapse = userPreference === null ? true : userPreference === "true";
        
        if (shouldCollapse) {
          paymentFormContainer.classList.add("collapsed");
          paymentFormToggle.setAttribute("aria-expanded", "false");
        } else {
          paymentFormContainer.classList.remove("collapsed");
          paymentFormToggle.setAttribute("aria-expanded", "true");
        }
      } else {
        // On desktop, always expanded
        paymentFormContainer.classList.remove("collapsed");
        paymentFormToggle.setAttribute("aria-expanded", "true");
      }
    }
    
    // Initial state
    updateFormState();
    
    // Update on resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateFormState, 100);
    });
    
    // Toggle on click
    paymentFormToggle.addEventListener("click", () => {
      const isCollapsed = paymentFormContainer.classList.contains("collapsed");
      if (isCollapsed) {
        paymentFormContainer.classList.remove("collapsed");
        paymentFormToggle.setAttribute("aria-expanded", "true");
        localStorage.setItem("bookkeeping_payment_form_collapsed", "false");
      } else {
        paymentFormContainer.classList.add("collapsed");
        paymentFormToggle.setAttribute("aria-expanded", "false");
        localStorage.setItem("bookkeeping_payment_form_collapsed", "true");
      }
    });
  }

  const dateRangeFromInput = $("dateRangeFrom");
  const dateRangeToInput = $("dateRangeTo");
  if (dateRangeFromInput) dateRangeFromInput.addEventListener("change", updateDateRange);
  if (dateRangeToInput) dateRangeToInput.addEventListener("change", updateDateRange);

  const resetDateRangeBtn = $("resetDateRangeBtn");
  if (resetDateRangeBtn) {
    resetDateRangeBtn.addEventListener("click", resetDateRange);
  }
  
  // Payment edit modal event listeners (mobile only)
  const paymentEditModalClose = $("paymentEditModalClose");
  if (paymentEditModalClose) {
    paymentEditModalClose.addEventListener("click", closeEditPaymentModal);
  }
  
  const paymentEditCancelBtn = $("editPaymentCancelBtn");
  if (paymentEditCancelBtn) {
    paymentEditCancelBtn.addEventListener("click", closeEditPaymentModal);
  }
  
  const paymentEditForm = $("paymentEditForm");
  if (paymentEditForm) {
    paymentEditForm.addEventListener("submit", (e) => {
      e.preventDefault();
      updatePayment();
    });
  }
  
  const paymentEditDeleteBtn = $("editPaymentDeleteBtn");
  if (paymentEditDeleteBtn) {
    paymentEditDeleteBtn.addEventListener("click", () => {
      deletePaymentFromModal();
    });
  }
  
  // Close modal when clicking overlay
  const paymentEditModal = $("paymentEditModal");
  if (paymentEditModal) {
    const overlay = paymentEditModal.querySelector(".bookkeeping-payment-modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", closeEditPaymentModal);
    }
  }
  
  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && paymentEditModal && paymentEditModal.style.display === "block") {
      closeEditPaymentModal();
    }
  });
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        // Unsubscribe from listeners when user logs out
        if (laborersUnsubscribe) {
          laborersUnsubscribe();
          laborersUnsubscribe = null;
        }
        
        currentUid = null;
        laborers = [];
        payments = [];
        selectedLaborerId = null;
        renderLaborersList();
        $("laborerDetailPanel").style.display = "none";
        if ($("statusText")) {
          $("statusText").textContent = "Please log in to use Bookkeeping.";
          $("statusText").style.display = "block";
        }
        return;
      }
      
      currentUid = user.uid;
      if ($("statusText")) {
        $("statusText").textContent = "Loading…";
        $("statusText").style.display = "block";
      }
      
      await Promise.all([
        loadLaborers(),
        loadPayments()
      ]);
      
      if ($("statusText")) $("statusText").style.display = "none";
    } catch (err) {
      console.error(err);
      if ($("statusText")) {
        $("statusText").textContent = "Error";
        $("statusText").style.display = "block";
      }
      showMessage("Firebase error. Check config.js and Firestore rules.", true);
    }
  });
  
  // Reload laborers when page becomes visible (e.g., returning from Employee Management)
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden && currentUid) {
      // Page became visible, reload laborers to sync with Employee Management changes
      await loadLaborers();
    }
  });
  
  // Also reload on focus (for better mobile support)
  window.addEventListener("focus", async () => {
    if (currentUid) {
      await loadLaborers();
    }
  });
  
  // Parse URL parameters for deep-linking
  parseUrlParams();
}

// Parse URL parameters for deep-linking to specific laborer
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const laborerId = urlParams.get("laborerId");
  const focus = urlParams.get("focus");
  
  if (laborerId) {
    pendingLaborerId = laborerId;
    pendingFocus = focus;
  }
}

// Handle pending laborer selection from URL params
function handlePendingLaborerSelection() {
  if (!pendingLaborerId) return;
  
  const laborer = laborers.find(l => l.id === pendingLaborerId);
  
  if (laborer) {
    // Laborer found - select it
    selectLaborer(pendingLaborerId, pendingFocus);
    // Clear pending state
    pendingLaborerId = null;
    pendingFocus = null;
    
    // Clean up URL (remove params) without reloading page
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location);
      url.searchParams.delete("laborerId");
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", url);
    }
  } else {
    // Laborer not found - show message
    showMessage("Laborer not found. The laborer may have been removed.", true);
    // Clear pending state
    pendingLaborerId = null;
    pendingFocus = null;
  }
}

// Start initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
