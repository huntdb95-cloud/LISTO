// contracts.js
// Builder Contracts Management - Manage active/inactive contracts with builders and jobs

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
let contracts = [];
let editingContractId = null;
let expandedContracts = new Set(); // Track which contracts have expanded job sections

// Helper functions
function showMsg(msg, isError = false) {
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

function clearMessages() {
  const msgEl = $("contractFormMsg");
  const errEl = $("contractFormError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

function getFriendlyError(err) {
  if (err?.message) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred. Please try again.";
}

// Tab Management
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

// Load contracts
async function loadContracts() {
  if (!currentUid) return;
  
  try {
    const contractsCol = collection(db, "users", currentUid, "contracts");
    const q = query(contractsCol, orderBy("builderName"));
    const snap = await getDocs(q);
    
    contracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderContracts();
  } catch (err) {
    console.error("Error loading contracts:", err);
    const activeList = $("activeContractsList");
    const inactiveList = $("inactiveContractsList");
    if (activeList) activeList.innerHTML = `<div class="form-error">Error loading contracts: ${getFriendlyError(err)}</div>`;
    if (inactiveList) inactiveList.innerHTML = `<div class="form-error">Error loading contracts: ${getFriendlyError(err)}</div>`;
  }
}

// Load jobs for a contract
async function loadJobs(contractId) {
  if (!currentUid || !contractId) return [];
  
  try {
    const jobsCol = collection(db, "users", currentUid, "contracts", contractId, "jobs");
    const q = query(jobsCol, orderBy("jobName"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading jobs:", err);
    return [];
  }
}

// Render contracts
async function renderContracts() {
  const activeList = $("activeContractsList");
  const inactiveList = $("inactiveContractsList");
  if (!activeList || !inactiveList) return;
  
  const active = contracts.filter(c => c.isActive !== false);
  const inactive = contracts.filter(c => c.isActive === false);
  
  if (active.length === 0) {
    activeList.innerHTML = `<div class="muted" data-i18n="contracts.noActiveContracts">No active contracts. Click "Add Builder Contract" to get started.</div>`;
  } else {
    const activeHtml = await Promise.all(active.map(async (contract) => {
      const jobs = await loadJobs(contract.id);
      return renderContractCard(contract, jobs, true);
    }));
    activeList.innerHTML = activeHtml.join("");
  }
  
  if (inactive.length === 0) {
    inactiveList.innerHTML = `<div class="muted" data-i18n="contracts.noInactiveContracts">No inactive contracts.</div>`;
  } else {
    const inactiveHtml = await Promise.all(inactive.map(async (contract) => {
      const jobs = await loadJobs(contract.id);
      return renderContractCard(contract, jobs, false);
    }));
    inactiveList.innerHTML = inactiveHtml.join("");
  }
  
  // Re-attach event listeners
  attachContractEventListeners();
}

// Render a single contract card
function renderContractCard(contract, jobs, isActive) {
  const builderCoiLink = contract.builderCoiUrl ? 
    `<a href="${contract.builderCoiUrl}" target="_blank" class="mini-link document-link">View Builder COI</a>` : 
    `<span class="muted small">No Builder COI uploaded</span>`;
  
  const subAgreementLink = contract.subAgreementUrl ? 
    `<a href="${contract.subAgreementUrl}" target="_blank" class="mini-link document-link">View Sub Agreement</a>` : 
    `<span class="muted small">No Sub Agreement uploaded</span>`;
  
  const isExpanded = expandedContracts.has(contract.id);
  const jobsHtml = isExpanded ? renderJobs(contract.id, jobs) : "";
  
  return `
    <div class="contract-card" data-contract-id="${contract.id}">
      <div class="contract-header">
        <h3 class="contract-title">${contract.builderName || "—"}</h3>
        <div class="contract-actions">
          <button class="btn small" onclick="editContract('${contract.id}')" data-i18n="contracts.edit">Edit</button>
          <button class="btn small" onclick="toggleContractActive('${contract.id}', ${!isActive})" data-i18n="contracts.${isActive ? 'deactivate' : 'activate'}">${isActive ? 'Deactivate' : 'Activate'}</button>
          <button class="btn small ghost" onclick="deleteContract('${contract.id}', '${(contract.builderName || "").replace(/'/g, "\\'")}')" data-i18n="contracts.delete">Delete</button>
        </div>
      </div>
      
      <div class="document-links" style="margin-top: 12px;">
        <div><strong>Documents:</strong></div>
        <div>${builderCoiLink}</div>
        <div>${subAgreementLink}</div>
      </div>
      
      <div class="jobs-section">
        <div class="row-between" style="margin-bottom: 12px;">
          <h4 class="h4" data-i18n="contracts.jobs">Jobs</h4>
          <div style="display: flex; gap: 8px;">
            <button class="btn small primary" onclick="addJob('${contract.id}')" data-i18n="contracts.addJob">Add Job</button>
            <button class="btn small" onclick="toggleJobs('${contract.id}')" data-i18n="contracts.${isExpanded ? 'hideJobs' : 'showJobs'}">${isExpanded ? 'Hide Jobs' : 'Show Jobs'} (${jobs.length})</button>
          </div>
        </div>
        ${isExpanded ? `
          <div id="jobs-${contract.id}">
            ${jobsHtml}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// Render jobs for a contract
function renderJobs(contractId, jobs) {
  if (jobs.length === 0) {
    return `<div class="muted small" data-i18n="contracts.noJobs">No jobs added yet.</div>`;
  }
  
  return jobs.map(job => {
    const projectCoiLink = job.projectCoiUrl ? 
      `<a href="${job.projectCoiUrl}" target="_blank" class="mini-link document-link">View Project COI</a>` : 
      `<span class="muted small">No Project COI uploaded</span>`;
    
    const isPaid = job.isPaid === true;
    const paidStatusClass = isPaid ? "paid" : "unpaid";
    const paidStatusText = isPaid ? "Paid" : "Unpaid";
    
    return `
      <div class="job-card" data-job-id="${job.id}">
        <div class="job-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h5 class="job-title" style="margin: 0;">${job.jobName || "—"}</h5>
              <span class="job-status-badge ${paidStatusClass}" onclick="toggleJobPaidStatus('${contractId}', '${job.id}', ${!isPaid})" style="cursor: pointer; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                ${paidStatusText}
              </span>
            </div>
            <div class="small muted" style="margin-top: 4px;">
              ${job.address ? `<div><strong>Address:</strong> ${job.address}</div>` : ""}
              ${job.description ? `<div style="margin-top: 4px;"><strong>Description:</strong> ${job.description}</div>` : ""}
            </div>
          </div>
          <div class="job-actions">
            <button class="btn small" onclick="editJob('${contractId}', '${job.id}')" data-i18n="contracts.edit">Edit</button>
            <button class="btn small ghost" onclick="deleteJob('${contractId}', '${job.id}', '${(job.jobName || "").replace(/'/g, "\\'")}')" data-i18n="contracts.delete">Delete</button>
          </div>
        </div>
        <div class="document-links" style="margin-top: 8px;">
          ${projectCoiLink}
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

// Show contract modal
function showContractModal(contract = null) {
  editingContractId = contract ? contract.id : null;
  const modal = $("contractModal");
  const modalTitle = $("contractModalTitle");
  if (!modal) return;
  
  modal.style.display = "flex";
  if (modalTitle) {
    modalTitle.textContent = contract ? "Edit Builder Contract" : "Add Builder Contract";
  }
  
  const form = $("contractForm");
  if (form) form.reset();
  
  const contractIdInput = $("contractId");
  if (contractIdInput) contractIdInput.value = contract ? contract.id : "";
  
  const builderName = $("builderName");
  if (builderName) builderName.value = contract?.builderName || "";
  
  const builderCoi = $("builderCoi");
  const subAgreement = $("subAgreement");
  const subAgreementType = $("subAgreementType");
  const subAgreementSignOption = $("subAgreementSignOption");
  const subAgreementUploadOption = $("subAgreementUploadOption");
  
  if (builderCoi) builderCoi.value = "";
  if (subAgreement) subAgreement.value = "";
  
  // Set sub-agreement type based on existing contract
  if (subAgreementType) {
    if (contract?.subAgreementUrl) {
      subAgreementType.value = "upload";
      if (subAgreementSignOption) subAgreementSignOption.style.display = "none";
      if (subAgreementUploadOption) subAgreementUploadOption.style.display = "block";
    } else if (contract?.subAgreementType === "sign") {
      subAgreementType.value = "sign";
      if (subAgreementSignOption) subAgreementSignOption.style.display = "block";
      if (subAgreementUploadOption) subAgreementUploadOption.style.display = "none";
    } else {
      subAgreementType.value = "";
      if (subAgreementSignOption) subAgreementSignOption.style.display = "none";
      if (subAgreementUploadOption) subAgreementUploadOption.style.display = "none";
    }
  }
  
  const builderCoiStatus = $("builderCoiStatus");
  const subAgreementStatus = $("subAgreementStatus");
  if (builderCoiStatus) builderCoiStatus.textContent = contract?.builderCoiUrl ? "Current file uploaded" : "";
  if (subAgreementStatus) subAgreementStatus.textContent = contract?.subAgreementUrl ? "Current file uploaded" : "";
  
  clearMessages();
  
  // Prevent body scroll when modal is open
  document.body.style.overflow = "hidden";
}

// Hide contract modal
function hideContractModal() {
  const modal = $("contractModal");
  if (modal) modal.style.display = "none";
  editingContractId = null;
  clearMessages();
  document.body.style.overflow = "";
}

// Legacy function for backward compatibility
function showContractForm(contract = null) {
  showContractModal(contract);
}

function hideContractForm() {
  hideContractModal();
}

// Save contract
async function saveContract(e) {
  e.preventDefault();
  
  if (!currentUid) {
    showMsg("Please sign in first.", true);
    return;
  }
  
  const btn = $("saveContractBtn");
  if (!btn) return;
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages();
    showMsg("Saving contract...");
    
    const builderName = $("builderName");
    if (!builderName) return;
    
    const name = builderName.value.trim();
    if (!name) {
      showMsg("Builder name is required.", true);
      return;
    }
    
    const contractData = {
      builderName: name,
      isActive: true,
      updatedAt: serverTimestamp()
    };
    
    let contractId = editingContractId;
    const existing = contractId ? contracts.find(c => c.id === contractId) : null;
    
    if (!contractId) {
      contractData.createdAt = serverTimestamp();
      const contractsCol = collection(db, "users", currentUid, "contracts");
      const newRef = await addDoc(contractsCol, contractData);
      contractId = newRef.id;
    } else {
      if (existing?.builderCoiUrl && !$("builderCoi")?.files[0]) contractData.builderCoiUrl = existing.builderCoiUrl;
      if (existing?.builderCoiPath && !$("builderCoi")?.files[0]) contractData.builderCoiPath = existing.builderCoiPath;
      if (existing?.subAgreementUrl && !$("subAgreement")?.files[0]) contractData.subAgreementUrl = existing.subAgreementUrl;
      if (existing?.subAgreementPath && !$("subAgreement")?.files[0]) contractData.subAgreementPath = existing.subAgreementPath;
      contractData.isActive = existing?.isActive !== false;
    }
    
    const builderCoiFile = $("builderCoi")?.files[0];
    const subAgreementType = $("subAgreementType")?.value;
    const subAgreementFile = $("subAgreement")?.files[0];
    
    // Validate sub-agreement type selection
    if (!subAgreementType) {
      showMsg("Please select an option for Subcontractor Agreement.", true);
      return;
    }
    
    if (subAgreementType === "upload" && !subAgreementFile && !existing?.subAgreementUrl) {
      showMsg("Please upload a signed agreement file or select 'Sign Standard Agreement'.", true);
      return;
    }
    
    if (builderCoiFile) {
      showMsg("Uploading Builder COI...");
      if (existing?.builderCoiPath) await deleteFile(existing.builderCoiUrl);
      const builderCoiUrl = await uploadFile(builderCoiFile, `users/${currentUid}/contracts/${contractId}/builderCoi`);
      const builderCoiPath = `users/${currentUid}/contracts/${contractId}/builderCoi/${Date.now()}_${builderCoiFile.name.replace(/[^\w.\-]+/g, "_")}`;
      contractData.builderCoiUrl = builderCoiUrl;
      contractData.builderCoiPath = builderCoiPath;
    }
    
    // Handle sub-agreement based on type
    if (subAgreementType === "upload") {
      if (subAgreementFile) {
        showMsg("Uploading Sub Agreement...");
        if (existing?.subAgreementPath) await deleteFile(existing.subAgreementUrl);
        const subAgreementUrl = await uploadFile(subAgreementFile, `users/${currentUid}/contracts/${contractId}/subAgreement`);
        const subAgreementPath = `users/${currentUid}/contracts/${contractId}/subAgreement/${Date.now()}_${subAgreementFile.name.replace(/[^\w.\-]+/g, "_")}`;
        contractData.subAgreementUrl = subAgreementUrl;
        contractData.subAgreementPath = subAgreementPath;
      }
    } else if (subAgreementType === "sign") {
      // User will sign standard agreement - mark that they need to sign
      contractData.subAgreementType = "sign";
      contractData.subAgreementSigned = false; // Will be set to true when they sign on agreement page
    }
    
    const contractRef = doc(db, "users", currentUid, "contracts", contractId);
    await updateDoc(contractRef, contractData);
    
    showMsg("Contract saved successfully!", false);
    await loadContracts();
    
    setTimeout(() => {
      hideContractForm();
    }, 1500);
    
  } catch (err) {
    console.error("Error saving contract:", err);
    showMsg(getFriendlyError(err), true);
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Delete contract
async function deleteContract(contractId, builderName) {
  if (!confirm(`Delete contract with ${builderName || "this builder"}? This will also delete all associated jobs. This action cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const contract = contracts.find(c => c.id === contractId);
    
    // Delete files from Storage
    if (contract?.builderCoiUrl) await deleteFile(contract.builderCoiUrl);
    if (contract?.subAgreementUrl) await deleteFile(contract.subAgreementUrl);
    
    // Delete all jobs and their files
    const jobs = await loadJobs(contractId);
    for (const job of jobs) {
      if (job.projectCoiUrl) await deleteFile(job.projectCoiUrl);
      const jobRef = doc(db, "users", currentUid, "contracts", contractId, "jobs", job.id);
      await deleteDoc(jobRef);
    }
    
    // Delete contract
    const contractRef = doc(db, "users", currentUid, "contracts", contractId);
    await deleteDoc(contractRef);
    
    await loadContracts();
  } catch (err) {
    console.error("Error deleting contract:", err);
    alert(`Error deleting contract: ${getFriendlyError(err)}`);
  }
}

// Toggle contract active status
async function toggleContractActive(contractId, makeActive) {
  if (!currentUid) return;
  
  try {
    const contractRef = doc(db, "users", currentUid, "contracts", contractId);
    await updateDoc(contractRef, {
      isActive: makeActive,
      updatedAt: serverTimestamp()
    });
    
    await loadContracts();
  } catch (err) {
    console.error("Error updating contract:", err);
    alert(`Error updating contract: ${getFriendlyError(err)}`);
  }
}

// Edit contract
function editContract(contractId) {
  const contract = contracts.find(c => c.id === contractId);
  if (contract) {
    showContractForm(contract);
  }
}

// Toggle jobs visibility
async function toggleJobs(contractId) {
  if (expandedContracts.has(contractId)) {
    expandedContracts.delete(contractId);
  } else {
    expandedContracts.add(contractId);
  }
  await renderContracts();
}

// Add job
function addJob(contractId) {
  const contract = contracts.find(c => c.id === contractId);
  if (!contract) return;
  
  showJobModal(contractId);
}

// Show job modal
function showJobModal(contractId, job = null) {
  const modal = $("jobModal");
  const modalTitle = $("jobModalTitle");
  if (!modal) return;
  
  modal.style.display = "flex";
  if (modalTitle) {
    modalTitle.textContent = job ? "Edit Job" : "Add Job";
  }
  
  const form = $("jobForm");
  if (form) form.reset();
  
  const contractIdInput = $("jobContractId");
  const jobIdInput = $("jobId");
  if (contractIdInput) contractIdInput.value = contractId;
  if (jobIdInput) jobIdInput.value = job ? job.id : "";
  
  const jobName = $("jobName");
  const jobAddress = $("jobAddress");
  const jobDescription = $("jobDescription");
  const jobProjectCoi = $("jobProjectCoi");
  
  if (jobName) jobName.value = job?.jobName || "";
  if (jobAddress) jobAddress.value = job?.address || "";
  if (jobDescription) jobDescription.value = job?.description || "";
  if (jobProjectCoi) jobProjectCoi.value = "";
  
  const projectCoiStatus = $("jobProjectCoiStatus");
  if (projectCoiStatus) projectCoiStatus.textContent = job?.projectCoiUrl ? "Current file uploaded" : "";
  
  clearJobMessages();
  
  // Prevent body scroll when modal is open
  document.body.style.overflow = "hidden";
}

// Hide job modal
function hideJobModal() {
  const modal = $("jobModal");
  if (modal) modal.style.display = "none";
  clearJobMessages();
  document.body.style.overflow = "";
}

// Clear job form messages
function clearJobMessages() {
  const msgEl = $("jobFormMsg");
  const errEl = $("jobFormError");
  if (msgEl) msgEl.textContent = "";
  if (errEl) errEl.textContent = "";
}

// Legacy function for backward compatibility
function showJobForm(contractId, job = null) {
  showJobModal(contractId, job);
}

// Save job (from form)
async function saveJobFromForm(e) {
  e.preventDefault();
  
  if (!currentUid) {
    showJobError("Please sign in first.");
    return;
  }
  
  const btn = $("saveJobBtn");
  if (!btn) return;
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearJobMessages();
    showJobMsg("Saving job...");
    
    const contractId = $("jobContractId")?.value;
    const jobId = $("jobId")?.value || null;
    const jobName = $("jobName")?.value.trim();
    const address = $("jobAddress")?.value.trim() || null;
    const description = $("jobDescription")?.value.trim() || null;
    const projectCoiFile = $("jobProjectCoi")?.files[0] || null;
    
    if (!contractId) {
      showJobError("Contract ID is missing.");
      return;
    }
    
    if (!jobName) {
      showJobError("Job name is required.");
      return;
    }
    
    await saveJob(contractId, jobId, jobName, address, description, projectCoiFile);
    
    showJobMsg("Job saved successfully!", false);
    await loadContracts();
    
    setTimeout(() => {
      hideJobModal();
    }, 1000);
    
  } catch (err) {
    console.error("Error saving job:", err);
    showJobError(getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Save job (internal function)
async function saveJob(contractId, jobId, jobName, address, description, projectCoiFile) {
  if (!currentUid) return;
  
  try {
    const jobData = {
      jobName: jobName.trim(),
      address: address ? address.trim() : null,
      description: description ? description.trim() : null,
      updatedAt: serverTimestamp()
    };
    
    let finalJobId = jobId;
    
    if (!jobId) {
      jobData.createdAt = serverTimestamp();
      const jobsCol = collection(db, "users", currentUid, "contracts", contractId, "jobs");
      const newRef = await addDoc(jobsCol, jobData);
      finalJobId = newRef.id;
    } else {
      const existing = await loadJobs(contractId);
      const existingJob = existing.find(j => j.id === jobId);
      if (existingJob?.projectCoiUrl && !projectCoiFile) {
        jobData.projectCoiUrl = existingJob.projectCoiUrl;
        jobData.projectCoiPath = existingJob.projectCoiPath;
      }
    }
    
    if (projectCoiFile) {
      if (jobId) {
        const existing = await loadJobs(contractId);
        const existingJob = existing.find(j => j.id === jobId);
        if (existingJob?.projectCoiPath) await deleteFile(existingJob.projectCoiUrl);
      }
      const projectCoiUrl = await uploadFile(projectCoiFile, `users/${currentUid}/contracts/${contractId}/jobs/${finalJobId}/projectCoi`);
      const projectCoiPath = `users/${currentUid}/contracts/${contractId}/jobs/${finalJobId}/projectCoi/${Date.now()}_${projectCoiFile.name.replace(/[^\w.\-]+/g, "_")}`;
      jobData.projectCoiUrl = projectCoiUrl;
      jobData.projectCoiPath = projectCoiPath;
    }
    
    const jobRef = doc(db, "users", currentUid, "contracts", contractId, "jobs", finalJobId);
    await updateDoc(jobRef, jobData);
    
    await loadContracts();
  } catch (err) {
    console.error("Error saving job:", err);
    throw err;
  }
}

// Show job message
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

// Show job error
function showJobError(msg) {
  showJobMsg(msg, true);
}

// Edit job
function editJob(contractId, jobId) {
  loadJobs(contractId).then(jobs => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      showJobModal(contractId, job);
    }
  });
}

// Delete job
async function deleteJob(contractId, jobId, jobName) {
  if (!confirm(`Delete job "${jobName || "this job"}"? This action cannot be undone.`)) {
    return;
  }
  
  if (!currentUid) return;
  
  try {
    const jobs = await loadJobs(contractId);
    const job = jobs.find(j => j.id === jobId);
    
    if (job?.projectCoiUrl) await deleteFile(job.projectCoiUrl);
    
    const jobRef = doc(db, "users", currentUid, "contracts", contractId, "jobs", jobId);
    await deleteDoc(jobRef);
    
    await loadContracts();
  } catch (err) {
    console.error("Error deleting job:", err);
    alert(`Error deleting job: ${getFriendlyError(err)}`);
  }
}

// Toggle job paid status
async function toggleJobPaidStatus(contractId, jobId, setPaid) {
  if (!currentUid) return;
  
  try {
    const jobRef = doc(db, "users", currentUid, "contracts", contractId, "jobs", jobId);
    await updateDoc(jobRef, {
      isPaid: setPaid,
      updatedAt: serverTimestamp()
    });
    
    await loadContracts();
  } catch (err) {
    console.error("Error updating job paid status:", err);
    alert(`Error updating job status: ${getFriendlyError(err)}`);
  }
}

// Make functions globally available
window.editContract = editContract;
window.deleteContract = deleteContract;
window.toggleContractActive = toggleContractActive;
window.toggleJobs = toggleJobs;
window.addJob = addJob;
window.editJob = editJob;
window.deleteJob = deleteJob;
window.toggleJobPaidStatus = toggleJobPaidStatus;
window.hideContractModal = hideContractModal;
window.hideJobModal = hideJobModal;

// Attach event listeners for dynamically rendered content
function attachContractEventListeners() {
  // File input change handlers for contract form
  const builderCoi = $("builderCoi");
  const subAgreement = $("subAgreement");
  const subAgreementType = $("subAgreementType");
  const subAgreementSignOption = $("subAgreementSignOption");
  const subAgreementUploadOption = $("subAgreementUploadOption");
  const signAgreementBtn = $("signAgreementBtn");
  
  // Handle sub-agreement type selection
  if (subAgreementType) {
    subAgreementType.addEventListener("change", (e) => {
      const value = e.target.value;
      if (subAgreementSignOption) subAgreementSignOption.style.display = value === "sign" ? "block" : "none";
      if (subAgreementUploadOption) subAgreementUploadOption.style.display = value === "upload" ? "block" : "none";
    });
  }
  
  // Handle "Go to Sign Agreement" button
  if (signAgreementBtn) {
    signAgreementBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const builderName = $("builderName")?.value?.trim();
      if (builderName) {
        // Store builder name in sessionStorage to pre-fill on agreement page
        sessionStorage.setItem("pendingBuilderName", builderName);
      }
      window.location.href = "../agreement.html";
    });
  }
  
  if (builderCoi) {
    builderCoi.addEventListener("change", (e) => {
      const status = $("builderCoiStatus");
      if (status) status.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
  
  if (subAgreement) {
    subAgreement.addEventListener("change", (e) => {
      const status = $("subAgreementStatus");
      if (status) status.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
  
  // File input change handlers for job form
  const jobProjectCoi = $("jobProjectCoi");
  if (jobProjectCoi) {
    jobProjectCoi.addEventListener("change", (e) => {
      const status = $("jobProjectCoiStatus");
      if (status) status.textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name}` : "";
    });
  }
}

// Initialize
function init() {
  // Initialize tabs
  initTabs();
  
  // Contract form event listeners
  const addContractBtn = $("addContractBtn");
  if (addContractBtn) addContractBtn.addEventListener("click", () => showContractModal());
  
  const cancelContractBtn = $("cancelContractBtn");
  if (cancelContractBtn) cancelContractBtn.addEventListener("click", hideContractModal);
  
  const contractForm = $("contractForm");
  if (contractForm) contractForm.addEventListener("submit", saveContract);
  
  // Job form event listeners
  const jobForm = $("jobForm");
  if (jobForm) jobForm.addEventListener("submit", saveJobFromForm);
  
  // Close modals when clicking outside
  const contractModal = $("contractModal");
  if (contractModal) {
    contractModal.addEventListener("click", (e) => {
      if (e.target === contractModal) {
        hideContractModal();
      }
    });
  }
  
  const jobModal = $("jobModal");
  if (jobModal) {
    jobModal.addEventListener("click", (e) => {
      if (e.target === jobModal) {
        hideJobModal();
      }
    });
  }
  
  // Close modals with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (contractModal && contractModal.style.display === "flex") {
        hideContractModal();
      }
      if (jobModal && jobModal.style.display === "flex") {
        hideJobModal();
      }
    }
  });
  
  // Attach initial event listeners
  attachContractEventListeners();
  
  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUid = user.uid;
      await loadContracts();
      
      // Load prequalification data if on prequal tab
      if (typeof window.loadPrequalStatus === 'function' && typeof window.updatePrequalUI === 'function') {
        const prequalData = await window.loadPrequalStatus(user.uid);
        window.updatePrequalUI(prequalData);
        
        // Initialize Business License and Workers Comp uploads
        if (typeof window.initBusinessLicenseUpload === 'function') {
          window.initBusinessLicenseUpload(user);
        }
        if (typeof window.initWorkersCompUpload === 'function') {
          window.initWorkersCompUpload(user);
        }
      }
    } else {
      currentUid = null;
      contracts = [];
      const activeList = $("activeContractsList");
      const inactiveList = $("inactiveContractsList");
      if (activeList) activeList.innerHTML = "";
      if (inactiveList) inactiveList.innerHTML = "";
    }
  });
}

// Make prequal functions available globally if needed
if (typeof window !== 'undefined') {
  // These will be available from scripts.js
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

