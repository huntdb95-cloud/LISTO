// audit.js
// Insurance Audit Help Tool
// Loads payroll data, manages document uploads, questionnaire, and generates audit packages

import { auth, db, storage } from "../config.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
import { loadUserProfile, formatAddress, getUSStates } from "../profile-utils.js";

const $ = (id) => document.getElementById(id);

const functions = getFunctions();

// State
let currentUid = null;
let currentUser = null; // Firebase Auth user object
let payrollData = []; // Filtered payroll entries
let uploadedFiles = []; // { type, fileName, filePath, downloadURL }
let auditData = null; // Saved audit data
let coiFiles = []; // Subcontractor COI files: { name, url, uploadedAt }

// Helpers
function money(n) {
  const val = Number(n || 0);
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function setMsg(elId, text, isError = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = isError ? "small danger" : "small muted";
}

// Get audit document reference
function getAuditDocRef(uid) {
  return doc(db, "audits", uid);
}

// Collapsible section helpers
function toggleSection(sectionId) {
  const section = $(sectionId);
  if (!section) return;
  
  const isCollapsed = section.classList.contains("collapsed");
  if (isCollapsed) {
    section.classList.remove("collapsed");
  } else {
    section.classList.add("collapsed");
  }
}

function collapseSection(sectionId) {
  const section = $(sectionId);
  if (section) {
    section.classList.add("collapsed");
  }
}

function expandSection(sectionId) {
  const section = $(sectionId);
  if (section) {
    section.classList.remove("collapsed");
  }
}

// Autofill business info from user profile
async function autofillBusinessInfo() {
  if (!currentUid) return;
  
  try {
    const profile = await loadUserProfile(currentUid);
    if (!profile) return;
    
    // Fill read-only fields
    if ($("businessName")) $("businessName").value = profile.companyName || "";
    if ($("businessEmail")) $("businessEmail").value = profile.email || "";
    if ($("phone")) $("phone").value = profile.phoneNumber || "";
    if ($("taxId")) $("taxId").value = profile.taxpayerId || "";
    
    // Fill address fields
    if (profile.address) {
      if ($("businessAddress")) $("businessAddress").value = profile.address.street || "";
      if ($("businessCity")) $("businessCity").value = profile.address.city || "";
      if ($("businessState")) $("businessState").value = profile.address.state || "";
      if ($("businessZip")) $("businessZip").value = profile.address.zip || "";
    }
  } catch (err) {
    console.error("Error autofilling business info:", err);
  }
}

// Save business information
async function saveBusinessInfo() {
  if (!currentUid) {
    setMsg("businessInfoError", "Please sign in first.", true);
    return;
  }
  
  const policyNumber = ($("policyNumber")?.value || "").trim();
  const policyStart = $("policyStart")?.value || "";
  const policyEnd = $("policyEnd")?.value || "";
  const auditorEmail = ($("auditorEmail")?.value || "").trim();
  
  // Validation
  if (!policyNumber || !policyStart || !policyEnd) {
    setMsg("businessInfoError", "Please fill in all required policy fields (Policy Number, Start Date, End Date).", true);
    return;
  }
  
  if (new Date(policyStart) > new Date(policyEnd)) {
    setMsg("businessInfoError", "End date must be on or after start date.", true);
    return;
  }
  
  const btn = $("btnSaveBusinessInfo");
  const oldDisabled = btn?.disabled;
  
  try {
    if (btn) btn.disabled = true;
    setMsg("businessInfoMsg", "Saving...");
    setMsg("businessInfoError", "");
    
    // Get current profile data for snapshot
    const profile = await loadUserProfile(currentUid) || {};
    
    // Save to audits/{uid}
    const auditRef = getAuditDocRef(currentUid);
    await setDoc(auditRef, {
      businessSnapshot: {
        companyName: profile.companyName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
        address: profile.address || {},
        taxpayerId: profile.taxpayerId || ""
      },
      policy: {
        policyNumber,
        startDate: policyStart,
        endDate: policyEnd
      },
      auditorEmail: auditorEmail || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update summary and collapse
    updateBusinessInfoSummary();
    collapseSection("businessInfoSection");
    if ($("businessInfoEditBtn")) $("businessInfoEditBtn").style.display = "inline-block";
    
    setMsg("businessInfoMsg", "Business information saved successfully!");
    setTimeout(() => setMsg("businessInfoMsg", ""), 3000);
  } catch (err) {
    console.error("Error saving business info:", err);
    setMsg("businessInfoError", "Failed to save. Please try again.", true);
  } finally {
    if (btn) btn.disabled = oldDisabled;
  }
}

// Update business info summary
function updateBusinessInfoSummary() {
  const summary = $("businessInfoSummary");
  if (!summary) return;
  
  const policyNumber = $("policyNumber")?.value || "";
  const policyStart = $("policyStart")?.value || "";
  const policyEnd = $("policyEnd")?.value || "";
  const companyName = $("businessName")?.value || "";
  
  if (policyNumber && policyStart && policyEnd) {
    const startDate = new Date(policyStart).toLocaleDateString();
    const endDate = new Date(policyEnd).toLocaleDateString();
    summary.textContent = `${companyName} • Policy: ${policyNumber} • ${startDate} - ${endDate}`;
    summary.style.display = "block";
  }
}

// Audit period validation
function validatePeriod() {
  const start = $("policyStart").value;
  const end = $("policyEnd").value;
  
  if (!start || !end) {
    return false;
  }
  
  if (new Date(start) > new Date(end)) {
    return false;
  }
  
  return true;
}

// Load payroll summary
async function loadPayrollSummary() {
  if (!validatePeriod()) {
    setMsg("payrollStatus", "Please set policy start and end dates first.", true);
    return;
  }
  
  const start = $("policyStart").value;
  const end = $("policyEnd").value;
  
  if (!currentUid) {
    setMsg("payrollStatus", "Please sign in first.");
    return;
  }
  
  setMsg("payrollStatus", "Loading payroll data...");
  
  try {
    // Query payroll entries within date range
    const payrollCol = collection(db, "users", currentUid, "payrollEntries");
    
    // Use a single where clause with orderBy, then filter client-side for the end date
    // This avoids needing a composite index for date range queries
    const q = query(
      payrollCol,
      where("payDate", ">=", start),
      orderBy("payDate", "desc")
    );
    
    const snap = await getDocs(q);
    // Filter for end date client-side (since we can't easily use <= with >= in Firestore without composite index)
    const allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const entries = allEntries.filter(entry => {
      const entryDate = entry.payDate || "";
      return entryDate >= start && entryDate <= end;
    });
    
    // Aggregate by worker and payment type
    const summary = {};
    let grandTotal = 0;
    let grandCount = 0;
    
    entries.forEach(entry => {
      const key = `${entry.employeeName || "Unknown"}|${entry.method || "Unknown"}`;
      if (!summary[key]) {
        summary[key] = {
          worker: entry.employeeName || "Unknown",
          paymentType: entry.method || "Unknown",
          total: 0,
          count: 0
        };
      }
      summary[key].total += Number(entry.amount || 0);
      summary[key].count += 1;
      grandTotal += Number(entry.amount || 0);
      grandCount += 1;
    });
    
    payrollData = Object.values(summary);
    
    // Render table
    const tbody = $("payrollTable").querySelector("tbody");
    tbody.innerHTML = "";
    
    if (payrollData.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="4" class="muted">No payroll entries found in this period.</td>';
      tbody.appendChild(tr);
    } else {
      payrollData.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.worker}</td>
          <td>${row.paymentType}</td>
          <td>${money(row.total)}</td>
          <td>${row.count}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    $("grandTotal").innerHTML = `<b>${money(grandTotal)}</b>`;
    $("grandCount").innerHTML = `<b>${grandCount}</b>`;
    
    setMsg("payrollStatus", `Loaded ${entries.length} entries, ${payrollData.length} unique worker/method combinations.`);
    
    // Update summary and expand section if has data
    updatePayrollSummary();
    if (payrollData.length > 0) {
      expandSection("payrollSection");
    }
  } catch (err) {
    console.error(err);
    setMsg("payrollStatus", "Error loading payroll data. Please check your dates and try again.", true);
  }
}

// Upload documents
async function uploadDocuments() {
  if (!currentUid) {
    setMsg("uploadMsg", "Please sign in first.", true);
    return;
  }
  
  const files = {
    bankStatements: Array.from($("bankStatements").files || []),
    scheduleC: Array.from($("scheduleC").files || []),
    form1096: Array.from($("form1096").files || []),
    form1099: Array.from($("form1099").files || [])
  };
  
  const allFiles = [
    ...files.bankStatements.map(f => ({ file: f, type: "bankStatements" })),
    ...files.scheduleC.map(f => ({ file: f, type: "scheduleC" })),
    ...files.form1096.map(f => ({ file: f, type: "form1096" })),
    ...files.form1099.map(f => ({ file: f, type: "form1099" }))
  ];
  
  if (allFiles.length === 0) {
    setMsg("uploadMsg", "Please select at least one file.", true);
    return;
  }
  
  $("btnUploadDocs").disabled = true;
  setMsg("uploadMsg", `Uploading ${allFiles.length} file(s)...`);
  
  try {
    const uploadPromises = allFiles.map(async ({ file, type }) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const timestamp = Date.now();
      const path = `users/${currentUid}/audit/${timestamp}_${safeName}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream"
      });
      
      const downloadURL = await getDownloadURL(storageRef);
      
      return {
        type,
        fileName: file.name,
        filePath: path,
        downloadURL,
        uploadedAt: timestamp
      };
    });
    
    const uploaded = await Promise.all(uploadPromises);
    uploadedFiles.push(...uploaded);
    
    renderUploadedList();
    setMsg("uploadMsg", `Successfully uploaded ${uploaded.length} file(s).`);
    
    // Clear file inputs
    $("bankStatements").value = "";
    $("scheduleC").value = "";
    $("form1096").value = "";
    $("form1099").value = "";
  } catch (err) {
    console.error(err);
    setMsg("uploadMsg", "Upload failed. Please try again.", true);
  } finally {
    $("btnUploadDocs").disabled = false;
  }
}

function renderUploadedList() {
  const container = $("uploadedList");
  if (!container) return;
  
  if (uploadedFiles.length === 0) {
    container.innerHTML = '<span class="muted">No files uploaded yet.</span>';
    return;
  }
  
  const grouped = uploadedFiles.reduce((acc, file) => {
    if (!acc[file.type]) acc[file.type] = [];
    acc[file.type].push(file);
    return acc;
  }, {});
  
  const typeLabels = {
    bankStatements: "Bank Statements",
    scheduleC: "Schedule C",
    form1096: "Form 1096",
    form1099: "Form 1099"
  };
  
  container.innerHTML = Object.entries(grouped).map(([type, files]) => {
    const label = typeLabels[type] || type;
    const fileList = files.map(f => 
      `<div style="margin: 4px 0;">
        <a href="${f.downloadURL}" target="_blank" style="color: #111; text-decoration: underline;">${f.fileName}</a>
        <button onclick="removeFile('${f.filePath}')" style="margin-left: 8px; padding: 2px 8px; font-size: 11px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer;">Remove</button>
      </div>`
    ).join("");
    return `<div style="margin-bottom: 8px;"><strong>${label}:</strong>${fileList}</div>`;
  }).join("");
}

// Make removeFile available globally
window.removeFile = function(filePath) {
  uploadedFiles = uploadedFiles.filter(f => f.filePath !== filePath);
  renderUploadedList();
};

// Initialize states checkbox grid
function initStatesCheckboxGrid() {
  const container = $("statesCheckboxGrid");
  if (!container) return;
  
  const states = getUSStates();
  container.innerHTML = states.map(state => `
    <label>
      <input type="checkbox" value="${state.code}" class="state-checkbox" />
      <span>${state.name}</span>
    </label>
  `).join("");
}

// Get selected states
function getSelectedStates() {
  const checkboxes = document.querySelectorAll(".state-checkbox:checked");
  return Array.from(checkboxes).map(cb => cb.value);
}

// Set selected states
function setSelectedStates(states) {
  if (!Array.isArray(states)) return;
  const checkboxes = document.querySelectorAll(".state-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = states.includes(cb.value);
  });
}

// Handle subcontractors Yes/No change
function handleSubcontractorsChange() {
  const value = $("qSubcontractors")?.value;
  const coiSection = $("coiUploadSection");
  if (coiSection) {
    coiSection.style.display = value === "yes" ? "block" : "none";
  }
}

// Upload COI files
async function uploadCOIFiles() {
  if (!currentUid) return;
  
  const fileInput = $("coiFiles");
  const files = Array.from(fileInput?.files || []);
  if (files.length === 0) return;
  
  const listContainer = $("coiUploadedList");
  if (listContainer) {
    listContainer.innerHTML = "<div class='small muted'>Uploading...</div>";
  }
  
  try {
    const uploadPromises = files.map(async (file) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const timestamp = Date.now();
      const path = `audits/${currentUid}/coi/${timestamp}_${safeName}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/pdf"
      });
      
      const downloadURL = await getDownloadURL(storageRef);
      
      return {
        name: file.name,
        url: downloadURL,
        uploadedAt: timestamp,
        path: path
      };
    });
    
    const uploaded = await Promise.all(uploadPromises);
    coiFiles.push(...uploaded);
    
    renderCOIUploadedList();
    
    // Clear file input
    if (fileInput) fileInput.value = "";
  } catch (err) {
    console.error("Error uploading COI files:", err);
    if (listContainer) {
      listContainer.innerHTML = "<div class='small danger'>Upload failed. Please try again.</div>";
    }
  }
}

