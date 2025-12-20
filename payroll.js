// payroll.js (ES module)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ✅ Paste your existing Firebase config here:
const firebaseConfig = {
    apiKey: "AIzaSyBr6b0E8GN3svOILHgO2agCkW2VsJQIrdM",
    authDomain: "listo-c6a60.firebaseapp.com",
    projectId: "listo-c6a60",
    storageBucket: "listo-c6a60.firebasestorage.app",
    messagingSenderId: "646269984812",
    appId: "1:646269984812:web:6053f752c0d3c74f653189",
    measurementId: "G-HGZS09TX8G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const payrollForm = document.getElementById("payrollForm");
const paymentDateEl = document.getElementById("paymentDate");
const laborerNameEl = document.getElementById("laborerName");
const amountEl = document.getElementById("amount");
const workTypeEl = document.getElementById("workType");
const formMsg = document.getElementById("formMsg");

const totalsTableBody = document.querySelector("#totalsTable tbody");
const totalsCount = document.getElementById("totalsCount");
const totalsSum = document.getElementById("totalsSum");

const asOfDateEl = document.getElementById("asOfDate");
const runReportBtn = document.getElementById("runReportBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const reportTableBody = document.querySelector("#reportTable tbody");
const reportRange = document.getElementById("reportRange");
const reportSum = document.getElementById("reportSum");
const reportCount = document.getElementById("reportCount");

const logoutLink = document.getElementById("logoutLink");

let currentUid = null;
let lastReportRows = [];

// Helpers
function toCents(amountStr) {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centsToUsd(cents) {
  const dollars = (cents || 0) / 100;
  return dollars.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateToStartTimestamp(dateStr) {
  // dateStr = "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Timestamp.fromDate(dt);
}
function dateToEndTimestamp(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Timestamp.fromDate(dt);
}

function shiftMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoToday() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function setMsg(text, isError = false) {
  formMsg.textContent = text;
  formMsg.style.color = isError ? "rgba(255,120,120,0.95)" : "rgba(208,229,49,0.95)";
}

// Firestore path
function entriesCol(uid) {
  return collection(db, "users", uid, "payrollEntries");
}

async function addEntry(uid, entry) {
  await addDoc(entriesCol(uid), entry);
}

async function deleteEntry(uid, entryId) {
  await deleteDoc(doc(db, "users", uid, "payrollEntries", entryId));
}

// Totals by laborer (all-time)
async function loadTotals(uid) {
  const q = query(entriesCol(uid), orderBy("paymentDate", "desc"));
  const snap = await getDocs(q);

  const totals = new Map(); // laborerName => cents
  let grandTotal = 0;

  snap.forEach((d) => {
    const data = d.data();
    const name = (data.laborerName || "").trim() || "Unknown";
    const cents = Number(data.amountCents || 0);
    totals.set(name, (totals.get(name) || 0) + cents);
    grandTotal += cents;
  });

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    totalsTableBody.innerHTML = `<tr><td class="muted" colspan="2">No entries yet.</td></tr>`;
  } else {
    totalsTableBody.innerHTML = rows
      .map(([name, cents]) => `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td class="right">${centsToUsd(cents)}</td>
        </tr>
      `).join("");
  }

  totalsCount.textContent = `${rows.length} laborers`;
  totalsSum.textContent = `${centsToUsd(grandTotal)} total`;
}

// 12-month report ending on selected date
async function runReport(uid) {
  const asOf = asOfDateEl.value || isoToday();
  asOfDateEl.value = asOf;

  const endTs = dateToEndTimestamp(asOf);

  // start = asOf date minus 12 months + 1 day? Usually “last 12 months” includes same day.
  // We'll use: start = (asOf date shifted back 12 months) + 1 day at 00:00? Instead, clean: same month/day, 12 months prior, start of day.
  const [y, m, d] = asOf.split("-").map(Number);
  const endDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  const startDate = shiftMonths(endDate, -12);
  startDate.setHours(0, 0, 0, 0);

  const startIso = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const startTs = Timestamp.fromDate(startDate);

  reportRange.textContent = `Range: ${startIso} → ${asOf}`;

  const q = query(
    entriesCol(uid),
    where("paymentDate", ">=", startTs),
    where("paymentDate", "<=", endTs),
    orderBy("paymentDate", "desc")
  );

  const snap = await getDocs(q);

  const rows = [];
  let total = 0;

  snap.forEach((d) => {
    const data = d.data();
    const pd = data.paymentDate?.toDate?.() ? data.paymentDate.toDate() : null;
    const dateStr = pd ? pd.toISOString().slice(0, 10) : "";
    const name = (data.laborerName || "").trim();
    const work = (data.workType || "").trim();
    const cents = Number(data.amountCents || 0);

    total += cents;
    rows.push({
      id: d.id,
      date: dateStr,
      laborerName: name,
      workType: work,
      amountCents: cents
    });
  });

  lastReportRows = rows;

  reportSum.textContent = `${centsToUsd(total)} total`;
  reportCount.textContent = `${rows.length} entries`;

  if (rows.length === 0) {
    reportTableBody.innerHTML = `<tr><td class="muted" colspan="5">No entries found for that range.</td></tr>`;
    return;
  }

  reportTableBody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.laborerName)}</td>
      <td>${escapeHtml(r.workType)}</td>
      <td class="right">${centsToUsd(r.amountCents)}</td>
      <td class="right">
        <button class="btn-link" data-del="${r.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  // Wire delete buttons
  reportTableBody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Delete this entry?")) return;
      await deleteEntry(uid, id);
      await loadTotals(uid);
      await runReport(uid);
    });
  });
}

