// 1099.js
// 1099-NEC Generator for laborers/subcontractors
// Uses payment history from bookkeeping and W9 info from employees

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { db, auth, storage } from "../config.js";
import { loadUserProfile, saveUserProfile, formatAddress } from "../profile-utils.js";

/* -----------------------------
   Helpers
------------------------------ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

let currentUid = null;
let laborers = [];
let payments = [];
let selectedLaborerId = null;
let selectedTaxYear = null;
let payerInfo = null;
let generatedForms = [];
let isLoadingLaborers = false;

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

function taxProfileDoc() {
  if (!currentUid) throw new Error("Not authenticated");
  return doc(db, "users", currentUid, "taxProfile", "main");
}

function taxForms1099Col(taxYear) {
  if (!currentUid) throw new Error("Not authenticated");
  return collection(db, "users", currentUid, "taxForms1099", taxYear.toString(), "forms");
}

/* -----------------------------
   Load Data
------------------------------ */
async function loadLaborers() {
  if (!currentUid) return;
  isLoadingLaborers = true;
  renderLaborersList(); // Show loading state
  try {
    const q = query(laborersCol(), orderBy("displayName", "asc"));
    const snap = await getDocs(q);
    laborers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    isLoadingLaborers = false;
    renderLaborersList();
  } catch (err) {
    console.error("Error loading laborers:", err);
    isLoadingLaborers = false;
    renderLaborersList();
    showMessage("Error loading laborers", true);
  }
}

async function loadPayments() {
  if (!currentUid) return;
  try {
    const q = query(paymentsCol(), orderBy("datePaid", "desc"));
    const snap = await getDocs(q);
    payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading payments:", err);
    showMessage("Error loading payments", true);
  }
}

