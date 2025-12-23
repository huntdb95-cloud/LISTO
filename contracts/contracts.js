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
let jobs = [];
let selectedBuilderId = null;
let filteredData = { builders: [], jobs: [] };
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

// ========== MIGRATION: Move jobs from contracts to builders ==========

async function migrateJobsFromContracts() {
  if (!currentUid) return;
  
  try {
    // Check if migration already done
    const migrationCheck = localStorage.getItem(`jobs_migrated_to_builders_${currentUid}`);
    if (migrationCheck === "true") return;
    
    // Load all builders
    const buildersCol = collection(db, "users", currentUid, "builders");
    const buildersSnap = await getDocs(buildersCol);
    
    let migrationCount = 0;
    
    // For each builder, check for contracts and migrate their jobs
    for (const builderDoc of buildersSnap.docs) {
      const builderId = builderDoc.id;
      const contractsCol = collection(db, "users", currentUid, "builders", builderId, "contracts");
      const contractsSnap = await getDocs(contractsCol);
      
      for (const contractDoc of contractsSnap.docs) {
        const contractId = contractDoc.id;
        // Load jobs from old location (under contract)
        const oldJobsCol = collection(db, "users", currentUid, "builders", builderId, "contracts", contractId, "jobs");
        const oldJobsSnap = await getDocs(oldJobsCol);
        
        // Move each job to new location (directly under builder)
        for (const jobDoc of oldJobsSnap.docs) {
          const jobData = jobDoc.data();
          // Remove contractId, ensure builderId is set
          const newJobData = {
            ...jobData,
            builderId: builderId,
            _migratedFromContract: contractId,
            updatedAt: serverTimestamp()
          };
          delete newJobData.contractId;
          delete newJobData.contractTitle;
          
          // Create job in new location
          const newJobsCol = collection(db, "users", currentUid, "builders", builderId, "jobs");
          await addDoc(newJobsCol, newJobData);
          
          // Delete old job
          await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "contracts", contractId, "jobs", jobDoc.id));
          migrationCount++;
        }
      }
    }
    
    if (migrationCount > 0) {
      console.log(`Migrated ${migrationCount} jobs from contracts to builders`);
    }
    
    localStorage.setItem(`jobs_migrated_to_builders_${currentUid}`, "true");
  } catch (err) {
    console.warn("Job migration error (non-blocking):", err);
    // Don't block if migration fails
  }
}

// ========== DATA LOADING ==========

async function loadAllData() {
  if (!currentUid) return;
  
  try {
    // Run migration first (one-time)
    await migrateJobsFromContracts();
    
    // Load builders
    const buildersCol = collection(db, "users", currentUid, "builders");
    const buildersSnap = await getDocs(query(buildersCol, orderBy("name")));
    builders = buildersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Load jobs for selected builder (directly under builder, no contracts)
    jobs = [];
    if (selectedBuilderId) {
      const jobsCol = collection(db, "users", currentUid, "builders", selectedBuilderId, "jobs");
      const jobsSnap = await getDocs(query(jobsCol, orderBy("dueDate", "asc")));
      jobs = jobsSnap.docs.map(d => ({
        id: d.id,
        builderId: selectedBuilderId,
        ...d.data()
      }));
    }
    
    updateSummaryCards();
    applyFiltersAndSearch();
    renderContractsList();
    renderJobsSection();
  } catch (err) {
    console.error("Error loading data:", err);
    showToast("Error loading data: " + getFriendlyError(err), true);
  }
}

// ========== SUMMARY CARDS ==========

function updateSummaryCards() {
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
  
  const totalBuilders = builders.length;
  
  const openEl = $("statOpenJobs");
  const overdueEl = $("statOverdueJobs");
  const buildersEl = $("statTotalBuilders");
  
  if (openEl) openEl.textContent = openJobs;
  if (overdueEl) overdueEl.textContent = overdueJobs;
  if (buildersEl) buildersEl.textContent = totalBuilders;
}

// ========== SEARCH & FILTERS ==========

