// invoice.js (Firebase v9+ modular assumed)
//
// Requirements:
// - You already have a config.js that exports { auth, db }
// - Firebase Auth is used to identify the contractor (user)
// - Firestore stores invoices under: users/{uid}/invoices/{invoiceId}

import { auth, db } from "./config.js";
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
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const state = {
  uid: null,
  currentInvoiceId: null,
  items: []
};

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
  // Simple local number; you can swap for a stronger scheme later
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${r}`;
}

function setStatus(text) {
  el("statusPill").textContent = text;
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
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved");
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
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved");
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
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved");
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
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${numStr}${nameStr}${dateStr}`;
    sel.appendChild(opt);
  });
}

async function saveInvoice() {
  if (!state.uid) {
    alert("Please sign in first.");
    return;
  }

  const invoice = collectInvoice();

  if (!invoice.meta.invoiceNumber) invoice.meta.invoiceNumber = makeInvoiceNumber();
  if (!invoice.meta.invoiceDate) invoice.meta.invoiceDate = todayISO();

  const payload = {
    ...invoice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // For simplicity: always create a new record (keeps history)
  const ref = await addDoc(invoicesCol(), payload);
  state.currentInvoiceId = ref.id;

  setStatus("Saved");
  await refreshSavedInvoices();
  el("savedInvoicesSelect").value = ref.id;
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
  setStatus("Loaded");
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
    setStatus("Not saved");
  }

  await refreshSavedInvoices();
  el("savedInvoicesSelect").value = "";
}

// ---------- PDF ----------
function buildPdfFileName(invoice) {
  const invNo = invoice.meta.invoiceNumber || "invoice";
  const customer = (invoice.to.name || "").replace(/[^\w\-]+/g, "_").slice(0, 40);
  return `${invNo}${customer ? "_" + customer : ""}.pdf`;
}