async function loadPayerInfo() {
  if (!currentUid) return;
  try {
    // First, try to load from standardized user profile
    const userProfile = await loadUserProfile(currentUid);
    
    // Also check legacy taxProfile doc for backward compatibility
    const taxProfileSnap = await getDoc(taxProfileDoc());
    const legacyPayerInfo = taxProfileSnap.exists() ? taxProfileSnap.data() : null;
    
    // Prefer user profile if it exists, otherwise use legacy taxProfile
    if (userProfile && (userProfile.companyName || userProfile.email)) {
      // Convert user profile to payer info format
      payerInfo = {
        businessName: userProfile.companyName || legacyPayerInfo?.businessName || "",
        phone: userProfile.phoneNumber || legacyPayerInfo?.phone || "",
        address: userProfile.address?.street || legacyPayerInfo?.address || "",
        city: userProfile.address?.city || legacyPayerInfo?.city || "",
        state: userProfile.address?.state || legacyPayerInfo?.state || "",
        zip: userProfile.address?.zip || legacyPayerInfo?.zip || "",
        // TIN: only include if it exists and is non-empty (per requirements)
        tin: (userProfile.taxpayerId && userProfile.taxpayerId.trim() !== "") 
          ? userProfile.taxpayerId 
          : (legacyPayerInfo?.tin && legacyPayerInfo.tin.trim() !== "" ? legacyPayerInfo.tin : "")
      };
      
      // If we have profile data but no legacy taxProfile, we can optionally save it to taxProfile for backward compatibility
      // But we'll use profile as source of truth going forward
    } else if (legacyPayerInfo) {
      // Fall back to legacy taxProfile
      payerInfo = legacyPayerInfo;
    } else {
      payerInfo = null;
    }
    
    // Populate form with payer info (even if some fields are empty)
    populatePayerForm();
    $("payerInfoCard").style.display = "block";
    
    // On mobile, collapse payer info if it exists
    if (isMobile() && payerInfo && payerInfo.businessName) {
      collapsePayerInfo();
    } else {
      // On desktop or if no payer info, ensure form is visible
      const form = $("payerInfoForm");
      if (form) form.classList.remove("collapsed");
      const summary = $("payerInfoSummary");
      if (summary && !isMobile()) summary.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading payer info:", err);
  }
}

async function loadGeneratedForms() {
  if (!currentUid || !selectedTaxYear) return;
  try {
    const q = query(taxForms1099Col(selectedTaxYear), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    generatedForms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFormsHistory();
  } catch (err) {
    console.error("Error loading generated forms:", err);
  }
}

/* -----------------------------
   UI Rendering
------------------------------ */
function populateTaxYearSelect() {
  const select = $("taxYear");
  if (!select) return;
  
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5; // Allow last 5 years
  
  select.innerHTML = '<option value="">Select tax year</option>';
  for (let year = currentYear; year >= startYear; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentYear) option.selected = true;
    select.appendChild(option);
  }
}

function renderLaborersList() {
  const container = $("laborersList");
  if (!container) return;
  
  // Show loading state only while actually loading
  if (isLoadingLaborers) {
    container.innerHTML = '<div class="muted" style="padding: 20px; text-align: center;">Loading laborers...</div>';
    return;
  }
  
  const searchTerm = ($("laborerSearch")?.value || "").toLowerCase();
  const filtered = laborers.filter(l => {
    if (!searchTerm) return true;
    const name = (l.displayName || "").toLowerCase();
    return name.includes(searchTerm);
  });
  
  if (filtered.length === 0) {
    const yearText = selectedTaxYear ? ` for ${selectedTaxYear}` : "";
    container.innerHTML = `<div class="muted" style="padding: 20px; text-align: center;">No laborers found${yearText}.</div>`;
    return;
  }
  
  container.innerHTML = filtered.map(laborer => {
    const typeLabel = laborer.laborerType === "Subcontractor" ? "Subcontractor" : "Worker";
    return `
      <div class="laborer-card" data-laborer-id="${laborer.id}" style="
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--panel);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(laborer.displayName || "—")}</div>
            <div class="muted small">${typeLabel}</div>
          </div>
          <i class="bx bx-chevron-right" style="font-size: 1.5rem; color: var(--muted);"></i>
        </div>
      </div>
    `;
  }).join("");
  
  // Attach click handlers
  container.querySelectorAll(".laborer-card").forEach(card => {
    card.addEventListener("click", () => {
      const laborerId = card.dataset.laborerId;
      selectLaborer(laborerId);
    });
  });
}

function selectLaborer(laborerId) {
  selectedLaborerId = laborerId;
  const laborer = laborers.find(l => l.id === laborerId);
  if (!laborer) return;
  
  $("laborerSelectionCard").style.display = "none";
  $("laborerDetailsCard").style.display = "block";
  
  $("selectedLaborerName").textContent = laborer.displayName || "—";
  $("selectedLaborerType").textContent = laborer.laborerType || "—";
  
  renderW9Info(laborer);
  renderPaymentSummary(laborerId);
}

function renderW9Info(laborer) {
  const container = $("w9InfoDisplay");
  const warning = $("w9MissingWarning");
  
  if (!container) return;
  
  // Check if W9 info exists (either in w9Info subdocument or in documents.w9)
  const w9Info = laborer.w9Info || {};
  const hasW9Doc = laborer.documents?.w9?.downloadURL;
  
  // Check if we have minimum required fields
  const hasRequiredFields = w9Info.legalName || laborer.displayName;
  const hasAddress = w9Info.addressLine1 || laborer.address;
  const hasTIN = w9Info.tinLast4 || laborer.tinLast4;
  
  if (!hasRequiredFields || !hasAddress) {
    container.innerHTML = '<div class="muted">W-9 information incomplete. Please update in Employee Management.</div>';
    if (warning) warning.style.display = "block";
    $("generate1099Btn").disabled = true;
    return;
  }
  
  if (warning) warning.style.display = "none";
  
  // Display W9 info
  const legalName = w9Info.legalName || laborer.displayName || "—";
  const businessName = w9Info.businessName || "";
  const addressLine1 = w9Info.addressLine1 || laborer.address?.split("\n")[0] || "—";
  const addressLine2 = w9Info.addressLine2 || "";
  const city = w9Info.city || "";
  const state = w9Info.state || "";
  const zip = w9Info.zip || "";
  const fullAddress = [addressLine1, addressLine2, city, state, zip].filter(Boolean).join(", ");
  const tinDisplay = w9Info.tinLast4 ? `*****${w9Info.tinLast4}` : (laborer.tinLast4 ? `*****${laborer.tinLast4}` : "—");
  const tinType = w9Info.tinType || "SSN";
  
  container.innerHTML = `
    <div class="info-grid" style="display: grid; grid-template-columns: auto 1fr; gap: 12px 16px; align-items: start;">
      <div class="info-label" style="font-weight: 600; color: var(--muted);">Legal Name:</div>
      <div class="info-value">${escapeHtml(legalName)}</div>
      ${businessName ? `
        <div class="info-label" style="font-weight: 600; color: var(--muted);">Business Name:</div>
        <div class="info-value">${escapeHtml(businessName)}</div>
      ` : ""}
      <div class="info-label" style="font-weight: 600; color: var(--muted);">Address:</div>
      <div class="info-value">${escapeHtml(fullAddress)}</div>
      <div class="info-label" style="font-weight: 600; color: var(--muted);">TIN Type:</div>
      <div class="info-value">${escapeHtml(tinType)}</div>
      <div class="info-label" style="font-weight: 600; color: var(--muted);">TIN (Last 4):</div>
      <div class="info-value">${escapeHtml(tinDisplay)}</div>
      ${hasW9Doc ? `
        <div class="info-label" style="font-weight: 600; color: var(--muted);">W-9 Document:</div>
        <div class="info-value">
          <a href="${laborer.documents.w9.downloadURL}" target="_blank" class="btn small ghost">View W-9 PDF</a>
        </div>
      ` : ""}
    </div>
  `;
  
  // Enable generate button if we have required info
  if (hasRequiredFields && hasAddress) {
    $("generate1099Btn").disabled = false;
  }
}

function renderPaymentSummary(laborerId) {
  if (!selectedTaxYear) return;
  
  const yearPayments = payments.filter(p => {
    if (p.laborerId !== laborerId) return false;
    const paymentDate = p.datePaid ? new Date(p.datePaid) : null;
    if (!paymentDate) return false;
    return paymentDate.getFullYear() === parseInt(selectedTaxYear);
  });
  
  const total = yearPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  $("summaryTaxYear").textContent = selectedTaxYear;
  $("totalCompensation").textContent = formatCurrency(total);
  
  // Render payment table
  const tbody = $("paymentsTableBody");
  const noPaymentsMsg = $("noPaymentsMessage");
  
  if (yearPayments.length === 0) {
    if (tbody) tbody.innerHTML = "";
    if (noPaymentsMsg) noPaymentsMsg.style.display = "block";
    $("generate1099Btn").disabled = true;
    return;
  }
  
  if (noPaymentsMsg) noPaymentsMsg.style.display = "none";
  
  if (tbody) {
    tbody.innerHTML = yearPayments.map(p => {
      const date = p.datePaid ? formatDate(p.datePaid) : "—";
      const amount = formatCurrency(p.amount || 0);
      const method = p.method || "—";
      const memo = p.memo || "—";
      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(amount)}</td>
          <td>${escapeHtml(method)}</td>
          <td>${escapeHtml(memo)}</td>
        </tr>
      `;
    }).join("");
  }
  
  // Store payments for PDF generation
  window.selectedYearPayments = yearPayments;
  window.selectedYearTotal = total;
}

function renderFormsHistory() {
  const container = $("formsHistory");
  if (!container) return;
  
  if (generatedForms.length === 0) {
    container.innerHTML = '<div class="muted" style="padding: 20px; text-align: center;" data-i18n="1099.noForms">No forms generated yet for this tax year.</div>';
    $("historyCard").style.display = "none";
    // Apply translations to newly added element
    if (typeof window.applyTranslations === 'function') {
      const lang = document.documentElement.lang || 'en';
      window.applyTranslations(lang);
    }
    return;
  }
  
  $("historyCard").style.display = "block";
  
  container.innerHTML = generatedForms.map(form => {
    const createdAt = form.createdAt?.toDate ? form.createdAt.toDate().toLocaleString() : "—";
    return `
      <div class="form-history-item" style="
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      ">
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(form.payeeName || "—")}</div>
          <div class="muted small">Generated: ${escapeHtml(createdAt)}</div>
          <div class="muted small">Amount: ${escapeHtml(formatCurrency(form.totalAmount || 0))}</div>
        </div>
        <div>
          <a href="${form.pdfDownloadURL}" target="_blank" class="btn small primary" download data-i18n="1099.download">Download PDF</a>
        </div>
      </div>
    `;
  }).join("");
  
  // Apply translations to newly added elements
  if (typeof window.applyTranslations === 'function') {
    const lang = document.documentElement.lang || 'en';
    window.applyTranslations(lang);
  }
}

function populatePayerForm() {
  // Always populate form fields, even if payerInfo is null (will be empty strings)
  if (!payerInfo) {
    payerInfo = {};
  }
  
  $("payerBusinessName").value = payerInfo.businessName || "";
  // TIN: Only prefill if it exists and is non-empty (per requirements)
  $("payerTIN").value = (payerInfo.tin && payerInfo.tin.trim() !== "") ? payerInfo.tin : "";
  $("payerAddress").value = payerInfo.address || "";
  $("payerCity").value = payerInfo.city || "";
  $("payerState").value = payerInfo.state || "";
  $("payerZip").value = payerInfo.zip || "";
  $("payerPhone").value = payerInfo.phone || "";
  
  // Update summary display
  updatePayerSummary();
}

function updatePayerSummary() {
  const summaryName = $("payerSummaryName");
  const summaryDetails = $("payerSummaryDetails");
  
  if (!summaryName || !summaryDetails) return;
  
  if (payerInfo && payerInfo.businessName) {
    summaryName.textContent = payerInfo.businessName;
    
    // Build details: EIN/SSN last 4 + city, state
    const tin = payerInfo.tin || "";
    const tinLast4 = tin.length >= 4 ? tin.slice(-4) : "";
    const location = [payerInfo.city, payerInfo.state].filter(Boolean).join(", ");
    
    const details = [];
    if (tinLast4) {
      details.push(`TIN: ••••${tinLast4}`);
    }
    if (location) {
      details.push(location);
    }
    
    summaryDetails.textContent = details.length > 0 ? details.join(" • ") : "—";
  } else {
    summaryName.textContent = "—";
    summaryDetails.textContent = "—";
  }
}

function isMobile() {
  return window.innerWidth <= 1023;
}

function expandPayerInfo() {
  const form = $("payerInfoForm");
  const summary = $("payerInfoSummary");
  const toggleBtn = $("togglePayerInfoBtn");
  const toggleText = $("togglePayerInfoText");
  const collapseBtn = $("collapsePayerInfoBtn");
  
  if (!form) return;
  
  form.classList.remove("collapsed");
  if (summary && isMobile()) summary.style.display = "none";
  if (toggleBtn && isMobile()) toggleBtn.style.display = "none";
  if (collapseBtn && isMobile()) collapseBtn.style.display = "inline-flex";
}

function collapsePayerInfo() {
  const form = $("payerInfoForm");
  const summary = $("payerInfoSummary");
  const toggleBtn = $("togglePayerInfoBtn");
  const toggleText = $("togglePayerInfoText");
  const collapseBtn = $("collapsePayerInfoBtn");
  
  if (!form) return;
  
  // Only collapse on mobile
  if (!isMobile()) return;
  
  form.classList.add("collapsed");
  if (summary && payerInfo && payerInfo.businessName) {
    summary.style.display = "block";
  }
  if (toggleBtn) {
    toggleBtn.style.display = "inline-flex";
    if (toggleText) toggleText.textContent = "Edit";
  }
  if (collapseBtn) collapseBtn.style.display = "none";
}

function togglePayerInfo() {
  const form = $("payerInfoForm");
  if (!form) return;
  
  if (form.classList.contains("collapsed")) {
    expandPayerInfo();
  } else {
    collapsePayerInfo();
  }
}

/* -----------------------------
   Save Payer Info
------------------------------ */
async function savePayerInfo() {
  if (!currentUid) {
    showMessage("Please sign in first", true);
    return;
  }
  
  const businessName = $("payerBusinessName").value.trim();
  const tin = $("payerTIN").value.trim(); // Optional - can be empty
  const address = $("payerAddress").value.trim();
  const city = $("payerCity").value.trim();
  const state = $("payerState").value.trim();
  const zip = $("payerZip").value.trim();
  const phone = $("payerPhone").value.trim();
  
  // TIN is optional, but other fields are required
  if (!businessName || !address || !city || !state || !zip) {
    showMessage("Please fill in all required fields (TIN is optional)", true);
    return;
  }
  
  try {
    const btn = $("savePayerInfoBtn");
    if (btn) btn.disabled = true;
    
    // Load existing profile to merge
    const existingProfile = await loadUserProfile(currentUid) || {};
    
    // Update standardized user profile
    await saveUserProfile(currentUid, {
      ...existingProfile,
      companyName: businessName,
      phoneNumber: phone || existingProfile.phoneNumber,
      address: {
        street: address,
        city,
        state,
        zip
      },
      // Only update taxpayerId if TIN is provided
      taxpayerId: tin || existingProfile.taxpayerId || null
    });
    
    // Also update legacy taxProfile doc for backward compatibility
    const data = {
      businessName,
      tin: tin || null, // Save null if empty
      address,
      city,
      state,
      zip,
      phone: phone || null,
      updatedAt: serverTimestamp()
    };
    
    const docRef = taxProfileDoc();
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await updateDoc(docRef, data);
    } else {
      data.createdAt = serverTimestamp();
      await setDoc(docRef, data);
    }
    
    payerInfo = data;
    updatePayerSummary();
    showMessage("Payer information saved successfully!", false);
    
    // On mobile, collapse payer info after saving
    if (isMobile()) {
      setTimeout(() => {
        collapsePayerInfo();
      }, 500); // Small delay to show success message
    }
    
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error("Error saving payer info:", err);
    showMessage("Error saving payer information: " + (err.message || "Unknown error"), true);
    const btn = $("savePayerInfoBtn");
    if (btn) btn.disabled = false;
  }
}

/* -----------------------------
   Generate 1099-NEC PDF
------------------------------ */
async function generate1099PDF() {
  if (!currentUid || !selectedLaborerId || !selectedTaxYear) {
    showMessage("Please select a tax year and laborer", true);
    return;
  }
  
  const laborer = laborers.find(l => l.id === selectedLaborerId);
  if (!laborer) {
    showMessage("Laborer not found", true);
    return;
  }
  
  // Validate payer info
  if (!payerInfo || !payerInfo.businessName || !payerInfo.tin) {
    showMessage("Please save your payer information first", true);
    return;
  }
  
  // Validate W9 info
  const w9Info = laborer.w9Info || {};
  const hasRequiredFields = w9Info.legalName || laborer.displayName;
  const hasAddress = w9Info.addressLine1 || laborer.address;
  
  if (!hasRequiredFields || !hasAddress) {
    showMessage("Laborer W-9 information is incomplete. Please update in Employee Management.", true);
    return;
  }
  
  try {
    const btn = $("generate1099Btn");
    if (btn) btn.disabled = true;
    
    showMessage("Generating 1099-NEC PDF...", false);
    
    // Get payment data
    const yearPayments = window.selectedYearPayments || [];
    const totalAmount = window.selectedYearTotal || 0;
    
    if (yearPayments.length === 0 || totalAmount === 0) {
      showMessage("No payments found for this laborer in the selected tax year", true);
      if (btn) btn.disabled = false;
      return;
    }
    
    // Generate PDF
    const pdfBlob = await create1099PDF(laborer, payerInfo, selectedTaxYear, totalAmount);
    
    // Upload to Storage
    const timestamp = Date.now();
    const safeName = (laborer.displayName || "laborer").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const storagePath = `users/${currentUid}/taxForms/1099nec/${selectedTaxYear}/${safeName}_${timestamp}.pdf`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, pdfBlob, {
      contentType: "application/pdf"
    });
    
    const downloadURL = await getDownloadURL(storageRef);
    
    // Save metadata to Firestore
    const payeeName = w9Info.legalName || laborer.displayName || "—";
    const formData = {
      laborerId: selectedLaborerId,
      payeeName,
      payerName: payerInfo.businessName,
      totalAmount,
      taxYear: parseInt(selectedTaxYear),
      pdfStoragePath: storagePath,
      pdfDownloadURL: downloadURL,
      createdAt: serverTimestamp()
    };
    
    await addDoc(taxForms1099Col(selectedTaxYear), formData);
    
    showMessage("1099-NEC generated and saved successfully!", false);
    
    // Reload history
    await loadGeneratedForms();
    
    // Trigger download
    const link = document.createElement("a");
    link.href = downloadURL;
    link.download = `1099-NEC_${payeeName.replace(/\s+/g, "_")}_${selectedTaxYear}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error("Error generating 1099:", err);
    showMessage("Error generating 1099-NEC: " + (err.message || "Unknown error"), true);
    const btn = $("generate1099Btn");
    if (btn) btn.disabled = false;
  }
}

async function create1099PDF(laborer, payer, taxYear, box1Amount) {
  // Wait for jsPDF to be available
  if (typeof window.jspdf === "undefined") {
    throw new Error("jsPDF library not loaded. Please refresh the page.");
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter"
  });
  
  // 1099-NEC form dimensions (approximate, based on official form)
  const pageWidth = 216; // 8.5 inches in mm
  const pageHeight = 279; // 11 inches in mm
  const margin = 10;
  const left = margin;
  let y = margin;
  
  // Form title
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Form 1099-NEC", left, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("Nonemployee Compensation", left, y);
  y += 12;
  
  // Payer information (Copy B - For Payee)
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("Copy B - For Payee", left, y);
  y += 6;
  
  doc.setFont(undefined, "normal");
  doc.text("PAYER'S name, street address, city, state, ZIP code, and telephone no.", left, y);
  y += 5;
  
  // Payer details
  doc.setFontSize(10);
  doc.text(payer.businessName || "—", left, y);
  y += 5;
  doc.text(payer.address || "—", left, y);
  y += 5;
  const payerCityStateZip = [payer.city, payer.state, payer.zip].filter(Boolean).join(", ");
  doc.text(payerCityStateZip || "—", left, y);
  if (payer.phone) {
    y += 5;
    doc.text(`Phone: ${payer.phone}`, left, y);
  }
  y += 8;
  
  // Payer TIN
  doc.setFontSize(9);
  doc.text("PAYER'S TIN", left, y);
  y += 4;
  doc.setFontSize(10);
  doc.text(payer.tin || "—", left, y);
  y += 8;
  
  // Recipient information
  doc.setFontSize(9);
  doc.text("RECIPIENT'S name", left, y);
  y += 4;
  
  const w9Info = laborer.w9Info || {};
  const payeeName = w9Info.legalName || laborer.displayName || "—";
  const payeeBusinessName = w9Info.businessName || "";
  
  doc.setFontSize(10);
  doc.text(payeeName, left, y);
  y += 5;
  if (payeeBusinessName) {
    doc.text(payeeBusinessName, left, y);
    y += 5;
  }
  
  doc.setFontSize(9);
  doc.text("Street address (including apt. no.)", left, y);
  y += 4;
  
  const addressLine1 = w9Info.addressLine1 || laborer.address?.split("\n")[0] || "—";
  const addressLine2 = w9Info.addressLine2 || "";
  
  doc.setFontSize(10);
  doc.text(addressLine1, left, y);
  y += 5;
  if (addressLine2) {
    doc.text(addressLine2, left, y);
    y += 5;
  }
  
  doc.setFontSize(9);
  doc.text("City, state, and ZIP code", left, y);
  y += 4;
  
  const city = w9Info.city || "";
  const state = w9Info.state || "";
  const zip = w9Info.zip || "";
  const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
  doc.setFontSize(10);
  doc.text(cityStateZip || (laborer.address?.split("\n")[1] || "—"), left, y);
  y += 8;
  
  // Account number (optional)
  doc.setFontSize(9);
  doc.text("Account number (optional)", left, y);
  y += 8;
  
  // Tax year
  doc.setFontSize(9);
  doc.text("Tax year", left, y);
  y += 4;
  doc.setFontSize(10);
  doc.text(taxYear.toString(), left, y);
  y += 8;
  
  // Box 1 - Nonemployee compensation
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("1", left + 2, y);
  doc.setFont(undefined, "normal");
  doc.text("Nonemployee compensation", left + 8, y);
  y += 4;
  
  const amountStr = formatCurrency(box1Amount).replace("$", "");
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text(amountStr, left + 8, y);
  y += 12;
  
  // Recipient's TIN
  doc.setFontSize(9);
  doc.text("RECIPIENT'S TIN", left, y);
  y += 4;
  doc.setFontSize(10);
  // For security, we'll show masked TIN or prompt user to enter full TIN
  // For now, show last 4 if available
  const tinDisplay = w9Info.tinLast4 ? `*****${w9Info.tinLast4}` : (laborer.tinLast4 ? `*****${laborer.tinLast4}` : "—");
  doc.text(tinDisplay, left, y);
  y += 12;
  
  // Footer note
  doc.setFontSize(8);
  doc.text("This is important tax information and is being furnished to the Internal Revenue Service.", left, y);
  y += 4;
  doc.text("If you are required to file a return, a negligence penalty or other sanction may be", left, y);
  y += 4;
  doc.text("imposed on you if this income is taxable and the IRS determines that it has not been reported.", left, y);
  
  return doc.output("blob");
}