// Render uploaded COI files list
function renderCOIUploadedList() {
  const container = $("coiUploadedList");
  if (!container) return;
  
  if (coiFiles.length === 0) {
    container.innerHTML = "";
    return;
  }
  
  container.innerHTML = coiFiles.map((file, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 6px;">
      <div>
        <a href="${file.url}" target="_blank" style="color: #111; text-decoration: underline;">${file.name}</a>
      </div>
      <button onclick="removeCOIFile(${idx})" style="padding: 4px 8px; font-size: 11px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer;">Remove</button>
    </div>
  `).join("");
}

// Make removeCOIFile available globally
window.removeCOIFile = function(idx) {
  coiFiles.splice(idx, 1);
  renderCOIUploadedList();
};

// Save questionnaire
async function saveQuestionnaire() {
  if (!currentUid) {
    setMsg("questionnaireError", "Please sign in first.", true);
    return;
  }
  
  const workType = ($("qWorkType")?.value || "").trim();
  const usedSubcontractors = $("qSubcontractors")?.value || "";
  const workedStates = getSelectedStates();
  
  // Validation
  if (!workType) {
    setMsg("questionnaireError", "Please describe the type of work performed.", true);
    return;
  }
  
  if (!usedSubcontractors) {
    setMsg("questionnaireError", "Please answer whether you used subcontractors with insurance.", true);
    return;
  }
  
  if (usedSubcontractors === "yes" && coiFiles.length === 0) {
    setMsg("questionnaireError", "Please upload at least one COI file when subcontractors are used.", true);
    return;
  }
  
  if (workedStates.length === 0) {
    setMsg("questionnaireError", "Please select at least one state where you worked.", true);
    return;
  }
  
  const btn = $("btnSaveQuestionnaire");
  const oldDisabled = btn?.disabled;
  
  try {
    if (btn) btn.disabled = true;
    setMsg("qMsg", "Saving...");
    setMsg("questionnaireError", "");
    
    const questionnaire = {
      workTypeDescription: workType,
      usedInsuredSubcontractors: usedSubcontractors === "yes",
      workedStates: workedStates,
      coiFiles: coiFiles.map(f => ({
        name: f.name,
        url: f.url,
        uploadedAt: f.uploadedAt
      }))
    };
    
    const auditRef = getAuditDocRef(currentUid);
    await setDoc(auditRef, {
      questionnaire,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update summary and collapse
    updateQuestionnaireSummary();
    collapseSection("questionnaireSection");
    if ($("questionnaireEditBtn")) $("questionnaireEditBtn").style.display = "inline-block";
    
    setMsg("qMsg", "Questionnaire saved successfully!");
    setTimeout(() => setMsg("qMsg", ""), 3000);
  } catch (err) {
    console.error(err);
    setMsg("questionnaireError", "Failed to save questionnaire. Please try again.", true);
  } finally {
    if (btn) btn.disabled = oldDisabled;
  }
}

// Update questionnaire summary
function updateQuestionnaireSummary() {
  const summary = $("questionnaireSummary");
  if (!summary) return;
  
  const workType = ($("qWorkType")?.value || "").trim();
  const usedSubcontractors = $("qSubcontractors")?.value || "";
  const workedStates = getSelectedStates();
  
  if (workType && usedSubcontractors && workedStates.length > 0) {
    const workTypePreview = workType.length > 40 ? workType.substring(0, 40) + "..." : workType;
    const subcontractorsText = usedSubcontractors === "yes" ? "Yes" : "No";
    const statesText = workedStates.map(code => {
      const state = getUSStates().find(s => s.code === code);
      return state ? state.name : code;
    }).join(", ");
    
    summary.textContent = `Work: ${workTypePreview} • Subcontractors: ${subcontractorsText} • States: ${statesText}`;
    summary.style.display = "block";
  }
}

// Update payroll summary display
function updatePayrollSummary() {
  const summary = $("payrollSummary");
  if (!summary) return;
  
  if (payrollData.length > 0) {
    const grandTotal = payrollData.reduce((sum, row) => sum + row.total, 0);
    summary.textContent = `Total Payroll: ${money(grandTotal)}`;
    summary.style.display = "block";
  } else {
    summary.textContent = "No payroll data loaded";
    summary.style.display = "block";
  }
}

// Load saved audit data
async function loadAuditData() {
  if (!currentUid) return;
  
  try {
    const auditRef = getAuditDocRef(currentUid);
    const snap = await getDoc(auditRef);
    
    if (snap.exists()) {
      auditData = snap.data();
      
      // Load policy data
      if (auditData.policy) {
        if ($("policyStart")) $("policyStart").value = auditData.policy.startDate || "";
        if ($("policyEnd")) $("policyEnd").value = auditData.policy.endDate || "";
        if ($("policyNumber")) $("policyNumber").value = auditData.policy.policyNumber || "";
      }
      
      if (auditData.auditorEmail && $("auditorEmail")) {
        $("auditorEmail").value = auditData.auditorEmail;
      }
      
      // Load questionnaire data
      if (auditData.questionnaire) {
        const q = auditData.questionnaire;
        if ($("qWorkType")) $("qWorkType").value = q.workTypeDescription || "";
        if ($("qSubcontractors")) {
          $("qSubcontractors").value = q.usedInsuredSubcontractors ? "yes" : "no";
          handleSubcontractorsChange();
        }
        if (q.workedStates && Array.isArray(q.workedStates)) {
          setSelectedStates(q.workedStates);
        }
        if (q.coiFiles && Array.isArray(q.coiFiles)) {
          coiFiles = q.coiFiles;
          renderCOIUploadedList();
        }
      }
      
      // Update summaries and collapse sections if data exists
      if (auditData.policy && auditData.policy.policyNumber) {
        updateBusinessInfoSummary();
        collapseSection("businessInfoSection");
        if ($("businessInfoEditBtn")) $("businessInfoEditBtn").style.display = "inline-block";
      }
      
      if (auditData.questionnaire && auditData.questionnaire.workTypeDescription) {
        updateQuestionnaireSummary();
        collapseSection("questionnaireSection");
        if ($("questionnaireEditBtn")) $("questionnaireEditBtn").style.display = "inline-block";
      }
      
      if (auditData.uploadedFiles && Array.isArray(auditData.uploadedFiles)) {
        uploadedFiles = auditData.uploadedFiles;
        renderUploadedList();
      }
    }
  } catch (err) {
    console.error("Error loading audit data:", err);
  }
}

// Generate PDF
function generatePDF() {
  if (!validatePeriod()) {
    setMsg("finalErr", "Please set the audit period first.", true);
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();
  
  const left = 14;
  let y = 14;
  
  // Header
  docPdf.setFontSize(18);
  docPdf.text("Insurance Audit Package", left, y);
  y += 10;
  
  // Business Info
  const businessName = $("businessName").value || "Business Name";
  const phone = $("phone").value || "";
  const copyEmail = $("businessEmail").value || currentUser?.email || "";
  const policyNumber = $("policyNumber").value || "";
  const taxId = $("taxId").value || "";
  const businessAddress = $("businessAddress").value || "";
  const businessCity = $("businessCity").value || "";
  const businessState = $("businessState").value || "";
  const businessZip = $("businessZip").value || "";
  
  docPdf.setFontSize(12);
  docPdf.text(businessName, left, y);
  y += 6;
  docPdf.setFontSize(10);
  if (businessAddress) { docPdf.text(businessAddress, left, y); y += 5; }
  const cityStateZip = [businessCity, businessState, businessZip].filter(Boolean).join(", ");
  if (cityStateZip) { docPdf.text(cityStateZip, left, y); y += 5; }
  if (phone) { docPdf.text(`Phone: ${phone}`, left, y); y += 5; }
  if (copyEmail) { docPdf.text(`Email: ${copyEmail}`, left, y); y += 5; }
  if (policyNumber) { docPdf.text(`Policy Number: ${policyNumber}`, left, y); y += 5; }
  if (taxId) { docPdf.text(`Tax ID: ${taxId}`, left, y); y += 5; }
  y += 3;
  
  // Audit Period
  docPdf.setFontSize(12);
  docPdf.text("Audit Period:", left, y);
  y += 6;
  docPdf.setFontSize(10);
  docPdf.text(`Policy Start: ${$("policyStart").value || "N/A"}`, left, y);
  y += 5;
  docPdf.text(`Policy End: ${$("policyEnd").value || "N/A"}`, left, y);
  y += 8;
  
  // Payroll Summary
  if (payrollData.length > 0) {
    docPdf.setFontSize(12);
    docPdf.text("Payroll Summary", left, y);
    y += 6;
    
    const tableRows = payrollData.map(row => [
      row.worker,
      row.paymentType,
      money(row.total),
      String(row.count)
    ]);
    
    const grandTotal = payrollData.reduce((sum, row) => sum + row.total, 0);
    const grandCount = payrollData.reduce((sum, row) => sum + row.count, 0);
    tableRows.push(["TOTAL", "", money(grandTotal), String(grandCount)]);
    
    docPdf.autoTable({
      startY: y,
      head: [["Worker", "Payment Type", "Total Paid", "# Payments"]],
      body: tableRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" }
      }
    });
    
    y = docPdf.lastAutoTable.finalY + 8;
  }
  
  // Questionnaire
  docPdf.setFontSize(12);
  docPdf.text("Audit Questionnaire", left, y);
  y += 8;
  docPdf.setFontSize(10);
  
  const workType = $("qWorkType")?.value || "N/A";
  const usedSubcontractors = $("qSubcontractors")?.value || "N/A";
  const workedStates = getSelectedStates();
  const statesText = workedStates.length > 0 
    ? workedStates.map(code => {
        const state = getUSStates().find(s => s.code === code);
        return state ? state.name : code;
      }).join(", ")
    : "N/A";
  
  const questions = [
    ["Type of work performed during the policy period:", workType],
    ["Did you use subcontractors with their own insurance?", usedSubcontractors === "yes" ? "Yes" : usedSubcontractors === "no" ? "No" : "N/A"],
    ["Which states did you work in during the policy period?", statesText]
  ];
  
  // Add COI files info if applicable
  if (usedSubcontractors === "yes" && coiFiles.length > 0) {
    const coiFileNames = coiFiles.map(f => f.name).join(", ");
    questions.push(["Subcontractors' Certificates of Insurance uploaded:", `${coiFiles.length} file(s): ${coiFileNames}`]);
  }
  
  questions.forEach(([label, value]) => {
    docPdf.setFont(undefined, "bold");
    docPdf.text(label, left, y);
    y += 5;
    docPdf.setFont(undefined, "normal");
    const lines = docPdf.splitTextToSize(value, 180);
    lines.forEach(line => {
      docPdf.text(line, left, y);
      y += 5;
    });
    y += 3;
  });
  
  // Save PDF
  const fileName = `audit_package_${$("policyStart").value || "unknown"}_${Date.now()}.pdf`;
  docPdf.save(fileName);
  
  setMsg("finalMsg", "PDF generated and downloaded.");
}

// Email audit package
async function emailAuditPackage() {
  if (!currentUid) {
    setMsg("finalErr", "Please sign in first.", true);
    return;
  }
  
  if (!validatePeriod()) {
    setMsg("finalErr", "Please set the audit period first.", true);
    return;
  }
  
  if (!currentUser?.email) {
    setMsg("finalErr", "User email not found. Please sign in again.", true);
    return;
  }
  
  const copyEmail = currentUser.email;
  
  // Save all data first
  await saveQuestionnaire();
  
  // Collect questionnaire data
  const questionnaire = {
    workTypeDescription: ($("qWorkType")?.value || "").trim(),
    usedInsuredSubcontractors: $("qSubcontractors")?.value === "yes",
    workedStates: getSelectedStates(),
    coiFiles: coiFiles.map(f => ({
      name: f.name,
      url: f.url,
      uploadedAt: f.uploadedAt
    }))
  };
  
  // Save to Firestore (update existing audit doc)
  const auditRef = getAuditDocRef(currentUid);
  await setDoc(auditRef, {
    policy: {
      policyNumber: $("policyNumber").value || "",
      startDate: $("policyStart").value || "",
      endDate: $("policyEnd").value || ""
    },
    auditorEmail: $("auditorEmail").value.trim() || null,
    questionnaire,
    payrollSummary: payrollData,
    uploadedFiles: uploadedFiles.map(f => ({
      type: f.type,
      fileName: f.fileName,
      filePath: f.filePath,
      downloadURL: f.downloadURL
    })),
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  // Legacy format for Cloud Function compatibility
  const auditPackage = {
    policyStart: $("policyStart").value,
    policyEnd: $("policyEnd").value,
    businessName: $("businessName").value || "",
    copyEmail: copyEmail,
    auditorEmail: $("auditorEmail").value.trim() || "",
    phone: $("phone").value || "",
    policyNumber: $("policyNumber").value || "",
    taxId: $("taxId").value || "",
    payrollSummary: payrollData,
    questionnaire,
    uploadedFiles: uploadedFiles.map(f => ({
      type: f.type,
      fileName: f.fileName,
      filePath: f.filePath,
      downloadURL: f.downloadURL
    }))
  };
  
  // Call Cloud Function (if it exists)
  try {
    setMsg("finalMsg", "Sending audit package...");
    setMsg("finalErr", "");
    
    // Note: This assumes a Cloud Function named "sendAuditPackage"
    // If it doesn't exist yet, you'll need to create it
    const sendAuditPackage = httpsCallable(functions, "sendAuditPackage");
    const result = await sendAuditPackage({ auditPackage });
    
    if (result?.data?.ok) {
      setMsg("finalMsg", "Audit package sent successfully!");
      setMsg("finalErr", "");
    } else {
      setMsg("finalErr", "Email send failed. The PDF was generated and saved.");
    }
  } catch (err) {
    console.error("Error sending email:", err);
    // If Cloud Function doesn't exist, just save the data
    setMsg("finalMsg", "Audit package saved. Note: Email function may not be configured yet.");
    setMsg("finalErr", "");
  }
}


// Initialize
function init() {
  // Initialize states checkbox grid
  initStatesCheckboxGrid();
  
  // Event listeners
  $("btnLoadPayroll").addEventListener("click", loadPayrollSummary);
  $("btnUploadDocs").addEventListener("click", uploadDocuments);
  $("btnSaveQuestionnaire").addEventListener("click", saveQuestionnaire);
  $("btnSaveBusinessInfo").addEventListener("click", saveBusinessInfo);
  $("btnGeneratePdf").addEventListener("click", generatePDF);
  $("btnEmailPackage").addEventListener("click", emailAuditPackage);
  
  // Section toggle handlers
  if ($("businessInfoSection")) {
    const header = $("businessInfoSection").querySelector(".audit-section-header");
    if (header) {
      header.addEventListener("click", (e) => {
        if (e.target.closest("button")) return; // Don't toggle if clicking Edit button
        toggleSection("businessInfoSection");
      });
    }
    if ($("businessInfoEditBtn")) {
      $("businessInfoEditBtn").addEventListener("click", () => {
        expandSection("businessInfoSection");
      });
    }
  }
  
  if ($("questionnaireSection")) {
    const header = $("questionnaireSection").querySelector(".audit-section-header");
    if (header) {
      header.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        toggleSection("questionnaireSection");
      });
    }
    if ($("questionnaireEditBtn")) {
      $("questionnaireEditBtn").addEventListener("click", () => {
        expandSection("questionnaireSection");
      });
    }
  }
  
  if ($("payrollSection")) {
    const header = $("payrollSection").querySelector(".audit-section-header");
    if (header) {
      header.addEventListener("click", (e) => {
        if (e.target.closest("button")) return; // Don't toggle if clicking Load button
        toggleSection("payrollSection");
      });
    }
  }
  
  if ($("uploadSection")) {
    const header = $("uploadSection").querySelector(".audit-section-header");
    if (header) {
      header.addEventListener("click", (e) => {
        if (e.target.closest("button")) return; // Don't toggle if clicking Upload button
        toggleSection("uploadSection");
      });
    }
  }
  
  // Subcontractors change handler
  if ($("qSubcontractors")) {
    $("qSubcontractors").addEventListener("change", handleSubcontractorsChange);
  }
  
  // COI file upload handler
  if ($("coiFiles")) {
    $("coiFiles").addEventListener("change", uploadCOIFiles);
  }
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      currentUser = user;
      await autofillBusinessInfo();
      await loadAuditData();
    } else {
      currentUid = null;
      currentUser = null;
    }
  });
  
  // Initial render
  renderUploadedList();
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

