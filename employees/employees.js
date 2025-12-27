// employees.js
// Employee Management - Add, edit, and manage employees/subcontractors

import { auth, db, storage } from "../config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);

let currentUid = null;
let employees = [];
let editingEmployeeId = null;
let editingLaborerId = null; // Track if we're editing a laborer from Bookkeeping

// Helper functions
function showMsg(msg, isError = false) {
  const msgEl = $("formMsg");
  const errEl = $("formError");
  if (isError) {
    msgEl.textContent = "";
    errEl.textContent = msg;
  } else {
    errEl.textContent = "";
    msgEl.textContent = msg;
  }
}

function clearMessages() {
  $("formMsg").textContent = "";
  $("formError").textContent = "";
}

function getFriendlyError(err) {
  if (err?.message) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred. Please try again.";
}

let archivedEmployees = [];

// Load employees (active and archived separately)
async function loadEmployees() {
  if (!currentUid) return;
  
  try {
    const employeesCol = collection(db, "users", currentUid, "employees");
    
    // Load active employees (not archived or archived = false)
    const activeQ = query(employeesCol, orderBy("nameLower"));
    const activeSnap = await getDocs(activeQ);
    
    employees = activeSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(emp => !emp.isArchived); // Filter out archived
    
    // Load archived employees
    archivedEmployees = activeSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(emp => emp.isArchived === true); // Only archived
    
    renderEmployeesList();
    renderArchivedWorkersList();
  } catch (err) {
    console.error("Error loading employees:", err);
    $("employeesList").innerHTML = `<div class="form-error">Error loading employees: ${getFriendlyError(err)}</div>`;
  }
}

// Load laborer from laborers collection
async function loadLaborer(laborerId) {
  if (!currentUid || !laborerId) return null;
  
  try {
    const laborerRef = doc(db, "users", currentUid, "laborers", laborerId);
    const laborerSnap = await getDoc(laborerRef);
    
    if (laborerSnap.exists()) {
      return { id: laborerSnap.id, ...laborerSnap.data() };
    }
    return null;
  } catch (err) {
    console.error("Error loading laborer:", err);
    return null;
  }
}

// Map laborer data to employee form structure
function mapLaborerToEmployeeForm(laborer) {
  if (!laborer) return null;
  
  // Map laborerType: "Worker" -> "employee", "Subcontractor" -> "subcontractor"
  let type = "employee";
  if (laborer.laborerType === "Subcontractor") {
    type = "subcontractor";
  }
  
  return {
    id: laborer.id,
    name: laborer.displayName || "",
    email: laborer.email || "",
    phone: laborer.phone || "",
    type: type,
    w9Url: laborer.documents?.w9?.downloadURL || null,
    coiUrl: laborer.documents?.coi?.downloadURL || null,
    workersCompUrl: null, // Laborers don't have workersComp in current model
    // Store original laborer data for saving back
    _isLaborer: true,
    _laborerData: laborer
  };
}

