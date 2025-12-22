// contracts.js
// Contracts & Jobs Dashboard - Professional builder/contract/job management system

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
  where,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

// State
let currentUid = null;
let builders = [];
let contracts = [];
let jobs = [];
let selectedBuilderId = null;
let selectedContractId = null;
let filteredData = { builders: [], contracts: [], jobs: [] };
let searchTerm = "";
let filterStatus = "";
let filterBuilder = "";
let sortBy = "updated";

// ========== MIGRATION FROM OLD DATA STRUCTURE ==========

async function migrateOldContracts() {
  if (!currentUid) return;
  
  try {
    // Check if migration already done
    const migrationCheck = localStorage.getItem(`contracts_migrated_${currentUid}`);
    if (migrationCheck === "true") return;
    
    // Load old contracts structure: users/{uid}/contracts/{contractId}
    const oldContractsCol = collection(db, "users", currentUid, "contracts");
    const oldSnap = await getDocs(oldContractsCol);
    
    if (oldSnap.empty) {
      localStorage.setItem(`contracts_migrated_${currentUid}`, "true");
      return;
    }
    
    // Firestore batches are limited to 500 operations, so we need to split into multiple batches
    const MAX_BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let batchOperationCount = 0;
    let migrationCount = 0;
    
    // Helper function to commit current batch and start a new one
    async function commitBatchIfNeeded() {
      if (batchOperationCount > 0) {
        await batch.commit();
        batch = writeBatch(db);
        batchOperationCount = 0;
      }
    }
    
    for (const oldContractDoc of oldSnap.docs) {
      const oldContract = oldContractDoc.data();
      
      // Find or create builder
      let builderId = null;
      const builderName = oldContract.builderName || "Unknown Builder";
      
      // Check if builder already exists
      const existingBuilder = builders.find(b => 
        b.name?.toLowerCase() === builderName.toLowerCase()
      );
      
      if (existingBuilder) {
        builderId = existingBuilder.id;
      } else {
        // Check if we need to commit before adding builder
        if (batchOperationCount >= MAX_BATCH_SIZE - 1) {
          await commitBatchIfNeeded();
        }
        
        // Create new builder
        const builderRef = doc(collection(db, "users", currentUid, "builders"));
        builderId = builderRef.id;
        batch.set(builderRef, {
          name: builderName,
          email: null,
          phone: null,
          address: null,
          notes: null,
          createdAt: oldContract.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        batchOperationCount++;
      }
      
      // Check if we need to commit before adding contract
      if (batchOperationCount >= MAX_BATCH_SIZE - 1) {
        await commitBatchIfNeeded();
      }
      
      // Create contract under builder
      const contractRef = doc(collection(db, "users", currentUid, "builders", builderId, "contracts"));
      batch.set(contractRef, {
        title: builderName,
        contractNumber: null,
        startDate: null,
        endDate: null,
        status: oldContract.isActive !== false ? "active" : "closed",
        totalValue: 0,
        deposit: 0,
        retainagePct: 0,
        paymentTerms: null,
        scope: null,
        notes: null,
        createdAt: oldContract.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Preserve old document references
        _migratedFrom: oldContractDoc.id
      });
      batchOperationCount++;
      
      // Migrate jobs
      const oldJobsCol = collection(db, "users", currentUid, "contracts", oldContractDoc.id, "jobs");
      const oldJobsSnap = await getDocs(oldJobsCol);
      
      for (const oldJobDoc of oldJobsSnap.docs) {
        // Check if we need to commit before adding job
        if (batchOperationCount >= MAX_BATCH_SIZE - 1) {
          await commitBatchIfNeeded();
        }
        
        const oldJob = oldJobDoc.data();
        const jobRef = doc(collection(db, "users", currentUid, "builders", builderId, "contracts", contractRef.id, "jobs"));
        batch.set(jobRef, {
          jobName: oldJob.jobName || "Untitled Job",
          jobAddress: oldJob.address || null,
          status: oldJob.isPaid === true ? "paid" : (oldJob.isPaid === false ? "invoiced" : "in-progress"),
          startDate: null,
          dueDate: null,
          budget: 0,
          actualCost: 0,
          changeOrdersTotal: 0,
          progressPct: 0,
          priority: "normal",
          notes: oldJob.description || null,
          createdAt: oldJob.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          _migratedFrom: oldJobDoc.id
        });
        batchOperationCount++;
      }
      
      migrationCount++;
    }
    
    // Commit any remaining operations
    await commitBatchIfNeeded();
    
    if (migrationCount > 0) {
      console.log(`Migrated ${migrationCount} old contracts to new structure`);
    }
    
    localStorage.setItem(`contracts_migrated_${currentUid}`, "true");
  } catch (err) {
    console.error("Migration error:", err);
    // Don't block if migration fails
  }
}

// ========== DATA LOADING ==========

async function loadAllData() {
  if (!currentUid) return;
  
  try {
    // Load builders
    const buildersCol = collection(db, "users", currentUid, "builders");
    const buildersSnap = await getDocs(query(buildersCol, orderBy("name")));
    builders = buildersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Load contracts for each builder
    contracts = [];
    for (const builder of builders) {
      const contractsCol = collection(db, "users", currentUid, "builders", builder.id, "contracts");
      const contractsSnap = await getDocs(query(contractsCol, orderBy("updatedAt", "desc")));
      const builderContracts = contractsSnap.docs.map(d => ({
        id: d.id,
        builderId: builder.id,
        builderName: builder.name,
        ...d.data()
      }));
      contracts.push(...builderContracts);
    }
    
    // Load jobs for selected builder (all contracts under the builder)
    jobs = [];
    if (selectedBuilderId) {
      const builderContracts = contracts.filter(c => c.builderId === selectedBuilderId);
      for (const contract of builderContracts) {
        const jobsCol = collection(db, "users", currentUid, "builders", contract.builderId, "contracts", contract.id, "jobs");
        const jobsSnap = await getDocs(query(jobsCol, orderBy("dueDate", "asc")));
        const contractJobs = jobsSnap.docs.map(d => ({
          id: d.id,
          contractId: contract.id,
          contractTitle: contract.title,
          builderId: contract.builderId,
          ...d.data()
        }));
        jobs.push(...contractJobs);
      }
    } else if (selectedContractId) {
      // Fallback: if only contract is selected (for backward compatibility)
      const selectedContract = contracts.find(c => c.id === selectedContractId);
      if (selectedContract) {
        const jobsCol = collection(db, "users", currentUid, "builders", selectedContract.builderId, "contracts", selectedContractId, "jobs");
        const jobsSnap = await getDocs(query(jobsCol, orderBy("dueDate", "asc")));
        jobs = jobsSnap.docs.map(d => ({
          id: d.id,
          contractId: selectedContractId,
          contractTitle: selectedContract.title,
          builderId: selectedContract.builderId,
          ...d.data()
        }));
      }
    }
    
    updateSummaryCards();
    applyFiltersAndSearch();
    renderContractsList();
    renderJobsSection(); // Render the new standalone jobs section
    
    // Run migration after first load
    if (builders.length === 0 && contracts.length === 0) {
      await migrateOldContracts();
      await loadAllData(); // Reload after migration
    }
  } catch (err) {
    console.error("Error loading data:", err);
    showToast("Error loading data: " + getFriendlyError(err), true);
  }
}

// ========== SUMMARY CARDS ==========

function updateSummaryCards() {
  const activeContracts = contracts.filter(c => c.status === "active").length;
  const openJobs = jobs.filter(j => !["completed", "paid"].includes(j.status)).length;
  const overdueJobs = jobs.filter(j => {
    if (["completed", "paid"].includes(j.status)) return false;
    if (!j.dueDate) return false;
    const dueDate = j.dueDate?.toDate ? j.dueDate.toDate() : new Date(j.dueDate);
    const today = new Date();
    // Normalize both dates to midnight for accurate date-only comparison
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dueDateOnly < todayOnly;
  }).length;
  
  const totalValue = contracts.reduce((sum, c) => sum + (parseFloat(c.totalValue) || 0), 0);
  
  const activeEl = $("statActiveContracts");
  const openEl = $("statOpenJobs");
  const overdueEl = $("statOverdueJobs");
  const valueEl = $("statTotalValue");
  
  if (activeEl) activeEl.textContent = activeContracts;
  if (openEl) openEl.textContent = openJobs;
  if (overdueEl) overdueEl.textContent = overdueJobs;
  if (valueEl) valueEl.textContent = formatCurrency(totalValue);
}

// ========== SEARCH & FILTERS ==========

function applyFiltersAndSearch() {
  let filteredBuilders = [...builders];
  let filteredContracts = [...contracts];
  let filteredJobs = [...jobs];
  
  // Search filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredBuilders = filteredBuilders.filter(b => 
      b.name?.toLowerCase().includes(term)
    );
    filteredContracts = filteredContracts.filter(c =>
      c.title?.toLowerCase().includes(term) ||
      c.contractNumber?.toLowerCase().includes(term) ||
      c.builderName?.toLowerCase().includes(term)
    );
    filteredJobs = filteredJobs.filter(j =>
      j.jobName?.toLowerCase().includes(term) ||
      j.jobAddress?.toLowerCase().includes(term)
    );
  }
  
  // Status filter
  if (filterStatus) {
    filteredContracts = filteredContracts.filter(c => c.status === filterStatus);
  }
  
  // Builder filter
  if (filterBuilder) {
    filteredContracts = filteredContracts.filter(c => c.builderId === filterBuilder);
  }
  
  // Sort
  filteredContracts = sortContracts(filteredContracts);
  
  filteredData = {
    builders: filteredBuilders,
    contracts: filteredContracts,
    jobs: filteredJobs
  };
}