function downloadPdf() {
  const invoice = collectInvoice();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const left = 14;
  let y = 14;

  doc.setFontSize(18);
  doc.text("INVOICE", left, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`Invoice #: ${invoice.meta.invoiceNumber || ""}`, left, y); y += 6;
  doc.text(`Invoice Date: ${invoice.meta.invoiceDate || ""}`, left, y); y += 6;
  doc.text(`Due Date: ${invoice.meta.dueDate || ""}`, left, y); y += 8;

  doc.setFontSize(12);
  doc.text("From:", left, y); y += 6;
  doc.setFontSize(10);
  doc.text(`${invoice.from.name || ""}`, left, y); y += 5;
  if (invoice.from.email) { doc.text(`Email: ${invoice.from.email}`, left, y); y += 5; }
  if (invoice.from.phone) { doc.text(`Phone: ${invoice.from.phone}`, left, y); y += 5; }
  if (invoice.from.address) { doc.text(invoice.from.address, left, y); y += 10; } else { y += 6; }

  doc.setFontSize(12);
  doc.text("Bill To:", left, y); y += 6;
  doc.setFontSize(10);
  doc.text(`${invoice.to.name || ""}`, left, y); y += 5;
  if (invoice.to.email) { doc.text(`Email: ${invoice.to.email}`, left, y); y += 5; }
  if (invoice.to.phone) { doc.text(`Phone: ${invoice.to.phone}`, left, y); y += 5; }
  if (invoice.to.address) { doc.text(invoice.to.address, left, y); y += 8; } else { y += 6; }

  if (invoice.meta.projectName) {
    doc.setFontSize(11);
    doc.text(`Project: ${invoice.meta.projectName}`, left, y);
    y += 8;
  }

  const tableRows = invoice.items.map((it) => ([
    it.description || "",
    String(num(it.qty)),
    money(num(it.unitPrice)),
    money(num(it.qty) * num(it.unitPrice))
  ]));

  doc.autoTable({
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

  const afterTableY = doc.lastAutoTable.finalY + 8;

  const totals = invoice.totals;
  const lines = [
    ["Subtotal", money(totals.subtotal)],
    ["Tax", money(totals.tax)],
    ["Discount", money(totals.discount)],
    ["Deposit", money(totals.deposit)],
    ["Total Due", money(totals.total)]
  ];

  let ty = afterTableY;
  doc.setFontSize(11);
  lines.forEach(([k, v], idx) => {
    if (idx === lines.length - 1) doc.setFont(undefined, "bold");
    doc.text(k, left, ty);
    doc.text(v, 200 - left, ty, { align: "right" });
    doc.setFont(undefined, "normal");
    ty += 6;
  });

  ty += 4;
  if (invoice.paymentInstructions) {
    doc.setFontSize(11);
    doc.text("Payment Instructions:", left, ty); ty += 6;
    doc.setFontSize(10);
    doc.text(invoice.paymentInstructions, left, ty);
    ty += 10;
  }

  if (invoice.notes) {
    doc.setFontSize(11);
    doc.text("Notes:", left, ty); ty += 6;
    doc.setFontSize(10);
    doc.text(invoice.notes, left, ty);
  }

  doc.save(buildPdfFileName(invoice));
}

// ---------- Email Draft ----------
function emailDraft() {
  const invoice = collectInvoice();

  const to = encodeURIComponent(invoice.to.email || "");
  const subject = encodeURIComponent(`Invoice ${invoice.meta.invoiceNumber || ""} - ${invoice.from.name || ""}`.trim());

  const totals = invoice.totals;
  const bodyLines = [
    `Hi ${invoice.to.name || ""},`.trim(),
    ``,
    `Please find your invoice below:`,
    `Invoice #: ${invoice.meta.invoiceNumber || ""}`,
    `Invoice Date: ${invoice.meta.invoiceDate || ""}`,
    `Due Date: ${invoice.meta.dueDate || ""}`,
    invoice.meta.projectName ? `Project: ${invoice.meta.projectName}` : null,
    ``,
    `Total Due: ${money(totals.total)}`,
    ``,
    invoice.paymentInstructions ? `Payment Instructions:\n${invoice.paymentInstructions}` : null,
    ``,
    `I’ve attached the PDF invoice.`,
    ``,
    `Thank you,`,
    `${invoice.from.name || ""}`.trim(),
    invoice.from.phone ? invoice.from.phone : null
  ].filter(Boolean);

  const body = encodeURIComponent(bodyLines.join("\n"));
  const href = `mailto:${to}?subject=${subject}&body=${body}`;

  window.location.href = href;
}

// ---------- New invoice ----------
function newInvoice() {
  state.currentInvoiceId = null;

  fillInvoice({
    from: { name: "", email: "", phone: "", address: "" },
    to: { name: "", email: "", phone: "", address: "" },
    meta: { invoiceNumber: makeInvoiceNumber(), invoiceDate: todayISO(), dueDate: "", projectName: "" },
    items: [
      { description: "Labor", qty: 1, unitPrice: 0 }
    ],
    adjustments: { taxRatePct: 0, discount: 0, deposit: 0 },
    notes: "Thank you for your business.",
    paymentInstructions: ""
  });

  setStatus("Not saved");
}

// ---------- Wire up ----------
function addListeners() {
  el("btnAddItem").addEventListener("click", () => addItemRow());
  el("btnSave").addEventListener("click", saveInvoice);
  el("btnPdf").addEventListener("click", downloadPdf);
  el("btnEmail").addEventListener("click", emailDraft);
  el("btnNew").addEventListener("click", newInvoice);
  el("btnLoad").addEventListener("click", loadInvoice);
  el("btnDelete").addEventListener("click", deleteInvoice);

  ["taxRate", "discount", "deposit"].forEach((id) => {
    el(id).addEventListener("input", () => {
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved");
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
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved");
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.uid = null;
    setStatus("Sign in required");
    // Still allow local editing/PDF, just no saving
    newInvoice();
    return;
  }

  state.uid = user.uid;
  setStatus("Not saved");

  // Initialize defaults
  el("invoiceDate").value = el("invoiceDate").value || todayISO();
  if (!el("invoiceNumber").value) el("invoiceNumber").value = makeInvoiceNumber();

  await refreshSavedInvoices();
});

// Boot
addListeners();
newInvoice();
