// invoice.js (Firebase v9+ modular assumed)
//
// Requirements:
// - config.js exports { auth, db } (initialized Firebase app)
// - Firestore stores invoices under: users/{uid}/invoices/{invoiceId}
// - A deployed Callable Cloud Function named: sendInvoiceEmail
//
// This version adds: "Send Invoice (Email PDF)" via SendGrid backend.

import { auth, db } from "../config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";

const el = (id) => document.getElementById(id);

const state = {
  uid: null,
  currentInvoiceId: null,
  items: []
};

// ----- Callable Function Handle -----
const functions = getFunctions();
const sendInvoiceEmailCallable = httpsCallable(functions, "sendInvoiceEmail");

// ---------- Helpers ----------
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeInvoiceNumber() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${r}`;
}

function setStatus(text, kind = "") {
  const pill = el("statusPill");
  pill.textContent = text;
  pill.className = `pill ${kind}`.trim();
}

function setSendResult(text, kind = "") {
  const box = el("sendResult");
  box.textContent = text || "";
  box.className = `muted ${kind}`.trim();
}

function setBusy(isBusy) {
  const ids = ["btnNew", "btnSave", "btnPdf", "btnSendEmail", "btnAddItem", "btnLoad", "btnDelete"];
  ids.forEach((id) => {
    const b = el(id);
    if (b) b.disabled = !!isBusy;
  });
}

// ---------- Items UI ----------
function addItemRow(item = { description: "", qty: 1, unitPrice: 0 }) {
  state.items.push({ ...item });
  renderItems();
}

function removeItem(index) {
  state.items.splice(index, 1);
  renderItems();
  recalcTotals();
}

function renderItems() {
  const body = el("itemsBody");
  body.innerHTML = "";

  state.items.forEach((item, idx) => {
    const tr = document.createElement("tr");

    const tdDesc = document.createElement("td");
    const desc = document.createElement("input");
    desc.value = item.description || "";
    desc.placeholder = "Labor / materials / service";
    desc.addEventListener("input", () => {
      state.items[idx].description = desc.value;
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdDesc.appendChild(desc);

    const tdQty = document.createElement("td");
    tdQty.className = "num";
    const qty = document.createElement("input");
    qty.type = "number";
    qty.step = "1";
    qty.min = "0";
    qty.value = item.qty ?? 1;
    qty.addEventListener("input", () => {
      state.items[idx].qty = num(qty.value);
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdQty.appendChild(qty);

    const tdUnit = document.createElement("td");
    tdUnit.className = "num";
    const unit = document.createElement("input");
    unit.type = "number";
    unit.step = "0.01";
    unit.min = "0";
    unit.value = item.unitPrice ?? 0;
    unit.addEventListener("input", () => {
      state.items[idx].unitPrice = num(unit.value);
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdUnit.appendChild(unit);

    const tdLine = document.createElement("td");
    tdLine.className = "num";
    const lineTotal = (num(item.qty) * num(item.unitPrice));
    tdLine.textContent = money(lineTotal);

    const tdActions = document.createElement("td");
    tdActions.className = "num";
    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.style.padding = "8px 10px";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => removeItem(idx));
    tdActions.appendChild(btn);

    tr.appendChild(tdDesc);
    tr.appendChild(tdQty);
    tr.appendChild(tdUnit);
    tr.appendChild(tdLine);
    tr.appendChild(tdActions);

    body.appendChild(tr);
  });

  if (state.items.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.style.padding = "16px";
    td.textContent = "No items yet. Click “Add Item”.";
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

// ---------- Totals ----------
function recalcTotals() {
  const subtotal = state.items.reduce((sum, it) => sum + (num(it.qty) * num(it.unitPrice)), 0);
  const taxRate = num(el("taxRate").value) / 100;
  const tax = subtotal * taxRate;

  const discount = num(el("discount").value);
  const deposit = num(el("deposit").value);

  const total = Math.max(0, subtotal + tax - discount - deposit);

  el("subtotalOut").textContent = money(subtotal);
  el("taxOut").textContent = money(tax);
  el("discountOut").textContent = money(discount);
  el("depositOut").textContent = money(deposit);
  el("totalOut").textContent = money(total);

  // Update per-line totals too
  [...document.querySelectorAll("#itemsBody tr")].forEach((tr, idx) => {
    const tdLine = tr.children?.[3];
    if (tdLine && state.items[idx]) {
      tdLine.textContent = money(num(state.items[idx].qty) * num(state.items[idx].unitPrice));
    }
  });

  return { subtotal, tax, discount, deposit, total };
}

// ---------- Build invoice object ----------
function collectInvoice() {
  const totals = recalcTotals();

  return {
    from: {
      name: el("fromName").value.trim(),
      email: el("fromEmail").value.trim(),
      phone: el("fromPhone").value.trim(),
      address: el("fromAddress").value.trim()
    },
    to: {
      name: el("toName").value.trim(),
      email: el("toEmail").value.trim(),
      phone: el("toPhone").value.trim(),
      address: el("toAddress").value.trim()
    },
    meta: {
      invoiceNumber: el("invoiceNumber").value.trim(),
      invoiceDate: el("invoiceDate").value,
      dueDate: el("dueDate").value,
      projectName: el("projectName").value.trim()
    },
    items: state.items.map((it) => ({
      description: (it.description || "").trim(),
      qty: num(it.qty),
      unitPrice: num(it.unitPrice)
    })),
    adjustments: {
      taxRatePct: num(el("taxRate").value),
      discount: num(el("discount").value),
      deposit: num(el("deposit").value)
    },
    totals,
    notes: el("notes").value.trim(),
    paymentInstructions: el("paymentInstructions").value.trim()
  };
}

function fillInvoice(data) {
  // Company
  el("fromName").value = data?.from?.name || "";
  el("fromEmail").value = data?.from?.email || "";
  el("fromPhone").value = data?.from?.phone || "";
  el("fromAddress").value = data?.from?.address || "";

  // Customer
  el("toName").value = data?.to?.name || "";
  el("toEmail").value = data?.to?.email || "";
  el("toPhone").value = data?.to?.phone || "";
  el("toAddress").value = data?.to?.address || "";

  // Meta
  el("invoiceNumber").value = data?.meta?.invoiceNumber || makeInvoiceNumber();
  el("invoiceDate").value = data?.meta?.invoiceDate || todayISO();
  el("dueDate").value = data?.meta?.dueDate || "";
  el("projectName").value = data?.meta?.projectName || "";

  // Items
  state.items = Array.isArray(data?.items) ? data.items.map(i => ({
    description: i.description || "",
    qty: num(i.qty ?? 1),
    unitPrice: num(i.unitPrice ?? 0)
  })) : [];

  // Adjustments
  el("taxRate").value = data?.adjustments?.taxRatePct ?? 0;
  el("discount").value = data?.adjustments?.discount ?? 0;
  el("deposit").value = data?.adjustments?.deposit ?? 0;

  el("notes").value = data?.notes || "";
  el("paymentInstructions").value = data?.paymentInstructions || "";

  renderItems();
  recalcTotals();
}

// ---------- Firestore ----------
function invoicesCol() {
  if (!state.uid) throw new Error("Not authenticated.");
  return collection(db, "users", state.uid, "invoices");
}

function contractsCol() {
  if (!state.uid) throw new Error("Not authenticated.");
  return collection(db, "users", state.uid, "contracts");
}

async function loadContracts() {
  if (!state.uid) return [];
  try {
    const q = query(contractsCol(), orderBy("builderName"));
    const snap = await getDocs(q);
    // Filter for active contracts (isActive !== false)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.isActive !== false);
  } catch (err) {
    console.error("Error loading contracts:", err);
    return [];
  }
}

async function loadJobs(contractId) {
  if (!state.uid || !contractId) return [];
  try {
    const jobsCol = collection(db, "users", state.uid, "contracts", contractId, "jobs");
    const q = query(jobsCol, orderBy("jobName"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading jobs:", err);
    return [];
  }
}

async function refreshBuilderSelect() {
  const select = el("selectBuilder");
  const jobSelect = el("selectJob");
  if (!select) return;
  
  const contracts = await loadContracts();
  select.innerHTML = '<option value="">— Select a builder —</option>';
  
  // Only access jobSelect if it exists
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
    jobSelect.style.display = "none";
  }
  
  contracts.forEach(contract => {
    const opt = document.createElement("option");
    opt.value = contract.id;
    opt.textContent = contract.builderName || "Unnamed Builder";
    select.appendChild(opt);
  });
}

async function refreshJobSelect(contractId) {
  const jobSelect = el("selectJob");
  if (!jobSelect) return;
  
  if (!contractId) {
    jobSelect.style.display = "none";
    jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
    return;
  }
  
  const jobs = await loadJobs(contractId);
  jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
  jobSelect.style.display = "block";
  
  jobs.forEach(job => {
    const opt = document.createElement("option");
    opt.value = job.id;
    opt.textContent = job.jobName || "Unnamed Job";
    opt.dataset.address = job.address || "";
    opt.dataset.description = job.description || "";
    jobSelect.appendChild(opt);
  });
}

async function fillCustomerFromBuilder(contractId, jobId = null) {
  if (!contractId) return;
  
  try {
    const contractRef = doc(db, "users", state.uid, "contracts", contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) return;
    
    const contract = contractSnap.data();
    
    // Fill customer name with builder name
    el("toName").value = contract.builderName || "";
    
    // If job is selected, fill project name and address
    if (jobId) {
      const jobRef = doc(db, "users", state.uid, "contracts", contractId, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      
      if (jobSnap.exists()) {
        const job = jobSnap.data();
        el("projectName").value = job.jobName || "";
        el("toAddress").value = job.address || "";
      }
    }
  } catch (err) {
    console.error("Error filling customer info:", err);
  }
}

async function refreshSavedInvoices() {
  const sel = el("savedInvoicesSelect");
  sel.innerHTML = `<option value="">— Load a saved invoice —</option>`;

  if (!state.uid) return;

  const q = query(invoicesCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  snap.forEach((d) => {
    const inv = d.data();
    const numStr = inv?.meta?.invoiceNumber || "Invoice";
    const nameStr = inv?.to?.name ? ` • ${inv.to.name}` : "";
    const dateStr = inv?.meta?.invoiceDate ? ` • ${inv.meta.invoiceDate}` : "";
    const sentStr = inv?.sentAt ? " • SENT" : "";
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${numStr}${nameStr}${dateStr}${sentStr}`;
    sel.appendChild(opt);
  });
}

