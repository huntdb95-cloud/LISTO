// employees.js
// Employee Management - Add, edit, and manage employees/subcontractors

import { auth, db } from "../config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);
const storage = getStorage();

let currentUid = null;
let employees = [];
let editingEmployeeId = null;

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
        <div class="row-between" style="margin-bottom: 6px;">
          <div>
            <h3 class="h3" style="margin: 0; font-size: 1.1rem;">${emp.name || "—"}</h3>
            <div style="margin-top: 3px;">${typeBadge}</div>
          </div>
          <div>
            <button class="btn small" onclick="editEmployee('${emp.id}')" data-i18n="employees.edit">Edit</button>
            <button class="btn small ghost" onclick="deleteEmployee('${emp.id}', '${(emp.name || "").replace(/'/g, "\\'")}')" data-i18n="employees.delete">Delete</button>
          </div>
        </div>
        <div class="grid-2" style="margin-top: 8px; gap: 10px;">
          <div>
            ${emp.email ? `<div class="small muted">Email: ${emp.email}</div>` : ""}
            ${emp.phone ? `<div class="small muted">Phone: ${emp.phone}</div>` : ""}
          </div>
          <div>
            <div class="small muted" style="margin-bottom: 3px;"><strong>Documents:</strong></div>
            <div class="small" style="margin-bottom: 1px;">W-9: ${w9Link}</div>
            ${emp.type === "subcontractor" ? `
              <div class="small" style="margin-bottom: 1px;">COI: ${coiLink}</div>
              <div class="small" style="margin-bottom: 1px;">Workers Comp: ${workersCompLink}</div>
            ` : ""}
          </div>
        </div>
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
  $("employeeFormCard").style.display = "block";
  $("formTitle").textContent = employee ? "Edit Employee" : "Add Employee";
  
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
  clearMessages();
}

// Toggle subcontractor fields
function toggleSubcontractorFields() {
  const type = $("empType").value;
  $("subcontractorFields").style.display = type === "subcontractor" ? "block" : "none";
}

// Save employee
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
    showMsg("Saving employee...");
    
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
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
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

