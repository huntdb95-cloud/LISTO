// bookkeeping.js
// Combined Payroll and Employee Management

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc
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

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function getFriendlyError(err) {
  if (err?.message) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred. Please try again.";
}

/* -----------------------------
   Tab Management
------------------------------ */
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");
  
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-tab");
      
      // Update active tab
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === `${targetTab}Tab`) {
          content.classList.add("active");
        }
      });
    });
  });
}

/* -----------------------------
   Payroll State & UI Elements
------------------------------ */
let currentUid = null;
let payrollEmployees = []; // Simple list for payroll autocomplete: { id, name, nameLower }
let payrollEntries = []; // { id, employeeId, employeeName, employeeNameLower, payDate, amount, method, createdAt }
let employeeRecords = []; // Full employee records for employee management: { id, name, email, phone, type, w9Url, coiUrl, workersCompUrl, ... }
let editingEmployeeId = null;

// Payroll UI elements
const statusText = $("statusText");
const employeeName = $("employeeName");
const employeeList = $("employeeList");
const payDate = $("payDate");
const amount = $("amount");
const method = $("method");
const formMsg = $("formMsg");
const saveBtn = $("saveBtn");
const resetBtn = $("resetBtn");
const monthCount = $("monthCount");
const monthTotal = $("monthTotal");
const allTotal = $("allTotal");
const paymentsTbody = $("paymentsTbody");
const tableMsg = $("tableMsg");
const searchBox = $("searchBox");
const filterMethod = $("filterMethod");
const fromDate = $("fromDate");
const toDate = $("toDate");
const clearFiltersBtn = $("clearFiltersBtn");
const exportCsvBtn = $("exportCsvBtn");

/* -----------------------------
   Firestore Path Helpers
------------------------------ */
function employeesCol(uid) {
  return collection(db, "users", uid, "employees");
}

function payrollEntriesCol(uid) {
  return collection(db, "users", uid, "payrollEntries");
}

function payrollEntryDoc(uid, entryId) {
  return doc(db, "users", uid, "payrollEntries", entryId);
}

/* -----------------------------
   Payroll Functions
------------------------------ */
function setFormMessage(type, text) {
  if (!formMsg) return;
  if (!text) {
    formMsg.innerHTML = "";
    return;
  }
  const cls = type === "error" ? "danger" : "success";
  formMsg.innerHTML = `<span class="${cls}">${text}</span>`;
}

function renderEmployeeDatalist() {
  if (!employeeList) return;
  employeeList.innerHTML = "";
  for (const e of payrollEmployees) {
    const opt = document.createElement("option");
    opt.value = e.name;
    employeeList.appendChild(opt);
  }
}

function passesFilters(p) {
  if (!searchBox || !filterMethod) return true;
  const term = searchBox.value.trim().toLowerCase();
  const meth = filterMethod.value;

  const from = fromDate?.value ? new Date(fromDate.value + "T00:00:00") : null;
  const to = toDate?.value ? new Date(toDate.value + "T23:59:59") : null;

  if (term && !(p.employeeNameLower || "").includes(term)) return false;
  if (meth && p.method !== meth) return false;

  if (from || to) {
    const d = new Date((p.payDate || "") + "T12:00:00");
    if (from && d < from) return false;
    if (to && d > to) return false;
  }

  return true;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === "—") return "—";
  try {
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    const yearShort = year.slice(-2);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    return `${monthNum}/${dayNum}/${yearShort}`;
  } catch (e) {
    return dateStr;
  }
}