async function saveInvoice() {
  if (!state.uid) {
    alert("Please sign in first.");
    return null;
  }

  const invoice = collectInvoice();

  if (!invoice.meta.invoiceNumber) invoice.meta.invoiceNumber = makeInvoiceNumber();
  if (!invoice.meta.invoiceDate) invoice.meta.invoiceDate = todayISO();

  const payload = {
    ...invoice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(invoicesCol(), payload);
  state.currentInvoiceId = ref.id;

  setStatus("Saved", "ok");
  await refreshSavedInvoices();
  el("savedInvoicesSelect").value = ref.id;

  return ref.id;
}

async function loadInvoice() {
  const id = el("savedInvoicesSelect").value;
  if (!id) return;

  const ref = doc(db, "users", state.uid, "invoices", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("Invoice not found.");
    return;
  }

  state.currentInvoiceId = id;
  fillInvoice(snap.data());
  setStatus("Loaded", "ok");
  setSendResult("");
}

async function deleteInvoice() {
  const id = el("savedInvoicesSelect").value;
  if (!id) {
    alert("Choose an invoice first.");
    return;
  }
  const ok = confirm("Delete this saved invoice? This cannot be undone.");
  if (!ok) return;

  const ref = doc(db, "users", state.uid, "invoices", id);
  await deleteDoc(ref);

  if (state.currentInvoiceId === id) {
    state.currentInvoiceId = null;
    setStatus("Not saved", "");
  }

  await refreshSavedInvoices();
  el("savedInvoicesSelect").value = "";
  setSendResult("");
}

// ---------- PDF (Client download) ----------
function buildPdfFileName(invoice) {
  const invNo = invoice.meta.invoiceNumber || "invoice";
  const customer = (invoice.to.name || "").replace(/[^\w\-]+/g, "_").slice(0, 40);
  return `${invNo}${customer ? "_" + customer : ""}.pdf`;
}

function downloadPdf() {
  const invoice = collectInvoice();

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();

  const left = 14;
  let y = 14;

  docPdf.setFontSize(18);
  docPdf.text("INVOICE", left, y);
  y += 8;

  docPdf.setFontSize(11);
  docPdf.text(`Invoice #: ${invoice.meta.invoiceNumber || ""}`, left, y); y += 6;
  docPdf.text(`Invoice Date: ${invoice.meta.invoiceDate || ""}`, left, y); y += 6;
  docPdf.text(`Due Date: ${invoice.meta.dueDate || ""}`, left, y); y += 8;

  docPdf.setFontSize(12);
  docPdf.text("From:", left, y); y += 6;
  docPdf.setFontSize(10);
  docPdf.text(`${invoice.from.name || ""}`, left, y); y += 5;
  if (invoice.from.email) { docPdf.text(`Email: ${invoice.from.email}`, left, y); y += 5; }
  if (invoice.from.phone) { docPdf.text(`Phone: ${invoice.from.phone}`, left, y); y += 5; }
  if (invoice.from.address) { docPdf.text(invoice.from.address, left, y); y += 10; } else { y += 6; }

  docPdf.setFontSize(12);
  docPdf.text("Bill To:", left, y); y += 6;
  docPdf.setFontSize(10);
  docPdf.text(`${invoice.to.name || ""}`, left, y); y += 5;
  if (invoice.to.email) { docPdf.text(`Email: ${invoice.to.email}`, left, y); y += 5; }
  if (invoice.to.phone) { docPdf.text(`Phone: ${invoice.to.phone}`, left, y); y += 5; }
  if (invoice.to.address) { docPdf.text(invoice.to.address, left, y); y += 8; } else { y += 6; }

  if (invoice.meta.projectName) {
    docPdf.setFontSize(11);
    docPdf.text(`Project: ${invoice.meta.projectName}`, left, y);
    y += 8;
  }

  const tableRows = invoice.items.map((it) => ([
    it.description || "",
    String(num(it.qty)),
    money(num(it.unitPrice)),
    money(num(it.qty) * num(it.unitPrice))
  ]));

  docPdf.autoTable({
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Line Total"]],
    body: tableRows.length ? tableRows : [["(no items)", "", "", ""]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 24, 39] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" }
    }
  });

  const afterTableY = docPdf.lastAutoTable.finalY + 8;

  const totals = invoice.totals;
  const lines = [
    ["Subtotal", money(totals.subtotal)],
    ["Tax", money(totals.tax)],
    ["Discount", money(totals.discount)],
    ["Deposit", money(totals.deposit)],
    ["Total Due", money(totals.total)]
  ];

  let ty = afterTableY;
  docPdf.setFontSize(11);
  lines.forEach(([k, v], idx) => {
    if (idx === lines.length - 1) docPdf.setFont(undefined, "bold");
    docPdf.text(k, left, ty);
    docPdf.text(v, 200 - left, ty, { align: "right" });
    docPdf.setFont(undefined, "normal");
    ty += 6;
  });

  ty += 4;
  if (invoice.paymentInstructions) {
    docPdf.setFontSize(11);
    docPdf.text("Payment Instructions:", left, ty); ty += 6;
    docPdf.setFontSize(10);
    docPdf.text(invoice.paymentInstructions, left, ty);
    ty += 10;
  }

  if (invoice.notes) {
    docPdf.setFontSize(11);
    docPdf.text("Notes:", left, ty); ty += 6;
    docPdf.setFontSize(10);
    docPdf.text(invoice.notes, left, ty);
  }

  docPdf.save(buildPdfFileName(invoice));
}