// Render employees list (active only)
function renderEmployeesList() {
  const container = $("employeesList");
  
  if (employees.length === 0) {
    container.innerHTML = `<div class="muted" data-i18n="employees.noEmployees">No employees added yet. Click "Add Employee" to get started.</div>`;
    return;
  }
  
  container.innerHTML = employees.map(emp => {
    const typeLabel = emp.type === "subcontractor" ? "Subcontractor" : "Employee";
    const typeBadge = `<span class="pill" style="background: ${emp.type === "subcontractor" ? "#e3f2fd" : "#f3e5f5"}; color: ${emp.type === "subcontractor" ? "#1976d2" : "#7b1fa2"};">${typeLabel}</span>`;
    
    const w9Link = emp.w9Url ? `<a href="${emp.w9Url}" target="_blank" class="mini-link">View W-9</a>` : `<span class="muted small">No W-9 uploaded</span>`;
    const coiLink = emp.coiUrl ? `<a href="${emp.coiUrl}" target="_blank" class="mini-link">View COI</a>` : `<span class="muted small">No COI uploaded</span>`;
    const workersCompLink = emp.workersCompUrl ? `<a href="${emp.workersCompUrl}" target="_blank" class="mini-link">View Workers Comp</a>` : `<span class="muted small">No Workers Comp uploaded</span>`;
    
    // Mobile: icon buttons, Desktop: text buttons
    // Escape single quotes in employee name for JavaScript string in onclick attribute
    // Use JavaScript string escaping (\') instead of HTML entities, as HTML entities are not decoded in attribute values
    const escapedName = (emp.name || "").replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    const editBtn = `<button class="btn small employee-edit-btn" onclick="editEmployee('${emp.id}')" data-i18n="employees.edit" aria-label="Edit"><span class="employee-btn-text">Edit</span><span class="employee-btn-icon">✏️</span></button>`;
    const archiveBtn = `<button class="btn small ghost employee-archive-btn" onclick="archiveEmployee('${emp.id}', '${escapedName}')" data-i18n="employees.archive" aria-label="Archive"><span class="employee-btn-text">Archive</span><span class="employee-btn-icon">🗑️</span></button>`;
    
    return `
      <div class="employee-card" style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px;">
        <div class="row-between" style="margin-bottom: 6px; align-items: flex-start;">
          <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <h3 class="h3" style="margin: 0; font-size: 1.1rem;">${emp.name || "—"}</h3>
              ${typeBadge}
            </div>
            <div class="small" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="muted"><strong>Documents:</strong></span>
              <span>W-9: ${w9Link}</span>
              ${emp.type === "subcontractor" ? `
                <span>COI: ${coiLink}</span>
                <span>Workers Comp: ${workersCompLink}</span>
              ` : ""}
            </div>
          </div>
          <div style="flex-shrink: 0; margin-left: 12px; display: flex; gap: 8px;">
            ${editBtn}
            ${archiveBtn}
          </div>
        </div>
        ${(emp.email || emp.phone) ? `
        <div class="small muted" style="margin-top: 6px;">
          ${emp.email ? `<span>Email: ${emp.email}</span>` : ""}
          ${emp.email && emp.phone ? ` • ` : ""}
          ${emp.phone ? `<span>Phone: ${emp.phone}</span>` : ""}
        </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

// Render archived workers list
function renderArchivedWorkersList() {
  const container = $("archivedWorkersList");
  if (!container) return;
  
  if (archivedEmployees.length === 0) {
    container.innerHTML = `<div class="muted">No archived workers</div>`;
    return;
  }
  
  container.innerHTML = archivedEmployees.map(emp => {
    const typeLabel = emp.type === "subcontractor" ? "Subcontractor" : "Employee";
    const typeBadge = `<span class="pill" style="background: ${emp.type === "subcontractor" ? "#e3f2fd" : "#f3e5f5"}; color: ${emp.type === "subcontractor" ? "#1976d2" : "#7b1fa2"}; opacity: 0.7;">${typeLabel}</span>`;
    
    return `
      <div class="employee-card" style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; opacity: 0.7;">
        <div class="row-between" style="margin-bottom: 6px; align-items: flex-start;">
          <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <h3 class="h3" style="margin: 0; font-size: 1.1rem;">${emp.name || "—"}</h3>
              ${typeBadge}
            </div>
          </div>
          <div style="flex-shrink: 0; margin-left: 12px;">
            <button class="btn small primary" onclick="reinstateEmployee('${emp.id}')" data-i18n="employees.reinstate">Reinstate</button>
          </div>
        </div>
        ${(emp.email || emp.phone) ? `
        <div class="small muted" style="margin-top: 6px;">
          ${emp.email ? `<span>Email: ${emp.email}</span>` : ""}
          ${emp.email && emp.phone ? ` • ` : ""}
          ${emp.phone ? `<span>Phone: ${emp.phone}</span>` : ""}
        </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

// Upload file to Storage
// Returns { url, storagePath } or null
async function uploadFile(file, path) {
  if (!file) return null;
  
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const timestamp = Date.now();
  const storagePath = `${path}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream"
  });
  
  const downloadURL = await getDownloadURL(storageRef);
  
  return {
    url: downloadURL,
    storagePath: storagePath
  };
}

// Delete file from Storage
async function deleteFile(url) {
  if (!url) return;
  try {
    // Extract path from full URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
    // We need to extract the path part
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1]);
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
    }
  } catch (err) {
    console.warn("Error deleting file:", err);
  }
}

// Show form
function showForm(employee = null) {
  editingEmployeeId = employee ? employee.id : null;
  editingLaborerId = employee?._isLaborer ? employee.id : null;
  $("employeeFormCard").style.display = "block";
  $("formTitle").textContent = employee ? (employee._isLaborer ? "Edit Laborer" : "Edit Employee") : "Add Employee";
  
  // Reset form
  $("employeeForm").reset();
  $("employeeId").value = employee ? employee.id : "";
  $("empName").value = employee?.name || "";
  $("empEmail").value = employee?.email || "";
  $("empPhone").value = employee?.phone || "";
  $("empType").value = employee?.type || "";
  
  // Clear file inputs
  $("empW9").value = "";
  $("empCoi").value = "";
  $("empWorkersComp").value = "";
  
  // Update document status
  $("w9Status").textContent = employee?.w9Url ? "Current file uploaded" : "";
  $("coiStatus").textContent = employee?.coiUrl ? "Current file uploaded" : "";
  $("workersCompStatus").textContent = employee?.workersCompUrl ? "Current file uploaded" : "";
  
  // Show/hide laborer details section
  const laborerDetailsSection = $("laborerDetailsSection");
  if (employee?._isLaborer && employee._laborerData) {
    // Show laborer details section
    if (laborerDetailsSection) {
      laborerDetailsSection.style.display = "block";
      // Populate read-only fields
      $("detailLaborerType").textContent = employee._laborerData.laborerType || "—";
      $("detailLaborerTinLast4").textContent = employee._laborerData.tinLast4 || "—";
      $("detailLaborerPhone").textContent = employee._laborerData.phone || "—";
      $("detailLaborerEmail").textContent = employee._laborerData.email || "—";
      $("detailLaborerAddress").textContent = employee._laborerData.address || "—";
      $("detailLaborerNotes").textContent = employee._laborerData.notes || "—";
    }
  } else {
    // Hide laborer details section
    if (laborerDetailsSection) {
      laborerDetailsSection.style.display = "none";
    }
  }
  
  // Populate W9 info if available (for laborers)
  // Prefer OCR-extracted data, but allow manual override
  if (employee?._isLaborer && employee._laborerData) {
    const laborer = employee._laborerData;
    const w9Info = laborer.w9Info;
    
    // Show OCR status if available
    const ocrStatus = laborer.w9OcrStatus;
    const w9StatusMsg = $("w9OcrStatusMessage");
    if (w9StatusMsg) {
      if (ocrStatus === "processing") {
        w9StatusMsg.textContent = "Scanning W-9...";
        w9StatusMsg.className = "small";
        w9StatusMsg.style.color = "#059669";
        w9StatusMsg.style.display = "block";
      } else if (ocrStatus === "complete" || ocrStatus === "needs_review") {
        const confidence = w9Info?.ocrConfidence || "medium";
        w9StatusMsg.textContent = `W-9 scanned (${confidence} confidence). Review and edit fields as needed.`;
        w9StatusMsg.className = "small";
        w9StatusMsg.style.color = confidence === "high" ? "#059669" : "#f59e0b";
        w9StatusMsg.style.display = "block";
      } else if (ocrStatus === "failed") {
        w9StatusMsg.textContent = laborer.w9OcrError || "Couldn't scan W-9. Please enter details manually.";
        w9StatusMsg.className = "small danger";
        w9StatusMsg.style.display = "block";
      } else {
        w9StatusMsg.style.display = "none";
      }
    }
    
    // Populate fields from OCR data or existing data
    if (w9Info) {
      $("w9LegalName").value = w9Info.legalName || "";
      $("w9BusinessName").value = w9Info.businessName || "";
      $("w9AddressLine1").value = w9Info.addressLine1 || "";
      $("w9AddressLine2").value = w9Info.addressLine2 || "";
      $("w9City").value = w9Info.city || "";
      $("w9State").value = w9Info.state || "";
      $("w9Zip").value = w9Info.zip || "";
      $("w9TinType").value = w9Info.tinType || "SSN";
      $("w9TinLast4").value = w9Info.tinLast4 || "";
    } else {
      // Clear W9 info fields
      $("w9LegalName").value = "";
      $("w9BusinessName").value = "";
      $("w9AddressLine1").value = "";
      $("w9AddressLine2").value = "";
      $("w9City").value = "";
      $("w9State").value = "";
      $("w9Zip").value = "";
      $("w9TinType").value = "SSN";
      $("w9TinLast4").value = "";
    }
  } else {
    // Clear W9 info fields
    $("w9LegalName").value = "";
    $("w9BusinessName").value = "";
    $("w9AddressLine1").value = "";
    $("w9AddressLine2").value = "";
    $("w9City").value = "";
    $("w9State").value = "";
    $("w9Zip").value = "";
    $("w9TinType").value = "SSN";
    $("w9TinLast4").value = "";
    
    const w9StatusMsg = $("w9OcrStatusMessage");
    if (w9StatusMsg) w9StatusMsg.style.display = "none";
  }
  
  // Show/hide subcontractor fields
  toggleSubcontractorFields();
  
  clearMessages();
  
  // Scroll to form
  $("employeeFormCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Hide form
function hideForm() {
  $("employeeFormCard").style.display = "none";
  editingEmployeeId = null;
  editingLaborerId = null;
  clearMessages();
}

// Toggle subcontractor fields
function toggleSubcontractorFields() {
  const type = $("empType").value;
  $("subcontractorFields").style.display = type === "subcontractor" ? "block" : "none";
}

// Save employee or laborer
async function saveEmployee(e) {
  e.preventDefault();
  
  if (!currentUid) {
    showMsg("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveEmployeeBtn");
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages();
    showMsg(editingLaborerId ? "Saving laborer..." : "Saving employee...");
    
    const name = $("empName").value.trim();
    const email = $("empEmail").value.trim();
    const phone = $("empPhone").value.trim();
    const type = $("empType").value;
    
    if (!name) {
      showMsg("Name is required.", true);
      return;
    }
    
    if (!type) {
      showMsg("Type is required.", true);
      return;
    }
    
    // If editing a laborer, save to laborers collection
    if (editingLaborerId) {
      await saveLaborer(name, email, phone, type);
      return;
    }
    
    // Otherwise, save to employees collection (existing logic)
    const nameLower = name.toLowerCase();
    const employeeData = {
      name,
      nameLower,
      email: email || null,
      phone: phone || null,
      type,
      updatedAt: serverTimestamp()
    };
    
    // Save to Firestore first to get employee ID (for new employees)
    let employeeId = editingEmployeeId;
    const existing = employeeId ? employees.find(e => e.id === employeeId) : null;
    
    if (!employeeId) {
      // Create new employee first to get ID (without file URLs yet)
      employeeData.createdAt = serverTimestamp();
      employeeData.isArchived = false; // New employees are active by default
      const employeesCol = collection(db, "users", currentUid, "employees");
      const newRef = await addDoc(employeesCol, employeeData);
      employeeId = newRef.id;
      
      // Also create a corresponding laborer in laborers collection for Bookkeeping
      const laborerType = type === "subcontractor" ? "Subcontractor" : "Worker";
      const laborersCol = collection(db, "users", currentUid, "laborers");
      const laborerRef = await addDoc(laborersCol, {
        displayName: name,
        laborerType: laborerType,
        email: email || null,
        phone: phone || null,
        address: null,
        tinLast4: null,
        notes: null,
        isArchived: false,
        documents: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Store laborerId in employee record for future sync
      await updateDoc(doc(db, "users", currentUid, "employees", employeeId), {
        laborerId: laborerRef.id
      });
    } else {
      // Keep existing file URLs if not uploading new ones
      if (existing?.w9Url && !$("empW9").files[0]) employeeData.w9Url = existing.w9Url;
      if (existing?.coiUrl && !$("empCoi").files[0]) employeeData.coiUrl = existing.coiUrl;
      if (existing?.workersCompUrl && !$("empWorkersComp").files[0]) employeeData.workersCompUrl = existing.workersCompUrl;
      
      // Also update corresponding laborer if it exists
      try {
        // First, try to use stored laborerId from employee record (most reliable)
        let laborerIdToUpdate = existing?.laborerId;
        
        // If no stored laborerId, try to find by name (for legacy data)
        // Only update if exactly one match to avoid corrupting wrong laborer
        if (!laborerIdToUpdate) {
          const laborersCol = collection(db, "users", currentUid, "laborers");
          const laborersSnap = await getDocs(query(laborersCol, where("displayName", "==", name)));
          if (laborersSnap.docs.length === 1) {
            // Only update if exactly one match (safe)
            laborerIdToUpdate = laborersSnap.docs[0].id;
            // Store the laborerId in employee record for future use
            employeeData.laborerId = laborerIdToUpdate;
          } else if (laborersSnap.docs.length > 1) {
            // Multiple matches - don't update to avoid data corruption
            console.warn(`Multiple laborers found with name "${name}". Skipping laborer sync to avoid data corruption.`);
          }
        }
        
        if (laborerIdToUpdate) {
          const laborerType = type === "subcontractor" ? "Subcontractor" : "Worker";
          await updateDoc(doc(db, "users", currentUid, "laborers", laborerIdToUpdate), {
            displayName: name,
            laborerType: laborerType,
            email: email || null,
            phone: phone || null,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn("Could not sync to laborers collection:", err);
        // Non-blocking - continue with employee save
      }
    }
    
    // Handle file uploads (now we have employeeId)
    const w9File = $("empW9").files[0];
    const coiFile = $("empCoi").files[0];
    const workersCompFile = $("empWorkersComp").files[0];
    
    if (w9File) {
      showMsg("Uploading W-9...");
      if (existing?.w9Url) await deleteFile(existing.w9Url);
      const w9Result = await uploadFile(w9File, `users/${currentUid}/employees/${employeeId}/w9`);
      if (w9Result) employeeData.w9Url = w9Result.url;
    }
    
    if (type === "subcontractor") {
      if (coiFile) {
        showMsg("Uploading COI...");
        if (existing?.coiUrl) await deleteFile(existing.coiUrl);
        const coiResult = await uploadFile(coiFile, `users/${currentUid}/employees/${employeeId}/coi`);
        if (coiResult) employeeData.coiUrl = coiResult.url;
      }
      
      if (workersCompFile) {
        showMsg("Uploading Workers Compensation document...");
        if (existing?.workersCompUrl) await deleteFile(existing.workersCompUrl);
        const workersCompResult = await uploadFile(workersCompFile, `users/${currentUid}/employees/${employeeId}/workersComp`);
        if (workersCompResult) employeeData.workersCompUrl = workersCompResult.url;
      }
    } else {
      // If changing from subcontractor to employee, remove subcontractor-specific files
      if (existing?.type === "subcontractor") {
        if (existing?.coiUrl) {
          await deleteFile(existing.coiUrl);
          employeeData.coiUrl = null;
        }
        if (existing?.workersCompUrl) {
          await deleteFile(existing.workersCompUrl);
          employeeData.workersCompUrl = null;
        }
      }
    }
    
    // Update Firestore with final data (including file URLs)
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await updateDoc(employeeRef, employeeData);
    
    showMsg("Employee saved successfully!", false);
    await loadEmployees();
    
    setTimeout(() => {
      hideForm();
    }, 1500);
    
  } catch (err) {
    console.error("Error saving employee:", err);
    showMsg(getFriendlyError(err), true);
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Save laborer to laborers collection
async function saveLaborer(name, email, phone, type) {
  
  // Map type back to laborerType: "employee" -> "Worker", "subcontractor" -> "Subcontractor"
  const laborerType = type === "subcontractor" ? "Subcontractor" : "Worker";
  
  const laborerId = editingLaborerId;
  const laborerRef = doc(db, "users", currentUid, "laborers", laborerId);
  const laborerDoc = await getDoc(laborerRef);
  const existing = laborerDoc.exists() ? laborerDoc.data() : null;
  
  // Build laborer data
  const laborerData = {
    displayName: name,
    laborerType: laborerType,
    email: email || null,
    phone: phone || null,
    updatedAt: serverTimestamp()
  };
  
  // Preserve existing fields
  if (existing) {
    laborerData.address = existing.address || null;
    laborerData.tinLast4 = existing.tinLast4 || null;
    laborerData.notes = existing.notes || null;
    laborerData.isArchived = existing.isArchived || false;
    laborerData.documents = existing.documents || {};
    laborerData.createdAt = existing.createdAt;
  } else {
    laborerData.documents = {};
    laborerData.createdAt = serverTimestamp();
  }
  
  // Handle file uploads
  const w9File = $("empW9").files[0];
  const coiFile = $("empCoi").files[0];
  
  if (w9File) {
    showMsg("Uploading W-9...");
    // Delete old W9 if exists
    if (existing?.documents?.w9?.storagePath) {
      try {
        const oldRef = ref(storage, existing.documents.w9.storagePath);
        await deleteObject(oldRef);
      } catch (err) {
        console.warn("Error deleting old W9:", err);
      }
    }
    
    const w9Result = await uploadFile(w9File, `users/${currentUid}/laborers/${laborerId}/documents/w9`);
    
    if (w9Result) {
      laborerData.documents.w9 = {
        fileName: w9File.name,
        contentType: w9File.type,
        size: w9File.size,
        storagePath: w9Result.storagePath, // Use the actual path from uploadFile
        downloadURL: w9Result.url,
        uploadedAt: Date.now(),
        updatedAt: Date.now()
      };
    }
  }
  
  if (type === "subcontractor" && coiFile) {
    showMsg("Uploading COI...");
    // Delete old COI if exists
    if (existing?.documents?.coi?.storagePath) {
      try {
        const oldRef = ref(storage, existing.documents.coi.storagePath);
        await deleteObject(oldRef);
      } catch (err) {
        console.warn("Error deleting old COI:", err);
      }
    }
    
    const coiResult = await uploadFile(coiFile, `users/${currentUid}/laborers/${laborerId}/documents/coi`);
    
    if (coiResult) {
      laborerData.documents.coi = {
        fileName: coiFile.name,
        contentType: coiFile.type,
        size: coiFile.size,
        storagePath: coiResult.storagePath, // Use the actual path from uploadFile
        downloadURL: coiResult.url,
        uploadedAt: Date.now(),
        updatedAt: Date.now()
      };
    }
  }
  
  // Save W9 info if provided
  const w9LegalName = $("w9LegalName")?.value.trim();
  const w9BusinessName = $("w9BusinessName")?.value.trim();
  const w9AddressLine1 = $("w9AddressLine1")?.value.trim();
  const w9AddressLine2 = $("w9AddressLine2")?.value.trim();
  const w9City = $("w9City")?.value.trim();
  const w9State = $("w9State")?.value.trim().toUpperCase();
  const w9Zip = $("w9Zip")?.value.trim();
  const w9TinType = $("w9TinType")?.value || "SSN";
  const w9TinLast4 = $("w9TinLast4")?.value.trim();
  
  // Only save W9 info if at least legal name and address are provided
  if (w9LegalName && w9AddressLine1 && w9City && w9State && w9Zip && w9TinLast4) {
    laborerData.w9Info = {
      legalName: w9LegalName,
      businessName: w9BusinessName || null,
      addressLine1: w9AddressLine1,
      addressLine2: w9AddressLine2 || null,
      city: w9City,
      state: w9State,
      zip: w9Zip,
      tinType: w9TinType,
      tinLast4: w9TinLast4,
      updatedAt: Date.now()
    };
  } else if (existing?.w9Info) {
    // Preserve existing W9 info if new info is incomplete
    laborerData.w9Info = existing.w9Info;
  }
  
  // Update laborer in Firestore
  await updateDoc(laborerRef, laborerData);
  
  showMsg("Laborer saved successfully!", false);
  
  setTimeout(() => {
    hideForm();
    // Optionally navigate back to bookkeeping
    // window.location.href = "../bookkeeping/bookkeeping.html";
  }, 1500);
}

// Archive employee (set isArchived = true, don't delete)
async function archiveEmployee(employeeId, employeeName) {
  if (!confirm(`Archive ${employeeName || "this employee"}? They will be moved to Archived Workers and removed from active lists.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // Archive employee in Firestore
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await updateDoc(employeeRef, {
      isArchived: true,
      updatedAt: serverTimestamp()
    });
    
    // Archive corresponding laborer if it exists
    if (employee?.laborerId) {
      try {
        const laborerRef = doc(db, "users", currentUid, "laborers", employee.laborerId);
        await updateDoc(laborerRef, {
          isArchived: true,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Error archiving corresponding laborer:", err);
        // Continue even if laborer archiving fails
      }
    } else {
      // If no laborerId stored, try to find by name (for legacy data)
      // Only archive if exactly one match
      try {
        const laborersCol = collection(db, "users", currentUid, "laborers");
        const laborersSnap = await getDocs(query(laborersCol, where("displayName", "==", employeeName)));
        
        if (laborersSnap.docs.length === 1) {
          const laborerDoc = laborersSnap.docs[0];
          await updateDoc(doc(db, "users", currentUid, "laborers", laborerDoc.id), {
            isArchived: true,
            updatedAt: serverTimestamp()
          });
        } else if (laborersSnap.docs.length > 1) {
          console.warn(`Multiple laborers found with name "${employeeName}". Skipping laborer archive to avoid data corruption.`);
        }
      } catch (err) {
        console.warn("Error finding/archiving laborer by name:", err);
        // Continue even if laborer archiving fails
      }
    }
    
    await loadEmployees();
  } catch (err) {
    console.error("Error archiving employee:", err);
    alert(`Error archiving employee: ${getFriendlyError(err)}`);
  }
}

// Reinstate employee (set isArchived = false)
async function reinstateEmployee(employeeId) {
  if (!currentUid) return;
  
  try {
    const employee = archivedEmployees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // Reinstate employee in Firestore
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await updateDoc(employeeRef, {
      isArchived: false,
      updatedAt: serverTimestamp()
    });
    
    // Reinstate corresponding laborer if it exists
    if (employee?.laborerId) {
      try {
        const laborerRef = doc(db, "users", currentUid, "laborers", employee.laborerId);
        await updateDoc(laborerRef, {
          isArchived: false,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Error reinstating corresponding laborer:", err);
        // Continue even if laborer reinstating fails
      }
    } else {
      // If no laborerId stored, try to find by name (for legacy data)
      // Only reinstate if exactly one match
      try {
        const laborersCol = collection(db, "users", currentUid, "laborers");
        const laborersSnap = await getDocs(query(laborersCol, where("displayName", "==", employee.name)));
        
        if (laborersSnap.docs.length === 1) {
          const laborerDoc = laborersSnap.docs[0];
          await updateDoc(doc(db, "users", currentUid, "laborers", laborerDoc.id), {
            isArchived: false,
            updatedAt: serverTimestamp()
          });
        } else if (laborersSnap.docs.length > 1) {
          console.warn(`Multiple laborers found with name "${employee.name}". Skipping laborer reinstate to avoid data corruption.`);
        }
      } catch (err) {
        console.warn("Error finding/reinstating laborer by name:", err);
        // Continue even if laborer reinstating fails
      }
    }
    
    await loadEmployees();
  } catch (err) {
    console.error("Error reinstating employee:", err);
    alert(`Error reinstating employee: ${getFriendlyError(err)}`);
  }
}

// Edit employee
function editEmployee(employeeId) {
  const employee = employees.find(e => e.id === employeeId);
  if (employee) {
    showForm(employee);
  }
}

// Make functions globally available
window.editEmployee = editEmployee;
window.archiveEmployee = archiveEmployee;
window.reinstateEmployee = reinstateEmployee;

// Initialize
function init() {
  // Event listeners
  $("addEmployeeBtn").addEventListener("click", () => showForm());
  $("cancelBtn").addEventListener("click", hideForm);
  $("employeeForm").addEventListener("submit", saveEmployee);
  $("empType").addEventListener("change", toggleSubcontractorFields);
  
  // File input change handlers
  $("empW9").addEventListener("change", (e) => {
    $("w9Status").textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
  });
  
  // W9 Info toggle
  const toggleW9InfoBtn = $("toggleW9InfoBtn");
  const w9InfoFields = $("w9InfoFields");
  if (toggleW9InfoBtn && w9InfoFields) {
    toggleW9InfoBtn.addEventListener("click", () => {
      const isVisible = w9InfoFields.style.display !== "none";
      w9InfoFields.style.display = isVisible ? "none" : "block";
      toggleW9InfoBtn.textContent = isVisible ? "Show" : "Hide";
    });
  }
  $("empCoi").addEventListener("change", (e) => {
    $("coiStatus").textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
  });
  $("empWorkersComp").addEventListener("change", (e) => {
    $("workersCompStatus").textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
  });
  
  // Check for laborerId in query string
  const urlParams = new URLSearchParams(window.location.search);
  const laborerId = urlParams.get("laborerId");
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      
      // If laborerId is in URL, load and show that laborer
      if (laborerId) {
        const laborer = await loadLaborer(laborerId);
        if (laborer) {
          const employeeForm = mapLaborerToEmployeeForm(laborer);
          showForm(employeeForm);
        } else {
          showMsg("Laborer not found.", true);
        }
      }
      
      await loadEmployees();
    } else {
      currentUid = null;
      employees = [];
      renderEmployeesList();
    }
  });
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