function renderTable() {
  if (!paymentsTbody) return;
  const filtered = payrollEntries.filter(passesFilters);

  if (!filtered.length) {
    paymentsTbody.innerHTML =
      `<tr><td colspan="5" class="muted">No payroll entries found for the current filters.</td></tr>`;
    if (tableMsg) tableMsg.textContent = "";
    return;
  }

  paymentsTbody.innerHTML = "";
  for (const p of filtered) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDate(p.payDate) || "—";

    const tdEmp = document.createElement("td");
    tdEmp.textContent = p.employeeName || "—";

    const tdMethod = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = p.method || "—";
    tdMethod.appendChild(pill);

    const tdAmt = document.createElement("td");
    tdAmt.className = "right";
    tdAmt.textContent = money(p.amount);

    const tdAct = document.createElement("td");
    tdAct.className = "right";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => onDeleteEntry(p.id, p.employeeName, p.payDate));
    tdAct.appendChild(delBtn);

    tr.append(tdDate, tdEmp, tdMethod, tdAmt, tdAct);
    paymentsTbody.appendChild(tr);
  }

  if (tableMsg) {
    tableMsg.textContent = `Showing ${filtered.length} of ${payrollEntries.length} entries (max 500 loaded).`;
  }
}

function renderStats() {
  const start = monthStartISO();
  const monthEntries = payrollEntries.filter(p => (p.payDate || "") >= start);
  const monthSum = monthEntries.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const allSum = payrollEntries.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  if (monthCount) monthCount.textContent = String(monthEntries.length);
  if (monthTotal) monthTotal.textContent = money(monthSum);
  if (allTotal) allTotal.textContent = money(allSum);
}

async function loadPayrollEmployees() {
  if (!currentUid) return;
  const q = query(employeesCol(currentUid), orderBy("nameLower"));
  const snap = await getDocs(q);
  payrollEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderEmployeeDatalist();
}

async function loadPayrollEntries() {
  if (!currentUid) return;
  const q = query(payrollEntriesCol(currentUid), orderBy("payDate", "desc"), limit(500));
  const snap = await getDocs(q);
  payrollEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
  renderStats();
}

async function ensureEmployee(name) {
  const clean = normalizeName(name);
  const lower = clean.toLowerCase();
  if (!clean) throw new Error("Employee name is required.");

  const existing = payrollEmployees.find(e => e.nameLower === lower);
  if (existing) return existing;

  const ref = await addDoc(employeesCol(currentUid), {
    name: clean,
    nameLower: lower,
    createdAt: serverTimestamp()
  });

  const newEmp = { id: ref.id, name: clean, nameLower: lower };
  payrollEmployees.push(newEmp);
  payrollEmployees.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  renderEmployeeDatalist();
  return newEmp;
}

async function onSubmitPayroll(e) {
  e.preventDefault();
  if (!saveBtn) return;

  try {
    if (!currentUid) throw new Error("You must be logged in to use Payroll.");

    saveBtn.disabled = true;
    setFormMessage("", "");
    if (statusText) statusText.textContent = "Saving…";

    const empName = normalizeName(employeeName.value);
    const date = payDate.value;
    const amt = Number(amount.value);
    const meth = method.value;

    if (!empName) throw new Error("Please enter an employee name.");
    if (!date) throw new Error("Please choose a payment date.");
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Please enter a valid amount greater than 0.");
    if (!["Cash", "Check", "Zelle"].includes(meth)) throw new Error("Invalid payment method.");

    const emp = await ensureEmployee(empName);

    await addDoc(payrollEntriesCol(currentUid), {
      employeeId: emp.id,
      employeeName: emp.name,
      employeeNameLower: emp.nameLower,
      payDate: date,
      amount: Number(amt.toFixed(2)),
      method: meth,
      createdAt: serverTimestamp()
    });

    setFormMessage("success", "Payroll entry saved.");
    employeeName.value = "";
    amount.value = "";
    method.value = "Cash";

    await loadPayrollEntries();
    if (statusText) statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    setFormMessage("error", err?.message || "Error saving entry.");
    if (statusText) statusText.textContent = "Error";
  } finally {
    saveBtn.disabled = false;
  }
}