function sortContracts(contractsList) {
  const sorted = [...contractsList];
  
  switch (sortBy) {
    case "name":
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "dueDate":
      sorted.sort((a, b) => {
        const aDate = a.endDate?.toDate ? a.endDate.toDate() : (a.endDate ? new Date(a.endDate) : new Date(0));
        const bDate = b.endDate?.toDate ? b.endDate.toDate() : (b.endDate ? new Date(b.endDate) : new Date(0));
        return bDate - aDate;
      });
      break;
    case "value":
      sorted.sort((a, b) => (parseFloat(b.totalValue) || 0) - (parseFloat(a.totalValue) || 0));
      break;
    case "updated":
    default:
      sorted.sort((a, b) => {
        const aDate = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
        const bDate = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
        return bDate - aDate;
      });
      break;
  }
  
  return sorted;
}

// ========== RENDERING ==========

function renderContractsList() {
  const listEl = $("contractsList");
  if (!listEl) return;
  
  if (filteredData.builders.length === 0 && filteredData.contracts.length === 0) {
    listEl.innerHTML = `
      <div class="contracts-empty-state">
        <p>No builders or contracts found.</p>
        <button type="button" class="btn primary small" onclick="showBuilderModal()">Create Your First Builder</button>
      </div>
    `;
    return;
  }
  
  let html = "";
  
  // Group contracts by builder
  const contractsByBuilder = {};
  for (const contract of filteredData.contracts) {
    if (!contractsByBuilder[contract.builderId]) {
      contractsByBuilder[contract.builderId] = [];
    }
    contractsByBuilder[contract.builderId].push(contract);
  }
  
  // Render builders and their contracts
  for (const builder of filteredData.builders) {
    const builderContracts = contractsByBuilder[builder.id] || [];
    const isSelected = selectedBuilderId === builder.id;
    
    html += `
      <div class="contracts-list-item contracts-list-builder ${isSelected ? "contracts-list-item-selected" : ""}" 
           data-builder-id="${builder.id}">
        <div class="contracts-list-item-header" onclick="selectBuilder('${builder.id}')">
          <div class="contracts-list-item-title">
            <strong>${escapeHtml(builder.name)}</strong>
            <span class="contracts-list-item-count">${builderContracts.length} contract${builderContracts.length !== 1 ? "s" : ""}</span>
          </div>
          <button type="button" class="contracts-list-item-action" onclick="event.stopPropagation(); showBuilderModal('${builder.id}')">
            <span>✎</span>
          </button>
        </div>
        <div class="contracts-list-contracts">
          ${builderContracts.map(contract => {
            const isContractSelected = selectedContractId === contract.id;
            return `
              <div class="contracts-list-item contracts-list-contract ${isContractSelected ? "contracts-list-item-selected" : ""}"
                   data-contract-id="${contract.id}" onclick="selectContract('${contract.id}')">
                <div class="contracts-list-item-title">
                  ${escapeHtml(contract.title || "Untitled Contract")}
                  <span class="contracts-status-badge contracts-status-badge-${contract.status || "draft"}">${formatStatus(contract.status || "draft")}</span>
                </div>
              </div>
            `;
          }).join("")}
          <button type="button" class="contracts-list-add-contract" onclick="showContractModal(null, '${builder.id}')">
            + Add Contract
          </button>
        </div>
      </div>
    `;
  }
  
  // Show contracts without builders (orphaned)
  const contractsWithoutBuilder = filteredData.contracts.filter(c => !c.builderId);
  if (contractsWithoutBuilder.length > 0) {
    html += `
      <div class="contracts-list-item contracts-list-builder">
        <div class="contracts-list-item-header">
          <div class="contracts-list-item-title">
            <strong>Other Contracts</strong>
          </div>
        </div>
        <div class="contracts-list-contracts">
          ${contractsWithoutBuilder.map(contract => {
            const isContractSelected = selectedContractId === contract.id;
            return `
              <div class="contracts-list-item contracts-list-contract ${isContractSelected ? "contracts-list-item-selected" : ""}"
                   data-contract-id="${contract.id}" onclick="selectContract('${contract.id}')">
                <div class="contracts-list-item-title">
                  ${escapeHtml(contract.title || "Untitled Contract")}
                  <span class="contracts-status-badge contracts-status-badge-${contract.status || "draft"}">${formatStatus(contract.status || "draft")}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
  
  listEl.innerHTML = html;
}

function renderContractDetail() {
  const detailView = $("contractDetailView");
  const emptyView = $("contractEmptyState");
  const detailPanelWrapper = $("contractsDetailPanelWrapper");
  
  if (!selectedContractId) {
    if (detailView) detailView.style.display = "none";
    if (emptyView) emptyView.style.display = "block";
    // Show the wrapper so the empty state message is visible
    if (detailPanelWrapper) detailPanelWrapper.style.display = "block";
    return;
  }
  
  const contract = contracts.find(c => c.id === selectedContractId);
  if (!contract) return;
  
  if (detailView) detailView.style.display = "block";
  if (emptyView) emptyView.style.display = "none";
  if (detailPanelWrapper) detailPanelWrapper.style.display = "block";
  
  // Update header
  const titleEl = $("detailContractTitle");
  const statusEl = $("detailContractStatus");
  const builderEl = $("detailContractBuilder");
  
  if (titleEl) titleEl.textContent = contract.title || "Untitled Contract";
  if (statusEl) {
    statusEl.textContent = formatStatus(contract.status || "draft");
    statusEl.className = `contracts-status-badge contracts-status-badge-${contract.status || "draft"}`;
  }
  if (builderEl) builderEl.textContent = contract.builderName || "—";
  
  // Update overview tab
  updateDetailField("detailContractNumber", contract.contractNumber || "—");
  updateDetailField("detailStartDate", formatDate(contract.startDate));
  updateDetailField("detailEndDate", formatDate(contract.endDate));
  updateDetailField("detailPaymentTerms", contract.paymentTerms || "—");
  updateDetailField("detailTotalValue", formatCurrency(contract.totalValue || 0));
  updateDetailField("detailDeposit", formatCurrency(contract.deposit || 0));
  updateDetailField("detailRetainage", contract.retainagePct ? `${contract.retainagePct}%` : "0%");
  
  const totalValue = parseFloat(contract.totalValue) || 0;
  const deposit = parseFloat(contract.deposit) || 0;
  const retainage = (totalValue * (parseFloat(contract.retainagePct) || 0) / 100);
  const remaining = totalValue - deposit - retainage;
  updateDetailField("detailRemaining", formatCurrency(Math.max(0, remaining)));
  
  updateDetailField("detailScope", contract.scope || "—");
  updateDetailField("detailNotes", contract.notes || "—");
  
  // Jobs are now displayed in the standalone jobs section, not here
  // renderJobsTable(); // Removed - jobs are now in standalone section
}

function renderJobsTable() {
  const tbody = $("jobsTableBody");
  if (!tbody) return;
  
  if (jobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="contracts-empty-state">No jobs yet. Click "New Job" to add one.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = jobs.map(job => {
    const startDate = formatDate(job.startDate);
    const dueDateFormatted = formatDate(job.dueDate);
    // Check if job is overdue (normalize dates to compare date-only, not time)
    let isOverdue = false;
    if (job.dueDate && !["completed", "paid"].includes(job.status)) {
      const dueDateObj = job.dueDate.toDate ? job.dueDate.toDate() : new Date(job.dueDate);
      const today = new Date();
      const dueDateOnly = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      isOverdue = dueDateOnly < todayOnly;
    }
    
    return `
      <tr class="${isOverdue ? "contracts-job-overdue" : ""}">
        <td><strong>${escapeHtml(job.jobName || "—")}</strong></td>
        <td>${escapeHtml(job.jobAddress || "—")}</td>
        <td>
          <span class="contracts-status-badge contracts-status-badge-${job.status || "not-started"}">
            ${formatStatus(job.status || "not-started")}
          </span>
        </td>
        <td>${startDate}</td>
        <td class="${isOverdue ? "contracts-overdue-text" : ""}">${dueDateFormatted}</td>
        <td>
          <div class="contracts-progress-bar">
            <div class="contracts-progress-fill" style="width: ${job.progressPct || 0}%"></div>
            <span class="contracts-progress-text">${job.progressPct || 0}%</span>
          </div>
        </td>
        <td>${formatCurrency(job.budget || 0)}</td>
        <td>
          <div class="contracts-actions">
            <button type="button" class="btn small" onclick="showJobModal('${selectedContractId}', '${job.id}')">Edit</button>
            <button type="button" class="btn small ghost" onclick="deleteJobConfirm('${selectedContractId}', '${job.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderJobsSection() {
  const tbody = $("jobsSectionTableBody");
  const titleEl = $("jobsSectionTitle");
  const newJobBtn = $("newJobBtnStandalone");
  const emptyEl = $("jobsSectionEmpty");
  
  if (!tbody) return;
  
  // Filter jobs by selected builder
  const builderJobs = selectedBuilderId 
    ? jobs.filter(j => j.builderId === selectedBuilderId)
    : [];
  
  // Update title
  if (titleEl) {
    const selectedBuilder = builders.find(b => b.id === selectedBuilderId);
    if (selectedBuilder) {
      titleEl.textContent = `Jobs for ${escapeHtml(selectedBuilder.name)}`;
    } else {
      titleEl.textContent = "Jobs";
    }
  }
  
  // Show/hide new job button
  if (newJobBtn) {
    newJobBtn.style.display = selectedBuilderId ? "inline-flex" : "none";
  }
  
  // Render jobs or empty state
  if (!selectedBuilderId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="contracts-empty-state">Select a builder to view jobs.</td>
      </tr>
    `;
    return;
  }
  
  if (builderJobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="contracts-empty-state">No jobs found for this builder.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = builderJobs.map(job => {
    const startDate = formatDate(job.startDate);
    const dueDateFormatted = formatDate(job.dueDate);
    // Check if job is overdue (normalize dates to compare date-only, not time)
    let isOverdue = false;
    if (job.dueDate && !["completed", "paid"].includes(job.status)) {
      const dueDateObj = job.dueDate.toDate ? job.dueDate.toDate() : new Date(job.dueDate);
      const today = new Date();
      const dueDateOnly = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      isOverdue = dueDateOnly < todayOnly;
    }
    
    return `
      <tr class="${isOverdue ? "contracts-job-overdue" : ""}">
        <td><strong>${escapeHtml(job.jobName || "—")}</strong></td>
        <td>${escapeHtml(job.contractTitle || "—")}</td>
        <td>${escapeHtml(job.jobAddress || "—")}</td>
        <td>
          <span class="contracts-status-badge contracts-status-badge-${job.status || "not-started"}">
            ${formatStatus(job.status || "not-started")}
          </span>
        </td>
        <td>${startDate}</td>
        <td class="${isOverdue ? "contracts-overdue-text" : ""}">${dueDateFormatted}</td>
        <td>
          <div class="contracts-progress-bar">
            <div class="contracts-progress-fill" style="width: ${job.progressPct || 0}%"></div>
            <span class="contracts-progress-text">${job.progressPct || 0}%</span>
          </div>
        </td>
        <td>${formatCurrency(job.budget || 0)}</td>
        <td>
          <div class="contracts-actions">
            <button type="button" class="btn small" onclick="showJobModal('${job.contractId}', '${job.id}')">Edit</button>
            <button type="button" class="btn small ghost" onclick="deleteJobConfirm('${job.contractId}', '${job.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ========== SELECTION ==========

async function selectBuilder(builderId) {
  selectedBuilderId = builderId;
  selectedContractId = null;
  jobs = [];
  await loadAllData(); // Load data first (this will also call renderJobsSection)
  renderContractsList(); // Then render with fresh data
  renderContractDetail(); // Update detail view
  renderJobsSection(); // Ensure jobs section is rendered
}

async function selectContract(contractId) {
  selectedContractId = contractId;
  const contract = contracts.find(c => c.id === contractId);
  if (contract) {
    selectedBuilderId = contract.builderId;
  }
  await loadAllData(); // Load data first (this will also call renderJobsSection)
  renderContractsList(); // Then render with fresh data
  renderContractDetail(); // Update detail view with loaded jobs
  renderJobsSection(); // Ensure jobs section is rendered
}

// ========== CRUD: BUILDERS ==========

async function saveBuilder(e) {
  if (e) e.preventDefault();
  
  if (!currentUid) {
    showToast("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveBuilderBtn");
  if (!btn) {
    console.error("Save builder button not found");
    return;
  }
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearBuilderMessages();
    showBuilderMsg("Saving builder...");
    
    const builderId = $("builderId")?.value || null;
    const name = $("builderName")?.value.trim();
    const email = $("builderEmail")?.value.trim() || null;
    const phone = $("builderPhone")?.value.trim() || null;
    const address = $("builderAddress")?.value.trim() || null;
    const notes = $("builderNotes")?.value.trim() || null;
    
    if (!name) {
      showBuilderError("Builder name is required.");
      // Button will be re-enabled in finally block
      return;
    }
    
    const builderData = {
      name,
      email,
      phone,
      address,
      notes,
      updatedAt: serverTimestamp()
    };
    
    if (!builderId) {
      builderData.createdAt = serverTimestamp();
      const buildersCol = collection(db, "users", currentUid, "builders");
      const newRef = await addDoc(buildersCol, builderData);
      showBuilderMsg("Builder created successfully!", false);
      await loadAllData();
      // Auto-select the newly created builder
      selectedBuilderId = newRef.id;
      renderContractsList();
      renderJobsSection();
      setTimeout(() => hideBuilderModal(), 1000);
    } else {
      const builderRef = doc(db, "users", currentUid, "builders", builderId);
      await updateDoc(builderRef, builderData);
      showBuilderMsg("Builder updated successfully!", false);
      await loadAllData();
      setTimeout(() => hideBuilderModal(), 1000);
    }
  } catch (err) {
    console.error("Error saving builder:", err);
    showBuilderError(getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

async function deleteBuilder(builderId) {
  if (!confirm("Delete this builder? All contracts and jobs under this builder will also be deleted. This cannot be undone.")) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    // Delete all contracts and jobs under this builder
    const contractsCol = collection(db, "users", currentUid, "builders", builderId, "contracts");
    const contractsSnap = await getDocs(contractsCol);
    
    for (const contractDoc of contractsSnap.docs) {
      const jobsCol = collection(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id, "jobs");
      const jobsSnap = await getDocs(jobsCol);
      for (const jobDoc of jobsSnap.docs) {
        await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id, "jobs", jobDoc.id));
      }
      await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id));
    }
    
    // Delete builder
    await deleteDoc(doc(db, "users", currentUid, "builders", builderId));
    
    selectedBuilderId = null;
    selectedContractId = null;
    await loadAllData();
    showToast("Builder deleted successfully.");
  } catch (err) {
    console.error("Error deleting builder:", err);
    showToast("Error deleting builder: " + getFriendlyError(err), true);
  }
}

// ========== CRUD: CONTRACTS ==========

async function saveContract(e) {
  if (e) e.preventDefault();
  
  if (!currentUid) {
    showToast("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveContractBtn");
  if (!btn) return;
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearContractMessages();
    showContractMsg("Saving contract...");
    
    const contractId = $("contractId")?.value || null;
    const builderId = $("contractBuilderId")?.value || null;
    const title = $("contractTitle")?.value.trim();
    const contractNumber = $("contractNumber")?.value.trim() || null;
    const status = $("contractStatus")?.value || "draft";
    const startDate = $("contractStartDate")?.value || null;
    const endDate = $("contractEndDate")?.value || null;
    const totalValue = parseFloat($("contractTotalValue")?.value || 0) || 0;
    const deposit = parseFloat($("contractDeposit")?.value || 0) || 0;
    const retainagePct = parseFloat($("contractRetainagePct")?.value || 0) || 0;
    const paymentTerms = $("contractPaymentTerms")?.value.trim() || null;
    const scope = $("contractScope")?.value.trim() || null;
    const notes = $("contractNotes")?.value.trim() || null;
    
    if (!title) {
      showContractError("Contract title is required.");
      return;
    }
    
    if (!builderId) {
      showContractError("Builder is required.");
      return;
    }
    
    const contractData = {
      title,
      contractNumber,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status,
      totalValue,
      deposit,
      retainagePct,
      paymentTerms,
      scope,
      notes,
      updatedAt: serverTimestamp()
    };
    
    if (!contractId) {
      contractData.createdAt = serverTimestamp();
      const contractsCol = collection(db, "users", currentUid, "builders", builderId, "contracts");
      const newRef = await addDoc(contractsCol, contractData);
      showContractMsg("Contract created successfully!", false);
      await loadAllData();
      selectContract(newRef.id);
      setTimeout(() => hideContractModal(), 1000);
    } else {
      const contractRef = doc(db, "users", currentUid, "builders", builderId, "contracts", contractId);
      await updateDoc(contractRef, contractData);
      showContractMsg("Contract updated successfully!", false);
      await loadAllData();
      selectContract(contractId);
      setTimeout(() => hideContractModal(), 1000);
    }
  } catch (err) {
    console.error("Error saving contract:", err);
    showContractError(getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

async function duplicateContract(contractId) {
  const contract = contracts.find(c => c.id === contractId);
  if (!contract) return;
  
  if (!confirm(`Duplicate contract "${contract.title}"?`)) return;
  
  try {
    const contractData = {
      ...contract,
      title: `${contract.title} (Copy)`,
      status: "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    delete contractData.id;
    delete contractData.builderName;
    
    const contractsCol = collection(db, "users", currentUid, "builders", contract.builderId, "contracts");
    const newRef = await addDoc(contractsCol, contractData);
    
    await loadAllData();
    selectContract(newRef.id);
    showToast("Contract duplicated successfully.");
  } catch (err) {
    console.error("Error duplicating contract:", err);
    showToast("Error duplicating contract: " + getFriendlyError(err), true);
  }
}

async function deleteContractConfirm(contractId) {
  const contract = contracts.find(c => c.id === contractId);
  if (!contract) return;
  
  if (!confirm(`Delete contract "${contract.title}"? All jobs under this contract will also be deleted. This cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    // Delete all jobs
    const jobsCol = collection(db, "users", currentUid, "builders", contract.builderId, "contracts", contractId, "jobs");
    const jobsSnap = await getDocs(jobsCol);
    for (const jobDoc of jobsSnap.docs) {
      await deleteDoc(doc(db, "users", currentUid, "builders", contract.builderId, "contracts", contractId, "jobs", jobDoc.id));
    }
    
    // Delete contract
    await deleteDoc(doc(db, "users", currentUid, "builders", contract.builderId, "contracts", contractId));
    
    selectedContractId = null;
    await loadAllData();
    showToast("Contract deleted successfully.");
  } catch (err) {
    console.error("Error deleting contract:", err);
    showToast("Error deleting contract: " + getFriendlyError(err), true);
  }
}

// ========== CRUD: JOBS ==========

async function saveJob(e) {
  if (e) e.preventDefault();
  
  if (!currentUid) {
    showToast("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveJobBtn");
  if (!btn) return;
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearJobMessages();
    showJobMsg("Saving job...");
    
    const jobId = $("jobId")?.value || null;
    const contractId = $("jobContractId")?.value;
    const builderId = $("jobBuilderId")?.value;
    const jobName = $("jobName")?.value.trim();
    const jobAddress = $("jobAddress")?.value.trim() || null;
    const status = $("jobStatus")?.value || "not-started";
    const startDate = $("jobStartDate")?.value || null;
    const dueDate = $("jobDueDate")?.value || null;
    const budget = parseFloat($("jobBudget")?.value || 0) || 0;
    const progressPct = parseInt($("jobProgressPct")?.value || 0) || 0;
    const priority = $("jobPriority")?.value || "normal";
    const notes = $("jobNotes")?.value.trim() || null;
    
    if (!jobName) {
      showJobError("Job name is required.");
      return;
    }
    
    if (!contractId || !builderId) {
      showJobError("Contract is required.");
      return;
    }
    
    const jobData = {
      jobName,
      jobAddress,
      status,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      budget,
      actualCost: 0,
      changeOrdersTotal: 0,
      progressPct: Math.max(0, Math.min(100, progressPct)),
      priority,
      notes,
      updatedAt: serverTimestamp()
    };
    
    if (!jobId) {
      jobData.createdAt = serverTimestamp();
      const jobsCol = collection(db, "users", currentUid, "builders", builderId, "contracts", contractId, "jobs");
      const newRef = await addDoc(jobsCol, jobData);
      showJobMsg("Job created successfully!", false);
      await loadAllData();
      setTimeout(() => hideJobModal(), 1000);
    } else {
      const jobRef = doc(db, "users", currentUid, "builders", builderId, "contracts", contractId, "jobs", jobId);
      await updateDoc(jobRef, jobData);
      showJobMsg("Job updated successfully!", false);
      await loadAllData();
      setTimeout(() => hideJobModal(), 1000);
    }
  } catch (err) {
    console.error("Error saving job:", err);
    showJobError(getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

async function deleteJobConfirm(contractId, jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  
  if (!confirm(`Delete job "${job.jobName}"? This cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;
    
    const jobRef = doc(db, "users", currentUid, "builders", contract.builderId, "contracts", contractId, "jobs", jobId);
    await deleteDoc(jobRef);
    
    await loadAllData();
    showToast("Job deleted successfully.");
  } catch (err) {
    console.error("Error deleting job:", err);
    showToast("Error deleting job: " + getFriendlyError(err), true);
  }
}

// ========== MODAL FUNCTIONS ==========

function showBuilderModal(builderId = null) {
  const modal = $("builderModal");
  const title = $("builderModalTitle");
  if (!modal) {
    console.error("Builder modal not found");
    return;
  }
  
  modal.style.display = "flex";
  if (title) title.textContent = builderId ? "Edit Builder" : "New Builder";
  
  const form = $("builderForm");
  if (form) form.reset();
  
  const idInput = $("builderId");
  if (idInput) idInput.value = builderId || "";
  
  // Re-enable save button in case it was disabled
  const saveBtn = $("saveBuilderBtn");
  if (saveBtn) saveBtn.disabled = false;
  
  if (builderId) {
    const builder = builders.find(b => b.id === builderId);
    if (builder) {
      if ($("builderName")) $("builderName").value = builder.name || "";
      if ($("builderEmail")) $("builderEmail").value = builder.email || "";
      if ($("builderPhone")) $("builderPhone").value = builder.phone || "";
      if ($("builderAddress")) $("builderAddress").value = builder.address || "";
      if ($("builderNotes")) $("builderNotes").value = builder.notes || "";
    }
  }
  
  clearBuilderMessages();
  document.body.style.overflow = "hidden";
}

function hideBuilderModal() {
  const modal = $("builderModal");
  if (modal) modal.style.display = "none";
  clearBuilderMessages();
  document.body.style.overflow = "";
}

function showContractModal(contractId = null, builderId = null) {
  const modal = $("contractModal");
  const title = $("contractModalTitle");
  if (!modal) return;
  
  modal.style.display = "flex";
  if (title) title.textContent = contractId ? "Edit Contract" : "New Contract";
  
  const form = $("contractForm");
  if (form) form.reset();
  
  const idInput = $("contractId");
  const builderInput = $("contractBuilderId");
  if (idInput) idInput.value = contractId || "";
  if (builderInput) builderInput.value = builderId || selectedBuilderId || "";
  
  if (contractId) {
    const contract = contracts.find(c => c.id === contractId);
    if (contract) {
      if ($("contractTitle")) $("contractTitle").value = contract.title || "";
      if ($("contractNumber")) $("contractNumber").value = contract.contractNumber || "";
      if ($("contractStatus")) $("contractStatus").value = contract.status || "draft";
      if ($("contractStartDate")) $("contractStartDate").value = formatDateInput(contract.startDate);
      if ($("contractEndDate")) $("contractEndDate").value = formatDateInput(contract.endDate);
      if ($("contractTotalValue")) $("contractTotalValue").value = contract.totalValue || "";
      if ($("contractDeposit")) $("contractDeposit").value = contract.deposit || "";
      if ($("contractRetainagePct")) $("contractRetainagePct").value = contract.retainagePct || "";
      if ($("contractPaymentTerms")) $("contractPaymentTerms").value = contract.paymentTerms || "";
      if ($("contractScope")) $("contractScope").value = contract.scope || "";
      if ($("contractNotes")) $("contractNotes").value = contract.notes || "";
      if (builderInput) builderInput.value = contract.builderId || "";
    }
  }
  
  clearContractMessages();
  document.body.style.overflow = "hidden";
}

function hideContractModal() {
  const modal = $("contractModal");
  if (modal) modal.style.display = "none";
  clearContractMessages();
  document.body.style.overflow = "";
}

function showJobModal(contractId = null, jobId = null) {
  const modal = $("jobModal");
  const title = $("jobModalTitle");
  if (!modal) return;
  
  if (!contractId) contractId = selectedContractId;
  if (!contractId) {
    showToast("Please select a contract first.", true);
    return;
  }
  
  const contract = contracts.find(c => c.id === contractId);
  if (!contract) return;
  
  modal.style.display = "flex";
  if (title) title.textContent = jobId ? "Edit Job" : "New Job";
  
  const form = $("jobForm");
  if (form) form.reset();
  
  const idInput = $("jobId");
  const contractInput = $("jobContractId");
  const builderInput = $("jobBuilderId");
  if (idInput) idInput.value = jobId || "";
  if (contractInput) contractInput.value = contractId;
  if (builderInput) builderInput.value = contract.builderId;
  
  if (jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      if ($("jobName")) $("jobName").value = job.jobName || "";
      if ($("jobAddress")) $("jobAddress").value = job.jobAddress || "";
      if ($("jobStatus")) $("jobStatus").value = job.status || "not-started";
      if ($("jobStartDate")) $("jobStartDate").value = formatDateInput(job.startDate);
      if ($("jobDueDate")) $("jobDueDate").value = formatDateInput(job.dueDate);
      if ($("jobBudget")) $("jobBudget").value = job.budget || "";
      if ($("jobProgressPct")) $("jobProgressPct").value = job.progressPct || "";
      if ($("jobPriority")) $("jobPriority").value = job.priority || "normal";
      if ($("jobNotes")) $("jobNotes").value = job.notes || "";
    }
  }
  
  clearJobMessages();
  document.body.style.overflow = "hidden";
}

function hideJobModal() {
  const modal = $("jobModal");
  if (modal) modal.style.display = "none";
  clearJobMessages();
  document.body.style.overflow = "";
}

// ========== TAB SWITCHING ==========

function switchTab(tabName) {
  $$(".contracts-tab").forEach(tab => {
    tab.classList.remove("contracts-tab-active");
    if (tab.dataset.tab === tabName) {
      tab.classList.add("contracts-tab-active");
    }
  });
  
  $$(".contracts-tab-content").forEach(content => {
    content.classList.remove("contracts-tab-content-active");
    if (content.id === `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`) {
      content.classList.add("contracts-tab-content-active");
    }
  });
}

// ========== HELPER FUNCTIONS ==========

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(amount || 0);
}

function formatDate(date) {
  if (!date) return "—";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function formatDateInput(date) {
  if (!date) return "";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function formatStatus(status) {
  const statusMap = {
    "draft": "Draft",
    "active": "Active",
    "on-hold": "On Hold",
    "closed": "Closed",
    "not-started": "Not Started",
    "in-progress": "In Progress",
    "waiting": "Waiting",
    "completed": "Completed",
    "invoiced": "Invoiced",
    "paid": "Paid"
  };
  return statusMap[status] || status;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateDetailField(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function getFriendlyError(err) {
  if (err?.message) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred. Please try again.";
}

// ========== MESSAGE FUNCTIONS ==========

function showBuilderMsg(msg, isError = false) {
  const msgEl = $("builderFormMsg");
  const errEl = $("builderFormError");
  if (!msgEl || !errEl) return;
  if (isError) {
    msgEl.textContent = "";
    errEl.textContent = msg;
  } else {
    errEl.textContent = "";
    msgEl.textContent = msg;
  }
}

function showBuilderError(msg) {
  showBuilderMsg(msg, true);
}

function clearBuilderMessages() {
  const msgEl = $("builderFormMsg");
  const errEl = $("builderFormError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

function showContractMsg(msg, isError = false) {
  const msgEl = $("contractFormMsg");
  const errEl = $("contractFormError");
  if (!msgEl || !errEl) return;
  if (isError) {
    msgEl.textContent = "";
    errEl.textContent = msg;
  } else {
    errEl.textContent = "";
    msgEl.textContent = msg;
  }
}

function showContractError(msg) {
  showContractMsg(msg, true);
}

function clearContractMessages() {
  const msgEl = $("contractFormMsg");
  const errEl = $("contractFormError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

function showJobMsg(msg, isError = false) {
  const msgEl = $("jobFormMsg");
  const errEl = $("jobFormError");
  if (!msgEl || !errEl) return;
  if (isError) {
    msgEl.textContent = "";
    errEl.textContent = msg;
  } else {
    errEl.textContent = "";
    msgEl.textContent = msg;
  }
}

function showJobError(msg) {
  showJobMsg(msg, true);
}

function clearJobMessages() {
  const msgEl = $("jobFormMsg");
  const errEl = $("jobFormError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

function showToast(message, isError = false) {
  // Simple toast notification
  const toast = document.createElement("div");
  toast.className = `contracts-toast ${isError ? "contracts-toast-error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("contracts-toast-show");
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove("contracts-toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== INITIALIZATION ==========

function init() {
  // Event listeners
  const newBuilderBtn = $("newBuilderBtn");
  const newContractBtn = $("newContractBtn");
  const newJobBtn = $("newJobBtn");
  const newJobBtnStandalone = $("newJobBtnStandalone");
  const editContractBtn = $("editContractBtn");
  const duplicateContractBtn = $("duplicateContractBtn");
  const deleteContractBtn = $("deleteContractBtn");
  
  if (newBuilderBtn) {
    newBuilderBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("New Builder button clicked");
      showBuilderModal();
    });
  } else {
    console.error("New Builder button not found in DOM");
  }
  if (newContractBtn) newContractBtn.addEventListener("click", () => showContractModal());
  if (newJobBtn) newJobBtn.addEventListener("click", () => showJobModal());
  if (newJobBtnStandalone) {
    newJobBtnStandalone.addEventListener("click", () => {
      // If a builder is selected but no contract, prompt to select a contract first
      if (selectedBuilderId && !selectedContractId) {
        const builderContracts = contracts.filter(c => c.builderId === selectedBuilderId);
        if (builderContracts.length === 0) {
          showToast("Please create a contract first before adding jobs.", true);
          return;
        }
        // Auto-select first contract for convenience
        if (builderContracts.length === 1) {
          selectContract(builderContracts[0].id).then(() => {
            showJobModal(builderContracts[0].id);
          });
        } else {
          showToast("Please select a contract first to add a job.", true);
        }
      } else if (selectedContractId) {
        showJobModal(selectedContractId);
      } else {
        showToast("Please select a builder first.", true);
      }
    });
  }
  if (editContractBtn) editContractBtn.addEventListener("click", () => {
    if (selectedContractId) showContractModal(selectedContractId);
  });
  if (duplicateContractBtn) duplicateContractBtn.addEventListener("click", () => {
    if (selectedContractId) duplicateContract(selectedContractId);
  });
  if (deleteContractBtn) deleteContractBtn.addEventListener("click", () => {
    if (selectedContractId) deleteContractConfirm(selectedContractId);
  });
  
  // Forms
  const builderForm = $("builderForm");
  const contractForm = $("contractForm");
  const jobForm = $("jobForm");
  
  if (builderForm) builderForm.addEventListener("submit", saveBuilder);
  if (contractForm) contractForm.addEventListener("submit", saveContract);
  if (jobForm) jobForm.addEventListener("submit", saveJob);
  
  // Search and filters
  const searchInput = $("contractsSearch");
  const filterStatusSelect = $("filterStatus");
  const filterBuilderSelect = $("filterBuilder");
  const sortSelect = $("sortBy");
  
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      applyFiltersAndSearch();
      renderContractsList();
    });
  }
  
  if (filterStatusSelect) {
    filterStatusSelect.addEventListener("change", (e) => {
      filterStatus = e.target.value;
      applyFiltersAndSearch();
      renderContractsList();
    });
  }
  
  if (filterBuilderSelect) {
    filterBuilderSelect.addEventListener("change", (e) => {
      filterBuilder = e.target.value;
      applyFiltersAndSearch();
      renderContractsList();
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      applyFiltersAndSearch();
      renderContractsList();
    });
  }
  
  // Tabs
  $$(".contracts-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.tab);
    });
  });
  
  // Modal close handlers
  $$(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
      }
    });
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideBuilderModal();
      hideContractModal();
      hideJobModal();
    }
  });
  
  // Update builder filter dropdown
  function updateBuilderFilter() {
    if (!filterBuilderSelect) return;
    const currentValue = filterBuilderSelect.value;
    filterBuilderSelect.innerHTML = '<option value="">All Builders</option>';
    builders.forEach(builder => {
      const option = document.createElement("option");
      option.value = builder.id;
      option.textContent = builder.name;
      filterBuilderSelect.appendChild(option);
    });
    filterBuilderSelect.value = currentValue;
  }
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      await loadAllData();
      updateBuilderFilter();
    } else {
      currentUid = null;
      builders = [];
      contracts = [];
      jobs = [];
      selectedBuilderId = null;
      selectedContractId = null;
      renderContractsList();
      renderContractDetail();
      renderJobsSection(); // Clear jobs section on logout
    }
  });
}

// Make functions globally available
window.showBuilderModal = showBuilderModal;
window.hideBuilderModal = hideBuilderModal;
window.showContractModal = showContractModal;
window.hideContractModal = hideContractModal;
window.showJobModal = showJobModal;
window.hideJobModal = hideJobModal;
window.selectBuilder = selectBuilder;
window.selectContract = selectContract;
window.deleteContractConfirm = deleteContractConfirm;
window.deleteJobConfirm = deleteJobConfirm;
window.duplicateContract = duplicateContract;

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
