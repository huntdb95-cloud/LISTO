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
          <button class="btn small" onclick="toggleJobs('${contract.id}')" data-i18n="contracts.${isExpanded ? 'hideJobs' : 'showJobs'}">${isExpanded ? 'Hide Jobs' : 'Show Jobs'} (${jobs.length})</button>
        </div>
        ${isExpanded ? `
          <div id="jobs-${contract.id}">
            ${jobsHtml}
            <button class="btn small primary" onclick="addJob('${contract.id}')" data-i18n="contracts.addJob" style="margin-top: 12px;">Add Job</button>
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
    
    return `
      <div class="job-card" data-job-id="${job.id}">
        <div class="job-header">
          <div>
            <h5 class="job-title">${job.jobName || "—"}</h5>
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

// Show contract form
function showContractForm(contract = null) {
  editingContractId = contract ? contract.id : null;
  const formCard = $("contractFormCard");
  const formTitle = $("contractFormTitle");
  if (!formCard) return;
  
  formCard.style.display = "block";
  if (formTitle) {
    formTitle.textContent = contract ? "Edit Builder Contract" : "Add Builder Contract";
  }
  
  const form = $("contractForm");
  if (form) form.reset();
  
  const contractIdInput = $("contractId");
  if (contractIdInput) contractIdInput.value = contract ? contract.id : "";
  
  const builderName = $("builderName");
  if (builderName) builderName.value = contract?.builderName || "";
  
  const builderCoi = $("builderCoi");
  const subAgreement = $("subAgreement");
  if (builderCoi) builderCoi.value = "";
  if (subAgreement) subAgreement.value = "";
  
  const builderCoiStatus = $("builderCoiStatus");
  const subAgreementStatus = $("subAgreementStatus");
  if (builderCoiStatus) builderCoiStatus.textContent = contract?.builderCoiUrl ? "Current file uploaded" : "";
  if (subAgreementStatus) subAgreementStatus.textContent = contract?.subAgreementUrl ? "Current file uploaded" : "";
  
  clearMessages();
  formCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Hide contract form
function hideContractForm() {
  const formCard = $("contractFormCard");
  if (formCard) formCard.style.display = "none";
  editingContractId = null;
  clearMessages();
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
    const subAgreementFile = $("subAgreement")?.files[0];
    
    if (builderCoiFile) {
      showMsg("Uploading Builder COI...");
      if (existing?.builderCoiPath) await deleteFile(existing.builderCoiUrl);
      const builderCoiUrl = await uploadFile(builderCoiFile, `users/${currentUid}/contracts/${contractId}/builderCoi`);
      const builderCoiPath = `users/${currentUid}/contracts/${contractId}/builderCoi/${Date.now()}_${builderCoiFile.name.replace(/[^\w.\-]+/g, "_")}`;
      contractData.builderCoiUrl = builderCoiUrl;
      contractData.builderCoiPath = builderCoiPath;
    }
    
    if (subAgreementFile) {
      showMsg("Uploading Sub Agreement...");
      if (existing?.subAgreementPath) await deleteFile(existing.subAgreementUrl);
      const subAgreementUrl = await uploadFile(subAgreementFile, `users/${currentUid}/contracts/${contractId}/subAgreement`);
      const subAgreementPath = `users/${currentUid}/contracts/${contractId}/subAgreement/${Date.now()}_${subAgreementFile.name.replace(/[^\w.\-]+/g, "_")}`;
      contractData.subAgreementUrl = subAgreementUrl;
      contractData.subAgreementPath = subAgreementPath;
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
  
  showJobForm(contractId);
}

// Show job form
function showJobForm(contractId, job = null) {
  // Create a modal or inline form for adding/editing jobs
  const jobName = prompt("Job Name:", job?.jobName || "");
  if (jobName === null) return;
  
  const address = prompt("Job Address:", job?.address || "");
  if (address === null) return;
  
  const description = prompt("Description of Work:", job?.description || "");
  if (description === null) return;
  
  // Create file input for project COI
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,.png,.jpg,.jpeg";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
  
  const uploadProjectCoi = confirm("Would you like to upload a Project COI for this job?");
  let projectCoiFile = null;
  
  if (uploadProjectCoi) {
    fileInput.click();
    fileInput.onchange = async (e) => {
      projectCoiFile = e.target.files[0];
      await saveJob(contractId, job?.id || null, jobName, address, description, projectCoiFile);
      document.body.removeChild(fileInput);
    };
    return;
  }
  
  saveJob(contractId, job?.id || null, jobName, address, description, null);
  document.body.removeChild(fileInput);
}

// Save job
async function saveJob(contractId, jobId, jobName, address, description, projectCoiFile) {
  if (!currentUid) return;
  
  try {
    const jobData = {
      jobName: jobName.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
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
    alert(`Error saving job: ${getFriendlyError(err)}`);
  }
}

// Edit job
function editJob(contractId, jobId) {
  loadJobs(contractId).then(jobs => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      showJobForm(contractId, job);
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

// Make functions globally available
window.editContract = editContract;
window.deleteContract = deleteContract;
window.toggleContractActive = toggleContractActive;
window.toggleJobs = toggleJobs;
window.addJob = addJob;
window.editJob = editJob;
window.deleteJob = deleteJob;

// Attach event listeners for dynamically rendered content
function attachContractEventListeners() {
  // File input change handlers
  const builderCoi = $("builderCoi");
  const subAgreement = $("subAgreement");
  
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
}

// Initialize
function init() {
  // Initialize tabs
  initTabs();
  
  // Contract form event listeners
  const addContractBtn = $("addContractBtn");
  if (addContractBtn) addContractBtn.addEventListener("click", () => showContractForm());
  
  const cancelContractBtn = $("cancelContractBtn");
  if (cancelContractBtn) cancelContractBtn.addEventListener("click", hideContractForm);
  
  const contractForm = $("contractForm");
  if (contractForm) contractForm.addEventListener("submit", saveContract);
  
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

