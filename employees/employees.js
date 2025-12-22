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

// Load employees
async function loadEmployees() {
  if (!currentUid) return;
  
  try {
    const employeesCol = collection(db, "users", currentUid, "employees");
    const q = query(employeesCol, orderBy("nameLower"));
    const snap = await getDocs(q);
    
    employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEmployeesList();
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

// Render employees list
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
          <div style="flex-shrink: 0; margin-left: 12px;">
            <button class="btn small" onclick="editEmployee('${emp.id}')" data-i18n="employees.edit">Edit</button>
            <button class="btn small ghost" onclick="deleteEmployee('${emp.id}', '${(emp.name || "").replace(/'/g, "\\'")}')" data-i18n="employees.delete">Delete</button>
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
async function uploadFile(file, path) {
  if (!file) return null;
  
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const timestamp = Date.now();
  const storageRef = ref(storage, `${path}/${timestamp}_${safeName}`);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream"
  });
  
  return await getDownloadURL(storageRef);
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
      const employeesCol = collection(db, "users", currentUid, "employees");
      const newRef = await addDoc(employeesCol, employeeData);
      employeeId = newRef.id;
    } else {
      // Keep existing file URLs if not uploading new ones
      if (existing?.w9Url && !$("empW9").files[0]) employeeData.w9Url = existing.w9Url;
      if (existing?.coiUrl && !$("empCoi").files[0]) employeeData.coiUrl = existing.coiUrl;
      if (existing?.workersCompUrl && !$("empWorkersComp").files[0]) employeeData.workersCompUrl = existing.workersCompUrl;
    }
    
    // Handle file uploads (now we have employeeId)
    const w9File = $("empW9").files[0];
    const coiFile = $("empCoi").files[0];
    const workersCompFile = $("empWorkersComp").files[0];
    
    if (w9File) {
      showMsg("Uploading W-9...");
      if (existing?.w9Url) await deleteFile(existing.w9Url);
      const w9Url = await uploadFile(w9File, `users/${currentUid}/employees/${employeeId}/w9`);
      employeeData.w9Url = w9Url;
    }
    
    if (type === "subcontractor") {
      if (coiFile) {
        showMsg("Uploading COI...");
        if (existing?.coiUrl) await deleteFile(existing.coiUrl);
        const coiUrl = await uploadFile(coiFile, `users/${currentUid}/employees/${employeeId}/coi`);
        employeeData.coiUrl = coiUrl;
      }
      
      if (workersCompFile) {
        showMsg("Uploading Workers Compensation document...");
        if (existing?.workersCompUrl) await deleteFile(existing.workersCompUrl);
        const workersCompUrl = await uploadFile(workersCompFile, `users/${currentUid}/employees/${employeeId}/workersComp`);
        employeeData.workersCompUrl = workersCompUrl;
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
    
    const w9Url = await uploadFile(w9File, `users/${currentUid}/laborers/${laborerId}/documents/w9`);
    
    // Extract storage path from URL or construct it
    const safeName = w9File.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = Date.now();
    const storagePath = `users/${currentUid}/laborers/${laborerId}/documents/w9/${timestamp}_${safeName}`;
    
    laborerData.documents.w9 = {
      fileName: w9File.name,
      contentType: w9File.type,
      size: w9File.size,
      storagePath: storagePath,
      downloadURL: w9Url,
      uploadedAt: Date.now(),
      updatedAt: Date.now()
    };
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
    
    const coiUrl = await uploadFile(coiFile, `users/${currentUid}/laborers/${laborerId}/documents/coi`);
    
    // Extract storage path from URL or construct it
    const safeName = coiFile.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = Date.now();
    const storagePath = `users/${currentUid}/laborers/${laborerId}/documents/coi/${timestamp}_${safeName}`;
    
    laborerData.documents.coi = {
      fileName: coiFile.name,
      contentType: coiFile.type,
      size: coiFile.size,
      storagePath: storagePath,
      downloadURL: coiUrl,
      uploadedAt: Date.now(),
      updatedAt: Date.now()
    };
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

// Delete employee
async function deleteEmployee(employeeId, employeeName) {
  if (!confirm(`Delete ${employeeName || "this employee"}? This action cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const employee = employees.find(e => e.id === employeeId);
    
    // Delete files from Storage
    if (employee?.w9Url) await deleteFile(employee.w9Url);
    if (employee?.coiUrl) await deleteFile(employee.coiUrl);
    if (employee?.workersCompUrl) await deleteFile(employee.workersCompUrl);
    
    // Delete from Firestore
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await deleteDoc(employeeRef);
    
    await loadEmployees();
  } catch (err) {
    console.error("Error deleting employee:", err);
    alert(`Error deleting employee: ${getFriendlyError(err)}`);
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
window.deleteEmployee = deleteEmployee;

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