// ---------- SendGrid email (via Callable Cloud Function) ----------
function getFriendlyError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("unauthenticated")) return "Please sign in again.";
  if (msg.includes("permission-denied")) return "Permission denied.";
  if (msg.includes("not-found")) return "Invoice not found.";
  if (msg.includes("failed-precondition")) return "Missing required fields (like customer email).";
  if (msg.includes("invalid-argument")) return "Invalid request.";
  return err?.message || "Email send failed.";
}

async function sendInvoiceEmail() {
  if (!state.uid) {
    alert("Please sign in first.");
    return;
  }

  setSendResult("");
  setBusy(true);
  setStatus("Sending…", "warn");

  try {
    // Ensure invoice is saved so backend can fetch it
    let invoiceId = state.currentInvoiceId;

    // If not saved yet OR edited since last save, we save a fresh copy (history-friendly)
    if (!invoiceId) {
      invoiceId = await saveInvoice();
    } else {
      // Optional: if you want to force-save on send every time:
      // invoiceId = await saveInvoice();
    }

    if (!invoiceId) {
      setStatus("Not saved", "");
      setBusy(false);
      return;
    }

    // Basic checks before calling backend
    const toEmail = el("toEmail").value.trim();
    if (!toEmail) {
      setStatus("Missing customer email", "err");
      setSendResult("Customer email is required to send.", "err");
      setBusy(false);
      return;
    }

    const res = await sendInvoiceEmailCallable({ invoiceId });

    if (res?.data?.ok) {
      setStatus("Sent", "ok");
      setSendResult("Invoice emailed successfully (PDF attached).", "ok");
      await refreshSavedInvoices();
      if (el("savedInvoicesSelect").value) {
        // Keep selection as-is
      } else if (state.currentInvoiceId) {
        el("savedInvoicesSelect").value = state.currentInvoiceId;
      }
    } else {
      setStatus("Send failed", "err");
      setSendResult("Send failed (no ok response).", "err");
    }
  } catch (err) {
    setStatus("Send failed", "err");
    setSendResult(getFriendlyError(err), "err");
    console.error(err);
  } finally {
    setBusy(false);
  }
}

