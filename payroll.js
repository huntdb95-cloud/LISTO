// payroll.js
// Professional Payroll Tracker (Firestore) - PER USER
// Data model (per logged-in user):
// - /users/{uid}/employees/{employeeId}: { name, nameLower, createdAt }
// - /users/{uid}/payrollEntries/{entryId}: { employeeId, employeeName, employeeNameLower, payDate, amount, method, createdAt }

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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ✅ Adjust this import to match YOUR config.js
import { db } from "./config.js";

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
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

/* -----------------------------
   State
------------------------------ */
let employees = []; // {id, name, nameLower}
let payments = [];  // {id, ...}
let currentUid = null;

/* -----------------------------
   UI elements
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
   Path helpers (THIS is the “addDoc path” part)
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
   Loaders
------------------------------ */
async function loadEmployees() {
  const q = query(employeesCol(currentUid), orderBy("nameLower"));
  const snap = await getDocs(q);

  employees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderEmployeeDatalist();
}

async function loadPayments() {
  const q = query(payrollEntriesCol(currentUid), orderBy("payDate", "desc"), limit(500));
  const snap = await getDocs(q);

  payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderPaymentsTable();
  renderStats();
}

/* -----------------------------
   Rendering
------------------------------ */
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

function renderPaymentsTable() {
  const filtered = payments.filter(passesFilters);

  if (!filtered.length) {
    paymentsTbody.innerHTML = `<tr><td colspan="5" class="muted">No payments found for the current filters.</td></tr>`;
    tableMsg.textContent = "";
    return;
  }

  paymentsTbody.innerHTML = "";
  for (const p of filtered) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = p.payDate || "—";

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
    delBtn.addEventListener("click", () => onDeletePayment(p.id, p.employeeName, p.payDate));
    tdAct.appendChild(delBtn);

    tr.append(tdDate, tdEmp, tdMethod, tdAmt, tdAct);
    paymentsTbody.appendChild(tr);
  }

  tableMsg.textContent = `Showing ${filtered.length} of ${payments.length} payments (max 500 loaded).`;
}

function renderStats() {
  const start = monthStartISO();

  const monthPays = payments.filter(p => (p.payDate || "") >= start);
  const monthSum = monthPays.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const allSum = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  monthCount.textContent = String(monthPays.length);
  monthTotal.textContent = money(monthSum);
  allTotal.textContent = money(allSum);
}

function setFormMessage(type, text) {
  if (!text) {
    formMsg.innerHTML = "";
    return;
  }
  const cls = type === "error" ? "danger" : "success";
  formMsg.innerHTML = `<span class="${cls}">${text}</span>`;
}

/* -----------------------------
   Actions
------------------------------ */
async function ensureEmployee(name) {
  const clean = normalizeName(name);
  const lower = clean.toLowerCase();
  if (!clean) throw new Error("Employee name is required.");

  // If already loaded, return it
  const existing = employees.find(e => e.nameLower === lower);
  if (existing) return existing;

  // Otherwise create under /users/{uid}/employees
  const ref = await addDoc(employeesCol(currentUid), {
    name: clean,
    nameLower: lower,
    createdAt: serverTimestamp(),
  });

  const newEmp = { id: ref.id, name: clean, nameLower: lower };
  employees.push(newEmp);
  employees.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  renderEmployeeDatalist();
  return newEmp;
}

async function onSubmitPayment(e) {
  e.preventDefault();

  try {
    if (!currentUid) throw new Error("You must be logged in to save payroll.");

    saveBtn.disabled = true;
    setFormMessage("", "");

    const empName = normalizeName(employeeName.value);
    const date = payDate.value;
    const amt = Number(amount.value);
    const meth = method.value;

    if (!empName) throw new Error("Please enter an employee name.");
    if (!date) throw new Error("Please choose a payment date.");
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Please enter a valid amount greater than 0.");
    if (!meth) throw new Error("Please choose a payment method.");

    statusText.textContent = "Saving…";

    const emp = await ensureEmployee(empName);

    // ✅ This is the new “addDoc path”:
    // /users/{uid}/payrollEntries
    await addDoc(payrollEntriesCol(currentUid), {
      employeeId: emp.id,
      employeeName: emp.name,
      employeeNameLower: emp.nameLower,
      payDate: date,
      amount: Number(amt.toFixed(2)),
      method: meth,
      createdAt: serverTimestamp(),
    });

    setFormMessage("success", "Payment saved.");
    resetFormKeepToday();
    await loadPayments();
    statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    setFormMessage("error", err?.message || "Error saving payment.");
    statusText.textContent = "Error";
  } finally {
    saveBtn.disabled = false;
  }
}

function resetFormKeepToday() {
  employeeName.value = "";
  amount.value = "";
  method.value = "Cash";
  // keep date as-is
}

async function onDeletePayment(paymentId, empName, date) {
  const ok = confirm(`Delete this payment?\n\nEmployee: ${empName || "—"}\nDate: ${date || "—"}`);
  if (!ok) return;

  try {
    statusText.textContent = "Deleting…";

    // ✅ This is the new “doc path”:
    // /users/{uid}/payrollEntries/{paymentId}
    await deleteDoc(payrollEntryDoc(currentUid, paymentId));

    payments = payments.filter(p => p.id !== paymentId);
    renderPaymentsTable();
    renderStats();
    statusText.textContent = "Ready";
  } catch (err) {
    console.error(err);
    alert(err?.message || "Error deleting payment.");
    statusText.textContent = "Error";
  }
}

function clearFilters() {
  searchBox.value = "";
  filterMethod.value = "";
  fromDate.value = "";
  toDate.value = "";
  renderPaymentsTable();
}

function exportCsv() {
  const rows = payments.filter(passesFilters).map(p => ({
    payDate: p.payDate || "",
    employeeName: p.employeeName || "",
    method: p.method || "",
    amount: Number(p.amount || 0),
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
      csvCell(r.amount.toFixed(2)),
    ].join(",")),
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
async function initForUser(uid) {
  currentUid = uid;

  statusText.textContent = "Loading…";
  payDate.value = todayISO();

  await loadEmployees();
  await loadPayments();

  statusText.textContent = "Ready";
}

function init() {
  payDate.value = todayISO();

  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        currentUid = null;
        statusText.textContent = "Please log in to use Payroll.";
        employees = [];
        payments = [];
        renderEmployeeDatalist();
        paymentsTbody.innerHTML = `<tr><td colspan="5" class="muted">Log in to view payroll entries.</td></tr>`;
        monthCount.textContent = "—";
        monthTotal.textContent = "—";
        allTotal.textContent = "—";
        return;
      }

      await initForUser(user.uid);
    } catch (err) {
      console.error(err);
      statusText.textContent = "Error";
      formMsg.innerHTML = `<span class="danger">Firebase not ready. Check config.js export (db) and Firestore rules.</span>`;
    }
  });
}

$("paymentForm").addEventListener("submit", onSubmitPayment);
resetBtn.addEventListener("click", resetFormKeepToday);

searchBox.addEventListener("input", renderPaymentsTable);
filterMethod.addEventListener("change", renderPaymentsTable);
fromDate.addEventListener("change", renderPaymentsTable);
toDate.addEventListener("change", renderPaymentsTable);

clearFiltersBtn.addEventListener("click", clearFilters);
exportCsvBtn.addEventListener("click", exportCsv);

init();