/* -----------------------------
   Event Handlers
------------------------------ */

// Handle year selection (called both on init and on change)
function handleYearSelection(year) {
  selectedTaxYear = year;
  if (selectedTaxYear) {
    $("laborerSelectionCard").style.display = "block";
    loadGeneratedForms();
    // Re-render laborers list to show updated empty state if needed
    renderLaborersList();
    if (selectedLaborerId) {
      const laborer = laborers.find(l => l.id === selectedLaborerId);
      if (laborer) renderPaymentSummary(selectedLaborerId);
    }
  } else {
    $("laborerSelectionCard").style.display = "none";
    $("laborerDetailsCard").style.display = "none";
  }
}

function init() {
  // Tax year selector
  const taxYearSelect = $("taxYear");
  if (taxYearSelect) {
    populateTaxYearSelect();
    
    // Set initial year from dropdown (current year is selected by default)
    const initialYear = taxYearSelect.value;
    if (initialYear) {
      // Set selectedTaxYear immediately, but defer UI updates until auth is ready
      selectedTaxYear = initialYear;
    }
    
    taxYearSelect.addEventListener("change", (e) => {
      handleYearSelection(e.target.value);
    });
  }
  
  // Laborer search
  const laborerSearch = $("laborerSearch");
  if (laborerSearch) {
    laborerSearch.addEventListener("input", renderLaborersList);
  }
  
  // Change laborer button
  const changeLaborerBtn = $("changeLaborerBtn");
  if (changeLaborerBtn) {
    changeLaborerBtn.addEventListener("click", () => {
      selectedLaborerId = null;
      $("laborerDetailsCard").style.display = "none";
      $("laborerSelectionCard").style.display = "block";
    });
  }
  
  // Save payer info
  const savePayerBtn = $("savePayerInfoBtn");
  if (savePayerBtn) {
    savePayerBtn.addEventListener("click", savePayerInfo);
  }
  
  // Toggle payer info (mobile)
  const togglePayerBtn = $("togglePayerInfoBtn");
  if (togglePayerBtn) {
    togglePayerBtn.addEventListener("click", togglePayerInfo);
  }
  
  const collapsePayerBtn = $("collapsePayerInfoBtn");
  if (collapsePayerBtn) {
    collapsePayerBtn.addEventListener("click", collapsePayerInfo);
  }
  
  // Make summary clickable to expand
  const payerSummary = $("payerInfoSummary");
  if (payerSummary) {
    payerSummary.addEventListener("click", () => {
      if (isMobile() && payerSummary.style.display !== "none") {
        expandPayerInfo();
      }
    });
    payerSummary.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && isMobile() && payerSummary.style.display !== "none") {
        e.preventDefault();
        expandPayerInfo();
      }
    });
  }
  
  // Handle window resize to show/hide mobile controls
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (!isMobile()) {
        // On desktop, ensure form is always visible
        const form = $("payerInfoForm");
        if (form) form.classList.remove("collapsed");
        const summary = $("payerInfoSummary");
        if (summary) summary.style.display = "none";
        const toggleBtn = $("togglePayerInfoBtn");
        if (toggleBtn) toggleBtn.style.display = "none";
        const collapseBtn = $("collapsePayerInfoBtn");
        if (collapseBtn) collapseBtn.style.display = "none";
      } else if (payerInfo && payerInfo.businessName) {
        // On mobile, collapse if payer info exists
        collapsePayerInfo();
      }
    }, 100);
  });
  
  // Generate 1099
  const generateBtn = $("generate1099Btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", generate1099PDF);
  }
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      await Promise.all([
        loadLaborers(),
        loadPayments(),
        loadPayerInfo()
      ]);
      
      // After data is loaded, initialize year selection UI
      // This ensures laborers are loaded before showing the selection card
      const taxYearSelect = $("taxYear");
      if (taxYearSelect && taxYearSelect.value) {
        // Use the value that was set during populateTaxYearSelect
        handleYearSelection(taxYearSelect.value);
      }
    } else {
      currentUid = null;
      window.location.href = "../login/login.html";
    }
  });
}

