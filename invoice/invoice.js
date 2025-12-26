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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { loadUserProfile, formatAddress } from "../profile-utils.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

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
  if (!pill) return;
  pill.textContent = text;
  pill.className = `invoice-pill ${kind}`.trim();
}

function setSendResult(text, kind = "") {
  const box = el("sendResult");
  if (!box) return;
  box.textContent = text || "";
  // Use invoice-pill class to match CSS modifiers (ok, warn, err)
  if (kind) {
    box.className = `invoice-pill ${kind}`.trim();
  } else {
    box.className = "invoice-muted";
  }
}

function setBusy(isBusy) {
  const ids = ["btnSave", "btnPdf", "btnSendEmail", "btnAddItem", "btnLoad", "btnDelete"];
  ids.forEach((id) => {
    const b = el(id);
    if (b) b.disabled = !!isBusy;
  });
}

// ---------- Items UI ----------
function addItemRow(item = { description: "", qty: 1, unitPrice: 0 }) {
  state.items.push({ ...item });
  renderItems();
  recalcTotals(); // Ensure totals are updated when adding a row
  setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
}

function removeItem(index) {
  state.items.splice(index, 1);
  renderItems();
  recalcTotals();
}

function renderItems() {
  const body = el("itemsBody");
  const cardsContainer = el("itemsCards");
  if (!body || !cardsContainer) return;
  
  body.innerHTML = "";
  cardsContainer.innerHTML = "";

  state.items.forEach((item, idx) => {
    // Create table row for desktop
    const tr = document.createElement("tr");
    tr.dataset.itemIndex = idx;

    const tdDesc = document.createElement("td");
    const desc = document.createElement("input");
    desc.value = item.description || "";
    desc.placeholder = "Labor / materials / service";
    desc.addEventListener("input", () => {
      state.items[idx].description = desc.value;
      updateItemCard(idx); // Update card view
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdDesc.appendChild(desc);

    const tdQty = document.createElement("td");
    tdQty.className = "invoice-num";
    const qty = document.createElement("input");
    qty.type = "number";
    qty.step = "1";
    qty.min = "0";
    qty.value = item.qty ?? 1;
    qty.addEventListener("input", () => {
      state.items[idx].qty = num(qty.value);
      updateItemCard(idx); // Update card view
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdQty.appendChild(qty);

    const tdUnit = document.createElement("td");
    tdUnit.className = "invoice-num";
    const unit = document.createElement("input");
    unit.type = "number";
    unit.step = "0.01";
    unit.min = "0";
    unit.value = item.unitPrice ?? 0;
    unit.addEventListener("input", () => {
      state.items[idx].unitPrice = num(unit.value);
      updateItemCard(idx); // Update card view
      setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      recalcTotals();
    });
    tdUnit.appendChild(unit);

    const tdLine = document.createElement("td");
    tdLine.className = "invoice-num";
    tdLine.dataset.lineTotal = idx;
    const lineTotal = (num(item.qty) * num(item.unitPrice));
    tdLine.textContent = money(lineTotal);

    const tdActions = document.createElement("td");
    tdActions.className = "invoice-num";
    const btn = document.createElement("button");
    btn.className = "invoice-btn danger";
    btn.style.padding = "8px 10px";
    btn.style.fontSize = "0.9rem";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => removeItem(idx));
    tdActions.appendChild(btn);

    tr.appendChild(tdDesc);
    tr.appendChild(tdQty);
    tr.appendChild(tdUnit);
    tr.appendChild(tdLine);
    tr.appendChild(tdActions);

    body.appendChild(tr);
    
    // Create card for mobile
    createItemCard(item, idx, cardsContainer);
  });

  if (state.items.length === 0) {
    // Empty state for table
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "invoice-muted";
    td.style.padding = "16px";
    td.style.textAlign = "center";
    td.textContent = "No items yet. Click \"Add Item\".";
    tr.appendChild(td);
    body.appendChild(tr);
    
    // Empty state for cards
    const emptyCard = document.createElement("div");
    emptyCard.className = "invoice-muted";
    emptyCard.style.padding = "24px";
    emptyCard.style.textAlign = "center";
    emptyCard.textContent = "No items yet. Click \"Add Item\".";
    cardsContainer.appendChild(emptyCard);
  }
}

function createItemCard(item, idx, container) {
  const card = document.createElement("div");
  card.className = "invoice-item-card";
  card.dataset.itemIndex = idx;

  const header = document.createElement("div");
  header.className = "invoice-item-card-header";

  const descContainer = document.createElement("div");
  descContainer.className = "invoice-item-card-desc";
  const desc = document.createElement("input");
  desc.value = item.description || "";
  desc.placeholder = "Labor / materials / service";
  desc.addEventListener("input", () => {
    state.items[idx].description = desc.value;
    updateItemTableRow(idx); // Update table view
    setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
    recalcTotals();
  });
  descContainer.appendChild(desc);

  const removeBtn = document.createElement("button");
  removeBtn.className = "invoice-btn danger invoice-item-card-remove";
  removeBtn.style.padding = "8px 12px";
  removeBtn.style.fontSize = "0.9rem";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => removeItem(idx));

  header.appendChild(descContainer);
  header.appendChild(removeBtn);

  const fields = document.createElement("div");
  fields.className = "invoice-item-card-fields";

  const qtyField = document.createElement("div");
  qtyField.className = "invoice-item-card-field";
  const qtyLabel = document.createElement("label");
  qtyLabel.className = "invoice-label";
  qtyLabel.textContent = "Quantity";
  const qty = document.createElement("input");
  qty.type = "number";
  qty.step = "1";
  qty.min = "0";
  qty.value = item.qty ?? 1;
  qty.addEventListener("input", () => {
    state.items[idx].qty = num(qty.value);
    updateItemTableRow(idx);
    updateItemCardTotal(idx);
    setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
    recalcTotals();
  });
  qtyField.appendChild(qtyLabel);
  qtyField.appendChild(qty);

  const unitField = document.createElement("div");
  unitField.className = "invoice-item-card-field";
  const unitLabel = document.createElement("label");
  unitLabel.className = "invoice-label";
  unitLabel.textContent = "Unit Price";
  const unit = document.createElement("input");
  unit.type = "number";
  unit.step = "0.01";
  unit.min = "0";
  unit.value = item.unitPrice ?? 0;
  unit.addEventListener("input", () => {
    state.items[idx].unitPrice = num(unit.value);
    updateItemTableRow(idx);
    updateItemCardTotal(idx);
    setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
    recalcTotals();
  });
  unitField.appendChild(unitLabel);
  unitField.appendChild(unit);

  fields.appendChild(qtyField);
  fields.appendChild(unitField);

  const totalRow = document.createElement("div");
  totalRow.className = "invoice-item-card-total";
  totalRow.dataset.cardTotal = idx;
  const totalLabel = document.createElement("span");
  totalLabel.className = "invoice-item-card-total-label";
  totalLabel.textContent = "Line Total:";
  const totalValue = document.createElement("span");
  totalValue.className = "invoice-item-card-total-value";
  const lineTotal = (num(item.qty) * num(item.unitPrice));
  totalValue.textContent = money(lineTotal);
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(totalValue);

  card.appendChild(header);
  card.appendChild(fields);
  card.appendChild(totalRow);

  container.appendChild(card);
}

function updateItemCard(idx) {
  const card = document.querySelector(`.invoice-item-card[data-item-index="${idx}"]`);
  if (card && state.items[idx]) {
    const item = state.items[idx];
    const descInput = card.querySelector('.invoice-item-card-desc input');
    const qtyInput = card.querySelector('.invoice-item-card-field:first-child input');
    const unitInput = card.querySelector('.invoice-item-card-field:last-child input');
    
    if (descInput) descInput.value = item.description || "";
    if (qtyInput) qtyInput.value = item.qty ?? 1;
    if (unitInput) unitInput.value = item.unitPrice ?? 0;
    
    updateItemCardTotal(idx);
  }
}

function updateItemCardTotal(idx) {
  const totalRow = document.querySelector(`.invoice-item-card[data-item-index="${idx}"] [data-card-total="${idx}"]`);
  if (totalRow && state.items[idx]) {
    const item = state.items[idx];
    const totalValue = totalRow.querySelector('.invoice-item-card-total-value');
    if (totalValue) {
      const lineTotal = (num(item.qty) * num(item.unitPrice));
      totalValue.textContent = money(lineTotal);
    }
  }
}

function updateItemTableRow(idx) {
  const tr = document.querySelector(`#itemsBody tr[data-item-index="${idx}"]`);
  if (tr && state.items[idx]) {
    const item = state.items[idx];
    const descInput = tr.querySelector('td:first-child input');
    const qtyInput = tr.querySelector('td:nth-child(2) input');
    const unitInput = tr.querySelector('td:nth-child(3) input');
    
    if (descInput) descInput.value = item.description || "";
    if (qtyInput) qtyInput.value = item.qty ?? 1;
    if (unitInput) unitInput.value = item.unitPrice ?? 0;
    
    const tdLine = tr.querySelector('td[data-line-total]');
    if (tdLine) {
      const lineTotal = (num(item.qty) * num(item.unitPrice));
      tdLine.textContent = money(lineTotal);
    }
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

  // Update per-line totals in table view
  [...document.querySelectorAll("#itemsBody tr[data-item-index]")].forEach((tr) => {
    const idx = parseInt(tr.dataset.itemIndex);
    if (state.items[idx]) {
      const tdLine = tr.querySelector('td[data-line-total]');
      if (tdLine) {
        const lineTotal = num(state.items[idx].qty) * num(state.items[idx].unitPrice);
        tdLine.textContent = money(lineTotal);
      }
    }
  });
  
  // Update per-line totals in card view
  [...document.querySelectorAll(".invoice-item-card[data-item-index]")].forEach((card) => {
    const idx = parseInt(card.dataset.itemIndex);
    if (state.items[idx]) {
      updateItemCardTotal(idx);
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

function buildersCol() {
  if (!state.uid) throw new Error("Not authenticated.");
  return collection(db, "users", state.uid, "builders");
}

async function loadBuilders() {
  if (!state.uid) return [];
  try {
    const q = query(buildersCol(), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading builders:", err);
    return [];
  }
}

async function loadJobs(builderId) {
  if (!state.uid || !builderId) return [];
  try {
    // Jobs are stored directly under builders: users/{uid}/builders/{builderId}/jobs
    const jobsCol = collection(db, "users", state.uid, "builders", builderId, "jobs");
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
  
  // Show loading state
  select.innerHTML = '<option value="">Loading builders...</option>';
  select.disabled = true;
  
  try {
    const builders = await loadBuilders();
    
    select.innerHTML = '<option value="">— Select a builder —</option>';
    select.disabled = false;
    
    // Only access jobSelect if it exists
    if (jobSelect) {
      jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
      jobSelect.style.display = "none";
    }
    
    if (builders.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— No builders found —";
      opt.disabled = true;
      select.appendChild(opt);
      
      const helpOpt = document.createElement("option");
      helpOpt.value = "";
      helpOpt.textContent = "Add builders on Contracts & Jobs page";
      helpOpt.disabled = true;
      select.appendChild(helpOpt);
    } else {
      builders.forEach(builder => {
        const opt = document.createElement("option");
        opt.value = builder.id;
        opt.textContent = builder.name || "Unnamed Builder";
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error refreshing builder select:", err);
    select.innerHTML = '<option value="">Error loading builders</option>';
    select.disabled = false;
  }
}

async function refreshJobSelect(builderId) {
  const jobSelect = el("selectJob");
  if (!jobSelect) return;
  
  if (!builderId) {
    jobSelect.style.display = "none";
    jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
    return;
  }
  
  // Show loading state
  jobSelect.style.display = "block";
  jobSelect.innerHTML = '<option value="">Loading jobs...</option>';
  jobSelect.disabled = true;
  
  try {
    const jobs = await loadJobs(builderId);
    jobSelect.innerHTML = '<option value="">— Select a job (optional) —</option>';
    jobSelect.disabled = false;
    
    if (jobs.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— No jobs found —";
      opt.disabled = true;
      jobSelect.appendChild(opt);
    } else {
      jobs.forEach(job => {
        const opt = document.createElement("option");
        opt.value = job.id;
        opt.textContent = job.jobName || "Unnamed Job";
        opt.dataset.address = job.jobAddress || "";
        opt.dataset.description = job.notes || "";
        jobSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error refreshing job select:", err);
    jobSelect.innerHTML = '<option value="">Error loading jobs</option>';
    jobSelect.disabled = false;
  }
}

async function fillCustomerFromBuilder(builderId, jobId = null) {
  if (!builderId) return;
  
  try {
    const builderRef = doc(db, "users", state.uid, "builders", builderId);
    const builderSnap = await getDoc(builderRef);
    
    if (!builderSnap.exists()) return;
    
    const builder = builderSnap.data();
    
    // Fill customer name with builder name
    el("toName").value = builder.name || "";
    
    // Fill customer email/phone/address if available
    if (builder.email && el("toEmail") && !el("toEmail").value) {
      el("toEmail").value = builder.email;
    }
    if (builder.phone && el("toPhone") && !el("toPhone").value) {
      el("toPhone").value = builder.phone;
    }
    if (builder.address && el("toAddress") && !el("toAddress").value) {
      el("toAddress").value = builder.address;
    }
    
    // If job is selected, fill project name and address
    if (jobId) {
      const jobRef = doc(db, "users", state.uid, "builders", builderId, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      
      if (jobSnap.exists()) {
        const job = jobSnap.data();
        if (el("projectName")) el("projectName").value = job.jobName || "";
        if (job.jobAddress && el("toAddress")) el("toAddress").value = job.jobAddress;
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

  // Auto-clear form after successful save (optional - user can still load saved invoice)
  // Uncomment the next line if you want auto-clear after save:
  // setTimeout(() => newInvoice(), 2000);

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
    headStyles: { fillColor: [77, 167, 99] }, // Brand green: #4DA763
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
      
      // Auto-clear form after successful send
      setTimeout(() => {
        newInvoice();
      }, 2000);
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

  // Clear builder/job selections
  const selectBuilder = el("selectBuilder");
  const selectJob = el("selectJob");
  if (selectBuilder) selectBuilder.value = "";
  if (selectJob) {
    selectJob.value = "";
    selectJob.style.display = "none";
  }

  setSendResult("");
  setStatus("Not saved", "");
}

// ---------- Wire up ----------
function addListeners() {
  // Use event delegation for Add Item button (more robust)
  // Attach to document or a stable container to handle dynamic content
  const addItemBtn = el("btnAddItem");
  if (!addItemBtn) {
    console.error("Add Item button not found: #btnAddItem");
    // Fallback: use event delegation on document
    document.addEventListener("click", (e) => {
      if (e.target && e.target.id === "btnAddItem") {
        e.preventDefault();
        e.stopPropagation();
        addItemRow();
      }
    });
  } else {
    addItemBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addItemRow();
    });
  }

  const btnSave = el("btnSave");
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      setSendResult("");
      await saveInvoice();
    });
  } else {
    console.error("Save button not found: #btnSave");
  }

  const btnPdf = el("btnPdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", downloadPdf);
  } else {
    console.error("PDF button not found: #btnPdf");
  }

  const btnSendEmail = el("btnSendEmail");
  if (btnSendEmail) {
    btnSendEmail.addEventListener("click", sendInvoiceEmail);
  } else {
    console.error("Send Email button not found: #btnSendEmail");
  }


  const btnLoad = el("btnLoad");
  if (btnLoad) {
    btnLoad.addEventListener("click", loadInvoice);
  } else {
    console.error("Load button not found: #btnLoad");
  }

  const btnDelete = el("btnDelete");
  if (btnDelete) {
    btnDelete.addEventListener("click", deleteInvoice);
  } else {
    console.error("Delete button not found: #btnDelete");
  }
  
  // Builder/Job selection handlers
  const selectBuilder = el("selectBuilder");
  if (selectBuilder) {
    selectBuilder.addEventListener("change", async (e) => {
      const builderId = e.target.value;
      await refreshJobSelect(builderId);
      await fillCustomerFromBuilder(builderId);
    });
  } else {
    console.error("Builder select not found: #selectBuilder");
  }
  
  const selectJob = el("selectJob");
  if (selectJob) {
    selectJob.addEventListener("change", async (e) => {
      const builderId = el("selectBuilder")?.value || "";
      const jobId = e.target.value;
      await fillCustomerFromBuilder(builderId, jobId);
      
      // Also fill project name and address from job
      if (jobId && e.target.selectedOptions[0]) {
        const opt = e.target.selectedOptions[0];
        const address = opt.dataset.address || "";
        
        const toAddress = el("toAddress");
        const projectName = el("projectName");
        if (address && toAddress) toAddress.value = address;
        if (opt.textContent && projectName) projectName.value = opt.textContent;
      }
    });
  } else {
    console.error("Job select not found: #selectJob");
  }

  ["taxRate", "discount", "deposit"].forEach((id) => {
    const elem = el(id);
    if (elem) {
      elem.addEventListener("input", () => {
        setSendResult("");
        setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
        recalcTotals();
      });
    } else {
      console.warn(`Element not found: #${id}`);
    }
  });

  [
    "fromName","fromEmail","fromPhone","fromAddress",
    "toName","toEmail","toPhone","toAddress",
    "invoiceNumber","invoiceDate","dueDate","projectName",
    "notes","paymentInstructions"
  ].forEach((id) => {
    const elem = el(id);
    if (elem) {
      elem.addEventListener("input", () => {
        setSendResult("");
        setStatus(state.currentInvoiceId ? "Edited (not saved)" : "Not saved", "warn");
      });
    } else {
      console.warn(`Element not found: #${id}`);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.uid = null;
    setStatus("Sign in required", "warn");
    newInvoice(); // still usable locally (PDF download), but no saving/sending
    
    // Add null checks for DOM elements
    const selectBuilder = el("selectBuilder");
    if (selectBuilder) {
      selectBuilder.innerHTML = '<option value="">— Select a builder —</option>';
    }
    
    const selectJob = el("selectJob");
    if (selectJob) {
      selectJob.innerHTML = '<option value="">— Select a job (optional) —</option>';
      selectJob.style.display = "none";
    }
    
    return;
  }

  state.uid = user.uid;
  setStatus("Not saved", "");

  // Add null checks for DOM elements
  const invoiceDate = el("invoiceDate");
  if (invoiceDate) {
    invoiceDate.value = invoiceDate.value || todayISO();
  }
  
  const invoiceNumber = el("invoiceNumber");
  if (invoiceNumber && !invoiceNumber.value) {
    invoiceNumber.value = makeInvoiceNumber();
  }

  // Autofill company info from user profile (only if fields are empty)
  await autofillCompanyInfo();

  await refreshSavedInvoices();
  await refreshBuilderSelect();
});

// Autofill company information from user profile
async function autofillCompanyInfo() {
  if (!state.uid) return;
  
  try {
    // Load standardized profile from users/{uid}
    const profile = await loadUserProfile(state.uid);
    
    // Also load legacy profile for backward compatibility (for name field)
    let legacyProfile = null;
    try {
      const legacyProfileRef = doc(db, "users", state.uid, "private", "profile");
      const legacyProfileSnap = await getDoc(legacyProfileRef);
      legacyProfile = legacyProfileSnap.exists() ? legacyProfileSnap.data() : null;
    } catch (legacyErr) {
      console.warn("Could not load legacy profile:", legacyErr);
    }
    
    // Get current user for email fallback
    const currentUser = auth.currentUser;
    
    // Only autofill if fields are currently empty
    const fromNameEl = el("fromName");
    const fromEmailEl = el("fromEmail");
    const fromPhoneEl = el("fromPhone");
    const fromAddressEl = el("fromAddress");
    
    // Business/Company Name: prefer companyName from standardized profile, fallback to name from legacy profile, then displayName
    if (fromNameEl && !fromNameEl.value) {
      const businessName = profile?.companyName || legacyProfile?.name || currentUser?.displayName || "";
      if (businessName) {
        fromNameEl.value = businessName;
      }
    }
    
    // Email: prefer profile email, fallback to auth.currentUser.email
    if (fromEmailEl && !fromEmailEl.value) {
      const email = profile?.email || legacyProfile?.email || currentUser?.email || "";
      if (email) {
        fromEmailEl.value = email;
      }
    }
    
    // Phone: from standardized profile
    if (fromPhoneEl && !fromPhoneEl.value && profile?.phoneNumber) {
      fromPhoneEl.value = profile.phoneNumber;
    }
    
    // Address: format from structured data
    if (fromAddressEl && !fromAddressEl.value && profile?.address) {
      const addressStr = formatAddress(profile.address);
      if (addressStr) {
        fromAddressEl.value = addressStr;
      }
    }
  } catch (err) {
    console.error("Error autofilling company info:", err);
    // Silently fail - don't break the invoice builder if profile load fails
  }
}

// Boot - Ensure DOM is ready before initializing
function initInvoice() {
  // Check if critical elements exist
  const btnAddItem = el("btnAddItem");
  const itemsBody = el("itemsBody");
  const itemsCards = el("itemsCards");
  
  if (!btnAddItem) {
    console.error("Critical element missing: #btnAddItem - Retrying in 100ms...");
    setTimeout(initInvoice, 100);
    return;
  }
  
  if (!itemsBody || !itemsCards) {
    console.error("Critical containers missing: #itemsBody or #itemsCards - Retrying in 100ms...");
    setTimeout(initInvoice, 100);
    return;
  }
  
  console.log("Invoice builder initialized successfully");
  addListeners();
  newInvoice();
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initInvoice);
} else {
  // DOM is already ready
  initInvoice();
}