async function onDeleteEntry(entryId, empName, date) {
  const ok = confirm(`Delete this payroll entry?\n\nEmployee: ${empName || "—"}\nDate: ${formatDate(date) || "—"}`);
  if (!ok) return;

  try {
    if (statusText) statusText.textContent = "Deleting…";
    await deleteDoc(payrollEntryDoc(currentUid, entryId));
    payrollEntries = payrollEntries.filter(p => p.id !== entryId);
    renderTable();
    renderStats();
    if (statusText) statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    alert(err?.message || "Error deleting entry.");
    if (statusText) statusText.textContent = "Error";
  }
}

function clearFilters() {
  if (searchBox) searchBox.value = "";
  if (filterMethod) filterMethod.value = "";
  if (fromDate) fromDate.value = "";
  if (toDate) toDate.value = "";
  renderTable();
}

function exportCsv() {
  const rows = payrollEntries
    .filter(passesFilters)
    .map(p => ({
      payDate: p.payDate || "",
      employeeName: p.employeeName || "",
      method: p.method || "",
      amount: Number(p.amount || 0)
    }));

  if (!rows.length) {
    alert("No rows to export.");
    return;
  }

  const header = ["Date", "Employee", "Method", "Amount"];
  const lines = [
    header.join(","),
    ...rows.map(r => [
      csvCell(r.payDate),
      csvCell(r.employeeName),
      csvCell(r.method),
      csvCell(r.amount.toFixed(2))
    ].join(","))
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* -----------------------------
   Employee Management Functions
------------------------------ */
function showMsg(msg, isError = false) {
  const msgEl = $("formMsg");
  const errEl = $("formError");
  if (!msgEl || !errEl) return;
  if (isError) {
    msgEl.textContent = "";
    errEl.textContent = msg;
  } else {
    errEl.textContent = "";
    msgEl.textContent = msg;
  }
}

function clearMessages() {
  const msgEl = $("formMsg");
  const errEl = $("formError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

async function loadEmployeeRecords() {
  if (!currentUid) return;
  
  try {
    const employeesCol = collection(db, "users", currentUid, "employees");
    const q = query(employeesCol, orderBy("nameLower"));
    const snap = await getDocs(q);
    
    employeeRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEmployeesList();
    // Also update payroll autocomplete
    payrollEmployees = employeeRecords.map(e => ({ id: e.id, name: e.name, nameLower: e.nameLower }));
    renderEmployeeDatalist();
  } catch (err) {
    console.error("Error loading employees:", err);
    const listEl = $("employeesList");
    if (listEl) {
      listEl.innerHTML = `<div class="form-error">Error loading employees: ${getFriendlyError(err)}</div>`;
    }
  }
}

function renderEmployeesList() {
  const container = $("employeesList");
  if (!container) return;
  
  if (employeeRecords.length === 0) {
    container.innerHTML = `<div class="muted" data-i18n="employees.noEmployees">No employees added yet. Click "Add Employee" to get started.</div>`;
    return;
  }
  
  container.innerHTML = employeeRecords.map(emp => {
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

async function deleteFile(url) {
  if (!url) return;
  try {
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

function showForm(employee = null) {
  const formCard = $("employeeFormCard");
  const formTitle = $("formTitle");
  if (!formCard) return;
  
  editingEmployeeId = employee ? employee.id : null;
  formCard.style.display = "block";
  if (formTitle) formTitle.textContent = employee ? "Edit Employee" : "Add Employee";
  
  const form = $("employeeForm");
  if (form) form.reset();
  
  const empIdInput = $("employeeId");
  if (empIdInput) empIdInput.value = employee ? employee.id : "";
  
  const empName = $("empName");
  if (empName) empName.value = employee?.name || "";
  
  const empEmail = $("empEmail");
  if (empEmail) empEmail.value = employee?.email || "";
  
  const empPhone = $("empPhone");
  if (empPhone) empPhone.value = employee?.phone || "";
  
  const empType = $("empType");
  if (empType) empType.value = employee?.type || "";
  
  const empW9 = $("empW9");
  const empCoi = $("empCoi");
  const empWorkersComp = $("empWorkersComp");
  if (empW9) empW9.value = "";
  if (empCoi) empCoi.value = "";
  if (empWorkersComp) empWorkersComp.value = "";
  
  const w9Status = $("w9Status");
  const coiStatus = $("coiStatus");
  const workersCompStatus = $("workersCompStatus");
  if (w9Status) w9Status.textContent = employee?.w9Url ? "Current file uploaded" : "";
  if (coiStatus) coiStatus.textContent = employee?.coiUrl ? "Current file uploaded" : "";
  if (workersCompStatus) workersCompStatus.textContent = employee?.workersCompUrl ? "Current file uploaded" : "";
  
  toggleSubcontractorFields();
  clearMessages();
  
  formCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideForm() {
  const formCard = $("employeeFormCard");
  if (formCard) formCard.style.display = "none";
  editingEmployeeId = null;
  clearMessages();
}

function toggleSubcontractorFields() {
  const empType = $("empType");
  const subcontractorFields = $("subcontractorFields");
  if (!empType || !subcontractorFields) return;
  subcontractorFields.style.display = empType.value === "subcontractor" ? "block" : "none";
}

async function saveEmployee(e) {
  e.preventDefault();
  
  if (!currentUid) {
    showMsg("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveEmployeeBtn");
  if (!btn) return;
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages();
    showMsg("Saving employee...");
    
    const empName = $("empName");
    const empEmail = $("empEmail");
    const empPhone = $("empPhone");
    const empType = $("empType");
    
    if (!empName || !empType) return;
    
    const name = empName.value.trim();
    const email = empEmail?.value.trim() || "";
    const phone = empPhone?.value.trim() || "";
    const type = empType.value;
    
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
    
    let employeeId = editingEmployeeId;
    const existing = employeeId ? employeeRecords.find(e => e.id === employeeId) : null;
    
    if (!employeeId) {
      employeeData.createdAt = serverTimestamp();
      const employeesCol = collection(db, "users", currentUid, "employees");
      const newRef = await addDoc(employeesCol, employeeData);
      employeeId = newRef.id;
    } else {
      if (existing?.w9Url && !$("empW9")?.files[0]) employeeData.w9Url = existing.w9Url;
      if (existing?.coiUrl && !$("empCoi")?.files[0]) employeeData.coiUrl = existing.coiUrl;
      if (existing?.workersCompUrl && !$("empWorkersComp")?.files[0]) employeeData.workersCompUrl = existing.workersCompUrl;
    }
    
    const w9File = $("empW9")?.files[0];
    const coiFile = $("empCoi")?.files[0];
    const workersCompFile = $("empWorkersComp")?.files[0];
    
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
    
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await updateDoc(employeeRef, employeeData);
    
    showMsg("Employee saved successfully!", false);
    await loadEmployeeRecords();
    await loadPayrollEmployees();
    
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

async function deleteEmployee(employeeId, employeeName) {
  if (!confirm(`Delete ${employeeName || "this employee"}? This action cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const employee = employeeRecords.find(e => e.id === employeeId);
    
    if (employee?.w9Url) await deleteFile(employee.w9Url);
    if (employee?.coiUrl) await deleteFile(employee.coiUrl);
    if (employee?.workersCompUrl) await deleteFile(employee.workersCompUrl);
    
    const employeeRef = doc(db, "users", currentUid, "employees", employeeId);
    await deleteDoc(employeeRef);
    
    await loadEmployeeRecords();
    await loadPayrollEmployees();
  } catch (err) {
    console.error("Error deleting employee:", err);
    alert(`Error deleting employee: ${getFriendlyError(err)}`);
  }
}

function editEmployee(employeeId) {
  const employee = employeeRecords.find(e => e.id === employeeId);
  if (employee) {
    showForm(employee);
  }
}

window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;

/* -----------------------------
   Mobile Swipe Functionality
------------------------------ */
function initSwipe() {
  const container = document.getElementById("swipeContainer");
  const indicators = document.querySelectorAll(".swipe-indicators .indicator");
  if (!container || !indicators.length) return;
  
  let currentSlide = 0;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  if (window.innerWidth > 900) {
    return;
  }

  function updateIndicators(slideIndex) {
    indicators.forEach((ind, idx) => {
      ind.classList.toggle("active", idx === slideIndex);
    });
  }

  function goToSlide(index) {
    if (index < 0 || index >= container.children.length) return;
    currentSlide = index;
    container.scrollTo({
      left: index * container.offsetWidth,
      behavior: "smooth"
    });
    updateIndicators(index);
  }

  indicators.forEach((ind, idx) => {
    ind.addEventListener("click", () => goToSlide(idx));
  });

  container.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  });

  container.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    if (Math.abs(diff) > 10) {
      e.preventDefault();
    }
  });

  container.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - currentX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentSlide < container.children.length - 1) {
        goToSlide(currentSlide + 1);
      } else if (diff < 0 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      }
    }
  });

  container.addEventListener("scroll", () => {
    const slideIndex = Math.round(container.scrollLeft / container.offsetWidth);
    if (slideIndex !== currentSlide) {
      currentSlide = slideIndex;
      updateIndicators(slideIndex);
    }
  });

  updateIndicators(0);
}

/* -----------------------------
   Initialization
------------------------------ */
function init() {
  // Initialize tabs
  initTabs();
  
  // Set default date for payroll
  if (payDate) payDate.value = todayISO();
  
  // Payroll event listeners
  const paymentForm = $("paymentForm");
  if (paymentForm) paymentForm.addEventListener("submit", onSubmitPayroll);
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (employeeName) employeeName.value = "";
      if (amount) amount.value = "";
      if (method) method.value = "Cash";
      setFormMessage("", "");
    });
  }
  
  if (searchBox) searchBox.addEventListener("input", renderTable);
  if (filterMethod) filterMethod.addEventListener("change", renderTable);
  if (fromDate) fromDate.addEventListener("change", renderTable);
  if (toDate) toDate.addEventListener("change", renderTable);
  if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", clearFilters);
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
  
  // Employee management event listeners
  const addEmployeeBtn = $("addEmployeeBtn");
  if (addEmployeeBtn) addEmployeeBtn.addEventListener("click", () => showForm());
  
  const cancelBtn = $("cancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", hideForm);
  
  const employeeForm = $("employeeForm");
  if (employeeForm) employeeForm.addEventListener("submit", saveEmployee);
  
  const empType = $("empType");
  if (empType) empType.addEventListener("change", toggleSubcontractorFields);
  
  const empW9 = $("empW9");
  const empCoi = $("empCoi");
  const empWorkersComp = $("empWorkersComp");
  if (empW9) {
    empW9.addEventListener("change", (e) => {
      const w9Status = $("w9Status");
      if (w9Status) w9Status.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
  if (empCoi) {
    empCoi.addEventListener("change", (e) => {
      const coiStatus = $("coiStatus");
      if (coiStatus) coiStatus.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
  if (empWorkersComp) {
    empWorkersComp.addEventListener("change", (e) => {
      const workersCompStatus = $("workersCompStatus");
      if (workersCompStatus) workersCompStatus.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        currentUid = null;
        payrollEmployees = [];
        payrollEntries = [];
        employeeRecords = [];
        renderEmployeeDatalist();
        renderTable();
        renderEmployeesList();
        if (statusText) statusText.textContent = "Please log in to use Bookkeeping.";
        return;
      }
      
      currentUid = user.uid;
      if (statusText) statusText.textContent = "Loading…";
      
      await Promise.all([
        loadPayrollEmployees(),
        loadPayrollEntries(),
        loadEmployeeRecords()
      ]);
      
      if (statusText) statusText.textContent = "Ready";
    } catch (err) {
      console.error(err);
      if (statusText) statusText.textContent = "Error";
      setFormMessage("error", "Firebase error. Check config.js and Firestore rules.");
    }
  });
  
  // Initialize swipe after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initSwipe, 100);
    });
  } else {
    setTimeout(initSwipe, 100);
  }
  
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 900) {
      setTimeout(initSwipe, 100);
    }
  });
}

// Start initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

