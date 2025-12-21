// payroll.js
// Payroll Tracker (Firestore) - locked to each logged-in user
// Matches rules:
// - /users/{uid}/employees/{employeeId}
// - /users/{uid}/payrollEntries/{entryId}

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { db, auth } from "../config.js";

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

/* -----------------------------
   UI elements (must exist in payroll.html)
------------------------------ */
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
   State
------------------------------ */
let currentUid = null;
let employees = []; // { id, name, nameLower }
let payrollEntries = []; // { id, employeeId, employeeName, employeeNameLower, payDate, amount, method, createdAt }

/* -----------------------------
   Firestore path helpers (these are the “paths”)
------------------------------ */
function employeesCol(uid) {
  // /users/{uid}/employees
  return collection(db, "users", uid, "employees");
}

function payrollEntriesCol(uid) {
  // /users/{uid}/payrollEntries
  return collection(db, "users", uid, "payrollEntries");
}

function payrollEntryDoc(uid, entryId) {
  // /users/{uid}/payrollEntries/{entryId}
  return doc(db, "users", uid, "payrollEntries", entryId);
}

/* -----------------------------
   Rendering
------------------------------ */
function setFormMessage(type, text) {
  if (!text) {
    formMsg.innerHTML = "";
    return;
  }
  const cls = type === "error" ? "danger" : "success";
  formMsg.innerHTML = `<span class="${cls}">${text}</span>`;
}

function renderEmployeeDatalist() {
  employeeList.innerHTML = "";
  for (const e of employees) {
    const opt = document.createElement("option");
    opt.value = e.name;
    employeeList.appendChild(opt);
  }
}

function passesFilters(p) {
  const term = searchBox.value.trim().toLowerCase();
  const meth = filterMethod.value;

  const from = fromDate.value ? new Date(fromDate.value + "T00:00:00") : null;
  const to = toDate.value ? new Date(toDate.value + "T23:59:59") : null;

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
    // Get 2-digit year
    const yearShort = year.slice(-2);
    // Remove leading zeros from month and day
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    return `${monthNum}/${dayNum}/${yearShort}`;
  } catch (e) {
    return dateStr;
  }
}

function renderTable() {
  const filtered = payrollEntries.filter(passesFilters);

  if (!filtered.length) {
    paymentsTbody.innerHTML =
      `<tr><td colspan="5" class="muted">No payroll entries found for the current filters.</td></tr>`;
    tableMsg.textContent = "";
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

  tableMsg.textContent = `Showing ${filtered.length} of ${payrollEntries.length} entries (max 500 loaded).`;
}

function renderStats() {
  const start = monthStartISO();

  const monthEntries = payrollEntries.filter(p => (p.payDate || "") >= start);
  const monthSum = monthEntries.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const allSum = payrollEntries.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  monthCount.textContent = String(monthEntries.length);
  monthTotal.textContent = money(monthSum);
  allTotal.textContent = money(allSum);
}

/* -----------------------------
   Loaders
------------------------------ */
async function loadEmployees() {
  const q = query(employeesCol(currentUid), orderBy("nameLower"));
  const snap = await getDocs(q);

  employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderEmployeeDatalist();
}

async function loadPayrollEntries() {
  const q = query(payrollEntriesCol(currentUid), orderBy("payDate", "desc"), limit(500));
  const snap = await getDocs(q);

  payrollEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
  renderStats();
}

/* -----------------------------
   Actions
------------------------------ */
async function ensureEmployee(name) {
  const clean = normalizeName(name);
  const lower = clean.toLowerCase();
  if (!clean) throw new Error("Employee name is required.");

  const existing = employees.find(e => e.nameLower === lower);
  if (existing) return existing;

  // Must match rules: keys must be only name, nameLower, createdAt
  const ref = await addDoc(employeesCol(currentUid), {
    name: clean,
    nameLower: lower,
    createdAt: serverTimestamp()
  });

  const newEmp = { id: ref.id, name: clean, nameLower: lower };
  employees.push(newEmp);
  employees.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  renderEmployeeDatalist();
  return newEmp;
}

async function onSubmit(e) {
  e.preventDefault();

  try {
    if (!currentUid) throw new Error("You must be logged in to use Payroll.");

    saveBtn.disabled = true;
    setFormMessage("", "");
    statusText.textContent = "Saving…";

    const empName = normalizeName(employeeName.value);
    const date = payDate.value; // must be YYYY-MM-DD
    const amt = Number(amount.value);
    const meth = method.value;

    if (!empName) throw new Error("Please enter an employee name.");
    if (!date) throw new Error("Please choose a payment date.");
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Please enter a valid amount greater than 0.");
    if (!["Cash", "Check", "Zelle"].includes(meth)) throw new Error("Invalid payment method.");

    const emp = await ensureEmployee(empName);

    // Must match rules: keys must be exactly the listed 7 keys
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
    statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    setFormMessage("error", err?.message || "Error saving entry.");
    statusText.textContent = "Error";
  } finally {
    saveBtn.disabled = false;
  }
}

async function onDeleteEntry(entryId, empName, date) {
  const ok = confirm(`Delete this payroll entry?\n\nEmployee: ${empName || "—"}\nDate: ${formatDate(date) || "—"}`);
  if (!ok) return;

  try {
    statusText.textContent = "Deleting…";
    await deleteDoc(payrollEntryDoc(currentUid, entryId));
    payrollEntries = payrollEntries.filter(p => p.id !== entryId);
    renderTable();
    renderStats();
    statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    alert(err?.message || "Error deleting entry.");
    statusText.textContent = "Error";
  }
}

function clearFilters() {
  searchBox.value = "";
  filterMethod.value = "";
  fromDate.value = "";
  toDate.value = "";
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
   Init
------------------------------ */
function setLoggedOutUI() {
  statusText.textContent = "Please log in to use Payroll.";
  employees = [];
  payrollEntries = [];
  renderEmployeeDatalist();
  paymentsTbody.innerHTML = `<tr><td colspan="5" class="muted">Log in to view payroll entries.</td></tr>`;
  tableMsg.textContent = "";
  monthCount.textContent = "—";
  monthTotal.textContent = "—";
  allTotal.textContent = "—";
}

async function initForUser(uid) {
  currentUid = uid;
  statusText.textContent = "Loading…";

  payDate.value = payDate.value || todayISO();

  await loadEmployees();
  await loadPayrollEntries();

  statusText.textContent = "Ready";
}

function init() {
  payDate.value = todayISO();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        currentUid = null;
        setLoggedOutUI();
        return;
      }
      await initForUser(user.uid);
    } catch (err) {
      console.error(err);
      statusText.textContent = "Error";
      setFormMessage("error", "Firebase error. Check config.js and Firestore rules.");
    }
  });
}

/* -----------------------------
   Events
------------------------------ */
$("paymentForm").addEventListener("submit", onSubmit);
resetBtn.addEventListener("click", () => {
  employeeName.value = "";
  amount.value = "";
  method.value = "Cash";
  setFormMessage("", "");
});

searchBox.addEventListener("input", renderTable);
filterMethod.addEventListener("change", renderTable);
fromDate.addEventListener("change", renderTable);
toDate.addEventListener("change", renderTable);

clearFiltersBtn.addEventListener("click", clearFilters);
exportCsvBtn.addEventListener("click", exportCsv);

init();