/* -----------------------------
   Utility Functions
------------------------------ */
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(message, isError = false) {
  const container = $("messageContainer");
  if (!container) return;
  
  container.innerHTML = `
    <div class="alert ${isError ? "alert-error" : "alert-success"}" style="
      padding: 12px 16px;
      border-radius: var(--radius);
      margin-bottom: 12px;
      ${isError ? "background: rgba(228, 77, 77, 0.1); color: #e44d4d; border: 1px solid rgba(228, 77, 77, 0.3);" : "background: rgba(77, 167, 99, 0.1); color: #4da763; border: 1px solid rgba(77, 167, 99, 0.3);"}
    ">
      ${escapeHtml(message)}
    </div>
  `;
  
  if (!isError) {
    setTimeout(() => {
      container.innerHTML = "";
    }, 5000);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    // Apply translations after scripts.js loads
    setTimeout(() => {
      if (typeof window.applyTranslations === 'function') {
        const lang = document.documentElement.lang || 'en';
        window.applyTranslations(lang);
      }
    }, 200);
  });
} else {
  init();
  // Apply translations after scripts.js loads
  setTimeout(() => {
    if (typeof window.applyTranslations === 'function') {
      const lang = document.documentElement.lang || 'en';
      window.applyTranslations(lang);
    }
  }, 200);
}