function applyFiltersAndSearch() {
  let filteredBuilders = [...builders];
  let filteredJobs = [...jobs];
  
  // Search filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredBuilders = filteredBuilders.filter(b => 
      b.name?.toLowerCase().includes(term)
    );
    filteredJobs = filteredJobs.filter(j =>
      j.jobName?.toLowerCase().includes(term) ||
      j.jobAddress?.toLowerCase().includes(term)
    );
  }
  
  // Status filter (for jobs)
  if (filterStatus) {
    filteredJobs = filteredJobs.filter(j => j.status === filterStatus);
  }
  
  // Builder filter (for jobs)
  if (filterBuilder) {
    filteredJobs = filteredJobs.filter(j => j.builderId === filterBuilder);
  }
  
  filteredData = {
    builders: filteredBuilders,
    jobs: filteredJobs
  };
}


// ========== RENDERING ==========

function renderContractsList() {
  const listEl = $("contractsList");
  if (!listEl) return;
  
  if (filteredData.builders.length === 0) {
    listEl.innerHTML = `
      <div class="contracts-empty-state">
        <p>No builders found.</p>
        <button type="button" class="btn primary small" onclick="showBuilderModal()">Create Your First Builder</button>
      </div>
    `;
    return;
  }
  
  let html = "";
  
  // Render builders
  for (const builder of filteredData.builders) {
    const isSelected = selectedBuilderId === builder.id;
    const builderJobsCount = jobs.filter(j => j.builderId === builder.id).length;
    
    html += `
      <div class="contracts-list-item contracts-list-builder ${isSelected ? "contracts-list-item-selected" : ""}" 
           data-builder-id="${builder.id}">
        <div class="contracts-list-item-header" onclick="selectBuilder('${builder.id}')">
          <div class="contracts-list-item-title">
            <strong>${escapeHtml(builder.name)}</strong>
            <span class="contracts-list-item-count">${builderJobsCount} job${builderJobsCount !== 1 ? "s" : ""}</span>
          </div>
          <button type="button" class="contracts-list-item-action" onclick="event.stopPropagation(); showBuilderModal('${builder.id}')">
            <span>✎</span>
          </button>
        </div>
      </div>
    `;
  }
  
  listEl.innerHTML = html;
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
  const container = $("jobsSectionContainer");
  const titleEl = $("jobsSectionTitle");
  const newJobBtn = $("newJobBtnStandalone");
  const emptyEl = $("jobsSectionEmpty");
  
  if (!tbody || !container) return;
  
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
    // Clear mobile cards
    const mobileContainer = container.querySelector(".contracts-jobs-mobile");
    if (mobileContainer) mobileContainer.innerHTML = "";
    return;
  }
  
  if (builderJobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="contracts-empty-state">No jobs found for this builder.</td>
      </tr>
    `;
    // Clear mobile cards
    const mobileContainer = container.querySelector(".contracts-jobs-mobile");
    if (mobileContainer) mobileContainer.innerHTML = "";
    return;
  }
  
  // Render desktop table
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
            <button type="button" class="btn small" onclick="showJobModal('${job.id}')">Edit</button>
            <button type="button" class="btn small ghost" onclick="deleteJobConfirm('${job.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  
  // Render mobile cards
  let mobileContainer = container.querySelector(".contracts-jobs-mobile");
  if (!mobileContainer) {
    mobileContainer = document.createElement("div");
    mobileContainer.className = "contracts-jobs-mobile";
    container.appendChild(mobileContainer);
  }
  
  mobileContainer.innerHTML = builderJobs.map(job => {
    const startDate = formatDate(job.startDate);
    const dueDateFormatted = formatDate(job.dueDate);
    // Check if job is overdue
    let isOverdue = false;
    if (job.dueDate && !["completed", "paid"].includes(job.status)) {
      const dueDateObj = job.dueDate.toDate ? job.dueDate.toDate() : new Date(job.dueDate);
      const today = new Date();
      const dueDateOnly = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      isOverdue = dueDateOnly < todayOnly;
    }
    
    return `
      <div class="contracts-job-card ${isOverdue ? "overdue" : ""}">
        <div class="contracts-job-card-header">
          <h3 class="contracts-job-card-title">${escapeHtml(job.jobName || "—")}</h3>
          <div class="contracts-job-card-status">
            <span class="contracts-status-badge contracts-status-badge-${job.status || "not-started"}">
              ${formatStatus(job.status || "not-started")}
            </span>
          </div>
        </div>
        <div class="contracts-job-card-field">
          <span class="contracts-job-card-label">Address:</span>
          <span class="contracts-job-card-value">${escapeHtml(job.jobAddress || "—")}</span>
        </div>
        <div class="contracts-job-card-field">
          <span class="contracts-job-card-label">Start Date:</span>
          <span class="contracts-job-card-value">${startDate}</span>
        </div>
        <div class="contracts-job-card-field">
          <span class="contracts-job-card-label">Due Date:</span>
          <span class="contracts-job-card-value ${isOverdue ? "contracts-overdue-text" : ""}">${dueDateFormatted}</span>
        </div>
        <div class="contracts-job-card-field">
          <span class="contracts-job-card-label">Progress:</span>
          <span class="contracts-job-card-value">
            <div class="contracts-progress-bar" style="margin-top: 4px;">
              <div class="contracts-progress-fill" style="width: ${job.progressPct || 0}%"></div>
              <span class="contracts-progress-text">${job.progressPct || 0}%</span>
            </div>
          </span>
        </div>
        <div class="contracts-job-card-field">
          <span class="contracts-job-card-label">Budget:</span>
          <span class="contracts-job-card-value">${formatCurrency(job.budget || 0)}</span>
        </div>
        <div class="contracts-job-card-actions">
          <button type="button" class="btn small" onclick="showJobModal('${job.id}')">Edit</button>
          <button type="button" class="btn small ghost" onclick="deleteJobConfirm('${job.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

// ========== SELECTION ==========

async function selectBuilder(builderId) {
  selectedBuilderId = builderId;
  jobs = [];
  await loadAllData(); // Load data first (this will also call renderJobsSection)
  renderContractsList(); // Then render with fresh data
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
    showToast("Error: Save button not found. Please refresh the page.", true);
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
      showToast("Builder name is required.", true);
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
      showToast("Builder created successfully!");
      await loadAllData();
      // Auto-select the newly created builder
      selectedBuilderId = newRef.id;
      renderContractsList();
      renderJobsSection();
      setTimeout(() => {
        hideBuilderModal();
        showToast("Builder added to list!");
      }, 1000);
    } else {
      const builderRef = doc(db, "users", currentUid, "builders", builderId);
      await updateDoc(builderRef, builderData);
      showBuilderMsg("Builder updated successfully!", false);
      showToast("Builder updated successfully!");
      await loadAllData();
      setTimeout(() => hideBuilderModal(), 1000);
    }
  } catch (err) {
    const errorMsg = getFriendlyError(err);
    showBuilderError(errorMsg);
    showToast("Error saving builder: " + errorMsg, true);
  } finally {
    btn.disabled = oldDisabled;
  }
}

