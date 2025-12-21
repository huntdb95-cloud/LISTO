// audit.js
// Insurance Audit Help Tool
// Loads payroll data, manages document uploads, questionnaire, and generates audit packages

import { auth, db } from "../config.js";

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
let payrollData = []; // Filtered payroll entries
let uploadedFiles = []; // { type, fileName, filePath, downloadURL }
let auditData = null; // Saved audit data

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

// Audit period validation
function validatePeriod() {
  const start = $("policyStart").value;
  const end = $("policyEnd").value;
  
  if (!start || !end) {
    setMsg("periodMsg", "Please enter both start and end dates.");
    return false;
  }
  
  if (new Date(start) > new Date(end)) {
    setMsg("periodMsg", "Start date must be before end date.");
    return false;
  }
  
  setMsg("periodMsg", "");
  return true;
}

// Load payroll summary
async function loadPayrollSummary() {
  if (!validatePeriod()) return;
  
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

// Save questionnaire
async function saveQuestionnaire() {
  if (!currentUid) {
    setMsg("qMsg", "Please sign in first.", true);
    return;
  }
  
  const questionnaire = {
    qCash: $("qCash").value || "",
    qCashExplain: $("qCashExplain").value || "",
    qSubs: $("qSubs").value || "",
    qCOI: $("qCOI").value || "",
    qOwnerLabor: $("qOwnerLabor").value || "",
    qChanges: $("qChanges").value || "",
    qNotes: $("qNotes").value || ""
  };
  
  try {
    const auditRef = doc(db, "users", currentUid, "audit", "current");
    await setDoc(auditRef, {
      questionnaire,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    setMsg("qMsg", "Questionnaire saved.");
  } catch (err) {
    console.error(err);
    setMsg("qMsg", "Failed to save questionnaire.", true);
  }
}

// Load saved audit data
async function loadAuditData() {
  if (!currentUid) return;
  
  try {
    const auditRef = doc(db, "users", currentUid, "audit", "current");
    const snap = await getDoc(auditRef);
    
    if (snap.exists()) {
      auditData = snap.data();
      
      // Populate form fields if they exist
      if (auditData.questionnaire) {
        const q = auditData.questionnaire;
        if (q.qCash) $("qCash").value = q.qCash;
        if (q.qCashExplain) $("qCashExplain").value = q.qCashExplain;
        if (q.qSubs) $("qSubs").value = q.qSubs;
        if (q.qCOI) $("qCOI").value = q.qCOI;
        if (q.qOwnerLabor) $("qOwnerLabor").value = q.qOwnerLabor;
        if (q.qChanges) $("qChanges").value = q.qChanges;
        if (q.qNotes) $("qNotes").value = q.qNotes;
      }
      
      if (auditData.policyStart) $("policyStart").value = auditData.policyStart;
      if (auditData.policyEnd) $("policyEnd").value = auditData.policyEnd;
      if (auditData.businessName) $("businessName").value = auditData.businessName;
      if (auditData.copyEmail) $("copyEmail").value = auditData.copyEmail;
      if (auditData.auditorEmail) $("auditorEmail").value = auditData.auditorEmail;
      if (auditData.phone) $("phone").value = auditData.phone;
      
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
  const copyEmail = $("copyEmail").value || "";
  
  docPdf.setFontSize(12);
  docPdf.text(businessName, left, y);
  y += 6;
  if (phone) { docPdf.setFontSize(10); docPdf.text(`Phone: ${phone}`, left, y); y += 5; }
  if (copyEmail) { docPdf.text(`Email: ${copyEmail}`, left, y); y += 5; }
  y += 5;
  
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
  
  const questions = [
    ["Did you pay any workers in cash?", $("qCash").value || "N/A"],
    ["Cash payment details:", $("qCashExplain").value || "N/A"],
    ["Did you use subcontractors (1099)?", $("qSubs").value || "N/A"],
    ["Were subcontractors insured / COIs collected?", $("qCOI").value || "N/A"],
    ["Did the owner perform hands-on labor?", $("qOwnerLabor").value || "N/A"],
    ["Changes in business operations:", $("qChanges").value || "N/A"],
    ["Additional notes:", $("qNotes").value || "N/A"]
  ];
  
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
  
  const copyEmail = $("copyEmail").value.trim();
  if (!copyEmail) {
    setMsg("finalErr", "Please enter a contact email.", true);
    return;
  }
  
  // Save all data first
  await saveQuestionnaire();
  
  const auditPackage = {
    policyStart: $("policyStart").value,
    policyEnd: $("policyEnd").value,
    businessName: $("businessName").value || "",
    copyEmail: copyEmail,
    auditorEmail: $("auditorEmail").value.trim() || "",
    phone: $("phone").value || "",
    payrollSummary: payrollData,
    questionnaire: {
      qCash: $("qCash").value || "",
      qCashExplain: $("qCashExplain").value || "",
      qSubs: $("qSubs").value || "",
      qCOI: $("qCOI").value || "",
      qOwnerLabor: $("qOwnerLabor").value || "",
      qChanges: $("qChanges").value || "",
      qNotes: $("qNotes").value || ""
    },
    uploadedFiles: uploadedFiles.map(f => ({
      type: f.type,
      fileName: f.fileName,
      filePath: f.filePath,
      downloadURL: f.downloadURL
    }))
  };
  
  // Save to Firestore
  const auditRef = doc(db, "users", currentUid, "audit", "current");
  await setDoc(auditRef, {
    ...auditPackage,
    updatedAt: serverTimestamp()
  }, { merge: true });
  
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

// Clear form
function clearForm() {
  $("policyStart").value = "";
  $("policyEnd").value = "";
  $("businessName").value = "";
  $("copyEmail").value = "";
  $("auditorEmail").value = "";
  $("phone").value = "";
  $("qCash").value = "";
  $("qCashExplain").value = "";
  $("qSubs").value = "";
  $("qCOI").value = "";
  $("qOwnerLabor").value = "";
  $("qChanges").value = "";
  $("qNotes").value = "";
  
  payrollData = [];
  uploadedFiles = [];
  
  const tbody = $("payrollTable").querySelector("tbody");
  tbody.innerHTML = '<td colspan="4" class="muted">No data loaded.</td>';
  $("grandTotal").innerHTML = "<b>$0.00</b>";
  $("grandCount").innerHTML = "<b>0</b>";
  
  renderUploadedList();
  
  setMsg("periodMsg", "");
  setMsg("payrollStatus", "");
  setMsg("uploadMsg", "");
  setMsg("qMsg", "");
  setMsg("finalMsg", "");
  setMsg("finalErr", "");
}

// Initialize
function init() {
  // Event listeners
  $("btnLoadPayroll").addEventListener("click", loadPayrollSummary);
  $("btnClear").addEventListener("click", clearForm);
  $("btnUploadDocs").addEventListener("click", uploadDocuments);
  $("btnSaveQuestionnaire").addEventListener("click", saveQuestionnaire);
  $("btnGeneratePdf").addEventListener("click", generatePDF);
  $("btnEmailPackage").addEventListener("click", emailAuditPackage);
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      await loadAuditData();
    } else {
      currentUid = null;
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