// ---------- New invoice ----------
function newInvoice() {
  state.currentInvoiceId = null;

  fillInvoice({
    from: { name: "", email: "", phone: "", address: "" },
    to: { name: "", email: "", phone: "", address: "" },
    meta: { invoiceNumber: makeInvoiceNumber(), invoiceDate: todayISO(), dueDate: "", projectName: "" },
    items: [{ description: "Labor", qty: 1, unitPrice: 0 }],
    adjustments: { taxRatePct: 0, discount: 0, deposit: 0 },
    notes: "Thank you for your business.",
    paymentInstructions: ""
  });

  setSendResult("");
  setStatus("Not saved", "");
}

// ---------- Wire up ----------
function addListeners() {
  el("btnAddItem").addEventListener("click", () => addItemRow());
  el("btnSave").addEventListener("click", async () => {
    setSendResult("");
    await saveInvoice();
  });
  el("btnPdf").addEventListener("click", downloadPdf);
  el("btnSendEmail").addEventListener("click", sendInvoiceEmail);
  el("btnNew").addEventListener("click", () => {
    newInvoice();
    el("selectBuilder").value = "";
    el("selectJob").value = "";
    el("selectJob").style.display = "none";
  });
  el("btnLoad").addEventListener("click", loadInvoice);
  el("btnDelete").addEventListener("click", deleteInvoice);
  
  // Builder/Job selection handlers
  el("selectBuilder").addEventListener("change", async (e) => {
    const contractId = e.target.value;
    await refreshJobSelect(contractId);
    await fillCustomerFromBuilder(contractId);
  });
  
  el("selectJob").addEventListener("change", async (e) => {
    const contractId = el("selectBuilder").value;
    const jobId = e.target.value;
    await fillCustomerFromBuilder(contractId, jobId);
    
    // Also fill project name and address from job
    if (jobId && e.target.selectedOptions[0]) {
      const opt = e.target.selectedOptions[0];
      const address = opt.dataset.address || "";
      
      if (address) el("toAddress").value = address;
      if (opt.textContent) el("projectName").value = opt.textContent;
    }
  });

  ["taxRate", "discount", "deposit"].forEach((id) => {
    el(id).addEventListener("input", () => {
      setSendResult("");
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
  });

  [
    "fromName","fromEmail","fromPhone","fromAddress",
    "toName","toEmail","toPhone","toAddress",
    "invoiceNumber","invoiceDate","dueDate","projectName",
    "notes","paymentInstructions"
  ].forEach((id) => {
    el(id).addEventListener("input", () => {
      setSendResult("");
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.uid = null;
    setStatus("Sign in required", "warn");
    newInvoice(); // still usable locally (PDF download), but no saving/sending
    el("selectBuilder").innerHTML = '<option value="">— Select a builder —</option>';
    el("selectJob").innerHTML = '<option value="">— Select a job (optional) —</option>';
    el("selectJob").style.display = "none";
    return;
  }

  state.uid = user.uid;
  setStatus("Not saved", "");

  el("invoiceDate").value = el("invoiceDate").value || todayISO();
  if (!el("invoiceNumber").value) el("invoiceNumber").value = makeInvoiceNumber();

  await refreshSavedInvoices();
  await refreshBuilderSelect();
});

// Boot
addListeners();
newInvoice();