function exportReportCsv() {
  if (!lastReportRows || lastReportRows.length === 0) {
    alert("Run a report first.");
    return;
  }

  const headers = ["Date", "Laborer", "Work Type", "Amount"];
  const lines = [headers.join(",")];

  for (const r of lastReportRows) {
    const row = [
      csvSafe(r.date),
      csvSafe(r.laborerName),
      csvSafe(r.workType),
      csvSafe((r.amountCents / 100).toFixed(2))
    ];
    lines.push(row.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_report_${(asOfDateEl.value || isoToday())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvSafe(v) {
  const s = String(v ?? "");
  // escape quotes and wrap in quotes if needed
  if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Auth gate
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Redirect to your login page if different
    window.location.href = "login.html";
    return;
  }
  currentUid = user.uid;

  // defaults
  paymentDateEl.value = isoToday();
  asOfDateEl.value = isoToday();

  await loadTotals(currentUid);
  // optional: auto-run report on load
  await runReport(currentUid);
});

// Events
payrollForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;

  const paymentDate = paymentDateEl.value;
  const laborerName = laborerNameEl.value.trim();
  const workType = workTypeEl.value.trim();
  const cents = toCents(amountEl.value);

  if (!paymentDate || !laborerName || !workType || cents === null) {
    setMsg("Please fill out all fields correctly.", true);
    return;
  }

  try {
    await addEntry(currentUid, {
      paymentDate: dateToStartTimestamp(paymentDate),
      laborerName,
      workType,
      amountCents: cents,
      createdAt: serverTimestamp()
    });

    setMsg("Entry added.");
    amountEl.value = "";
    workTypeEl.value = "";
    // keep laborer name to speed entry; uncomment next line if you want it cleared:
    // laborerNameEl.value = "";

    await loadTotals(currentUid);
    await runReport(currentUid);
  } catch (err) {
    console.error(err);
    setMsg("Error saving entry. Check console.", true);
  }
});

runReportBtn.addEventListener("click", async () => {
  if (!currentUid) return;
  await runReport(currentUid);
});

exportCsvBtn.addEventListener("click", () => exportReportCsv());

if (logoutLink) {
  logoutLink.addEventListener("click", async (e) => {
    // If your logout is a real page, remove this handler.
    e.preventDefault();
    await signOut(auth);
    window.location.href = "login.html";
  });
}