async function deleteBuilder(builderId) {
  // Check if builder has jobs
  const builderJobs = jobs.filter(j => j.builderId === builderId);
  if (builderJobs.length > 0) {
    if (!confirm(`Delete this builder? This builder has ${builderJobs.length} job${builderJobs.length !== 1 ? "s" : ""} that will also be deleted. This cannot be undone.`)) {
      return;
    }
  } else {
    if (!confirm("Delete this builder? This cannot be undone.")) {
      return;
    }
  }
  
  if (!currentUid) return;
  
  try {
    // Delete all jobs under this builder (new structure)
    const jobsCol = collection(db, "users", currentUid, "builders", builderId, "jobs");
    const jobsSnap = await getDocs(jobsCol);
    for (const jobDoc of jobsSnap.docs) {
      await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "jobs", jobDoc.id));
    }
    
    // Also check for legacy jobs under contracts (migration cleanup)
    const contractsCol = collection(db, "users", currentUid, "builders", builderId, "contracts");
    const contractsSnap = await getDocs(contractsCol);
    for (const contractDoc of contractsSnap.docs) {
      const legacyJobsCol = collection(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id, "jobs");
      const legacyJobsSnap = await getDocs(legacyJobsCol);
      for (const jobDoc of legacyJobsSnap.docs) {
        await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id, "jobs", jobDoc.id));
      }
      await deleteDoc(doc(db, "users", currentUid, "builders", builderId, "contracts", contractDoc.id));
    }
    
    // Delete builder
    await deleteDoc(doc(db, "users", currentUid, "builders", builderId));
    
    selectedBuilderId = null;
    await loadAllData();
    showToast("Builder deleted successfully.");
  } catch (err) {
    console.error("Error deleting builder:", err);
    showToast("Error deleting builder: " + getFriendlyError(err), true);
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
    const builderId = $("jobBuilderId")?.value || selectedBuilderId;
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
    
    if (!builderId) {
      showJobError("Builder is required. Please select a builder first.");
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
      builderId,
      updatedAt: serverTimestamp()
    };
    
    if (!jobId) {
      jobData.createdAt = serverTimestamp();
      const jobsCol = collection(db, "users", currentUid, "builders", builderId, "jobs");
      const newRef = await addDoc(jobsCol, jobData);
      showJobMsg("Job created successfully!", false);
      await loadAllData();
      setTimeout(() => hideJobModal(), 1000);
    } else {
      const jobRef = doc(db, "users", currentUid, "builders", builderId, "jobs", jobId);
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

async function deleteJobConfirm(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  
  if (!confirm(`Delete job "${job.jobName}"? This cannot be undone.`)) {
    return;
  }
  
  if (!currentUid || !job.builderId) return;
  
  try {
    // Try new location first
    try {
      const jobRef = doc(db, "users", currentUid, "builders", job.builderId, "jobs", jobId);
      await deleteDoc(jobRef);
    } catch (err) {
      // Fallback: try legacy location (under contract)
      if (job.contractId) {
        const legacyJobRef = doc(db, "users", currentUid, "builders", job.builderId, "contracts", job.contractId, "jobs", jobId);
        await deleteDoc(legacyJobRef);
      } else {
        throw err;
      }
    }
    
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
    showToast("Error: Modal not found. Please refresh the page.", true);
    return;
  }
  
  // Show modal
  modal.style.display = "flex";
  if (title) title.textContent = builderId ? "Edit Builder" : "New Builder";
  
  const form = $("builderForm");
  if (form) form.reset();
  
  const idInput = $("builderId");
  if (idInput) idInput.value = builderId || "";
  
  // Re-enable save button in case it was disabled
  const saveBtn = $("saveBuilderBtn");
  if (saveBtn) {
    saveBtn.disabled = false;
  } else {
    console.error("Save builder button not found");
  }
  
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
  
  // Focus on first input for better UX
  setTimeout(() => {
    const nameInput = $("builderName");
    if (nameInput) nameInput.focus();
  }, 100);
}

function hideBuilderModal() {
  const modal = $("builderModal");
  if (modal) modal.style.display = "none";
  clearBuilderMessages();
  document.body.style.overflow = "";
}


function showJobModal(jobId = null) {
  const modal = $("jobModal");
  const title = $("jobModalTitle");
  if (!modal) return;
  
  if (!selectedBuilderId) {
    showToast("Please select a builder first.", true);
    return;
  }
  
  modal.style.display = "flex";
  if (title) title.textContent = jobId ? "Edit Job" : "New Job";
  
  const form = $("jobForm");
  if (form) form.reset();
  
  const idInput = $("jobId");
  const builderInput = $("jobBuilderId");
  if (idInput) idInput.value = jobId || "";
  if (builderInput) builderInput.value = selectedBuilderId;
  
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
      if (builderInput) builderInput.value = job.builderId || selectedBuilderId;
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
  const newJobBtnStandalone = $("newJobBtnStandalone");
  
  if (newBuilderBtn) {
    newBuilderBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showBuilderModal();
    });
  }
  
  if (newJobBtnStandalone) {
    newJobBtnStandalone.addEventListener("click", () => {
      if (!selectedBuilderId) {
        showToast("Please select a builder first.", true);
        return;
      }
      showJobModal();
    });
  }
  
  // Forms
  const builderForm = $("builderForm");
  const jobForm = $("jobForm");
  
  if (builderForm) builderForm.addEventListener("submit", saveBuilder);
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
      jobs = [];
      selectedBuilderId = null;
      renderContractsList();
      renderJobsSection(); // Clear jobs section on logout
    }
  });
}

// Make functions globally available
window.showBuilderModal = showBuilderModal;
window.hideBuilderModal = hideBuilderModal;
window.showJobModal = showJobModal;
window.hideJobModal = hideJobModal;
window.selectBuilder = selectBuilder;
window.deleteJobConfirm = deleteJobConfirm;

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
