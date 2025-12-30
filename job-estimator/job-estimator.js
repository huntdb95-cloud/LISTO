// job-estimator.js
// Job Cost Estimator - Create and manage job cost estimates

import { auth, db } from "../config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUid = null;
let builders = [];
let jobs = [];
let currentEstimateId = null;
let currentBuilderId = null;
let currentJobId = null;
let isQuickEstimateMode = false;
let authInitialized = false;

// Initialize - wait for auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    authInitialized = true;
    await loadBuilders();
    setupEventListeners();
    // Initialize save button state
    updateSaveButtonForMode();
  } else {
    authInitialized = true;
    window.location.href = "../login/login.html";
  }
});

// Load builders
async function loadBuilders() {
  if (!currentUid) return;
  
  const builderSelect = $("builderSelect");
  if (!builderSelect) return;
  
  // Show loading state
  builderSelect.innerHTML = '<option value="">Loading builders...</option>';
  builderSelect.disabled = true;
  
  try {
    const buildersCol = collection(db, "users", currentUid, "builders");
    const buildersSnap = await getDocs(query(buildersCol, orderBy("name")));
    
    builders = buildersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    builderSelect.innerHTML = '<option value="">-- Select Builder --</option>';
    builderSelect.disabled = false;
    
    if (builders.length === 0) {
      const emptyState = $("emptyState");
      if (emptyState) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `
          <p>No builders found.</p>
          <p style="margin-top: 12px;">
            <a href="../contracts/contracts.html" class="btn primary">Create a Builder & Job</a>
          </p>
        `;
      }
      
      // Add disabled option to show message
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "-- No builders found --";
      option.disabled = true;
      builderSelect.appendChild(option);
      
      const helpOption = document.createElement("option");
      helpOption.value = "";
      helpOption.textContent = "Add builders on Contracts & Jobs page";
      helpOption.disabled = true;
      builderSelect.appendChild(helpOption);
      return;
    }
    
    const emptyState = $("emptyState");
    if (emptyState) emptyState.style.display = "none";
    
    builders.forEach(builder => {
      const option = document.createElement("option");
      option.value = builder.id;
      option.textContent = builder.name || "Unnamed Builder";
      builderSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading builders:", err);
    builderSelect.innerHTML = '<option value="">Error loading builders</option>';
    builderSelect.disabled = false;
    showMessage("Error loading builders. Please refresh.", true);
  }
}

// Load jobs for selected builder
async function loadJobs(builderId) {
  if (!currentUid || !builderId) return;
  
  const jobSelect = $("jobSelect");
  if (!jobSelect) return;
  
  // Show loading state
  jobSelect.innerHTML = '<option value="">Loading jobs...</option>';
  jobSelect.disabled = true;
  
  try {
    jobs = [];
    const builder = builders.find(b => b.id === builderId);
    if (!builder) {
      jobSelect.innerHTML = '<option value="">-- Select Builder First --</option>';
      jobSelect.disabled = true;
      return;
    }
    
    // Load jobs directly under builder (new structure)
    const jobsCol = collection(db, "users", currentUid, "builders", builderId, "jobs");
    const jobsSnap = await getDocs(query(jobsCol, orderBy("jobName")));
    
    jobsSnap.docs.forEach(jobDoc => {
      jobs.push({
        id: jobDoc.id,
        builderId: builderId,
        ...jobDoc.data()
      });
    });
    
    const emptyState = $("emptyState");
    
    jobSelect.innerHTML = '<option value="">-- Select Job --</option>';
    jobSelect.disabled = false;
    
    if (jobs.length === 0) {
      if (emptyState) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `
          <p>No jobs found for this builder.</p>
          <p style="margin-top: 12px;">
            <a href="../contracts/contracts.html" class="btn primary">Create a Job</a>
          </p>
        `;
      }
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "-- No jobs found for this builder --";
      option.disabled = true;
      jobSelect.appendChild(option);
      return;
    }
    
    if (emptyState) emptyState.style.display = "none";
    
    jobs.forEach(job => {
      const option = document.createElement("option");
      option.value = job.id;
      option.textContent = job.jobName || "Unnamed Job";
      jobSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading jobs:", err);
    jobSelect.innerHTML = '<option value="">Error loading jobs</option>';
    jobSelect.disabled = false;
    showMessage("Error loading jobs. Please refresh.", true);
  }
}

// Setup event listeners
function setupEventListeners() {
  const builderSelect = $("builderSelect");
  const jobSelect = $("jobSelect");
  const saveBtn = $("saveBtn");
  const saveAsCopyBtn = $("saveAsCopyBtn");
  const newEstimateBtn = $("newEstimateBtn");
  const taxEnabled = $("taxEnabled");
  
  if (builderSelect) {
    builderSelect.addEventListener("change", async (e) => {
      // If switching from quick estimate to linked, exit quick mode
      if (isQuickEstimateMode) {
        exitQuickEstimateMode();
      }
      
      const builderId = e.target.value;
      currentBuilderId = builderId;
      currentJobId = null;
      currentEstimateId = null;
      
      if (builderId) {
        await loadJobs(builderId);
        $("estimateCard").style.display = "none";
        $("estimatesListCard").style.display = "none";
        $("goToJobContainer").style.display = "none";
        $("goToJobBtnFromActions").style.display = "none";
      } else {
        jobSelect.innerHTML = '<option value="">-- Select Builder First --</option>';
        jobSelect.disabled = true;
        $("estimateCard").style.display = "none";
        $("estimatesListCard").style.display = "none";
        $("goToJobContainer").style.display = "none";
        $("goToJobBtnFromActions").style.display = "none";
      }
    });
  }
  
  if (jobSelect) {
    jobSelect.addEventListener("change", async (e) => {
      // If switching from quick estimate to linked, exit quick mode
      if (isQuickEstimateMode) {
        exitQuickEstimateMode();
      }
      
      const jobId = e.target.value;
      currentJobId = jobId;
      currentEstimateId = null;
      
      if (jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
          // Set default estimate name
          const today = new Date();
          const dateStr = today.toLocaleDateString();
          $("estimateName").value = `Estimate – ${job.jobName} – ${dateStr}`;
          
          $("estimateCard").style.display = "block";
          
          // Update "Go to Job" button
          updateGoToJobButton(jobId);
          
          await loadEstimatesForJob(jobId);
          
          // Try to load the most recent estimate for this job
          await loadLatestEstimateForJob(jobId);
        }
      } else {
        $("estimateCard").style.display = "none";
        $("estimatesListCard").style.display = "none";
        $("goToJobContainer").style.display = "none";
        $("goToJobBtnFromActions").style.display = "none";
      }
    });
  }
  
  // Quick Estimate mode handlers
  const startQuickEstimateBtn = $("startQuickEstimateBtn");
  const exitQuickEstimateBtn = $("exitQuickEstimateBtn");
  
  if (startQuickEstimateBtn) {
    startQuickEstimateBtn.addEventListener("click", () => {
      enterQuickEstimateMode();
    });
  }
  
  if (exitQuickEstimateBtn) {
    exitQuickEstimateBtn.addEventListener("click", () => {
      exitQuickEstimateMode();
    });
  }
  
  // Setup "Go to Job" button
  const goToJobBtn = $("goToJobBtn");
  const goToJobBtnFromActions = $("goToJobBtnFromActions");
  if (goToJobBtn) {
    goToJobBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentBuilderId && currentJobId) {
        window.open(`../contracts/contracts.html?builder=${currentBuilderId}&job=${currentJobId}`, "_blank");
      }
    });
  }
  if (goToJobBtnFromActions) {
    goToJobBtnFromActions.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentBuilderId && currentJobId) {
        window.open(`../contracts/contracts.html?builder=${currentBuilderId}&job=${currentJobId}`, "_blank");
      }
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener("click", saveEstimate);
  }
  
  if (saveAsCopyBtn) {
    saveAsCopyBtn.addEventListener("click", () => saveEstimate(true));
  }
  
  if (newEstimateBtn) {
    newEstimateBtn.addEventListener("click", newEstimate);
  }
  
  if (taxEnabled) {
    taxEnabled.addEventListener("change", (e) => {
      const taxPct = $("taxPct");
      const taxLine = $("taxLine");
      if (taxPct) taxPct.disabled = !e.target.checked;
      if (taxLine) taxLine.style.display = e.target.checked ? "block" : "none";
      calculateTotals();
    });
  }
  
  // Add input listeners for calculations
  setupCalculationListeners();
}

// Setup calculation listeners
function setupCalculationListeners() {
  // Labor table
  const laborBody = $("laborBody");
  if (laborBody) {
    laborBody.addEventListener("input", (e) => {
      if (e.target.classList.contains("row-hours") || e.target.classList.contains("row-rate")) {
        calculateRowTotal(e.target.closest("tr"), "labor");
      }
    });
  }
  
  // Materials table
  const materialsBody = $("materialsBody");
  if (materialsBody) {
    materialsBody.addEventListener("input", (e) => {
      if (e.target.classList.contains("row-qty") || e.target.classList.contains("row-unit-cost")) {
        calculateRowTotal(e.target.closest("tr"), "materials");
      }
    });
  }
  
  // Subcontractors table
  const subcontractorsBody = $("subcontractorsBody");
  if (subcontractorsBody) {
    subcontractorsBody.addEventListener("input", (e) => {
      if (e.target.classList.contains("row-amount")) {
        calculateRowTotal(e.target.closest("tr"), "subcontractors");
      }
    });
  }
  
  // Other table
  const otherBody = $("otherBody");
  if (otherBody) {
    otherBody.addEventListener("input", (e) => {
      if (e.target.classList.contains("row-amount")) {
        calculateRowTotal(e.target.closest("tr"), "other");
      }
    });
  }
  
  // Summary inputs
  const overheadPct = $("overheadPct");
  const profitPct = $("profitPct");
  const taxPct = $("taxPct");
  
  if (overheadPct) overheadPct.addEventListener("input", calculateTotals);
  if (profitPct) profitPct.addEventListener("input", calculateTotals);
  if (taxPct) taxPct.addEventListener("input", calculateTotals);
}

// Calculate row total
function calculateRowTotal(row, category) {
  const subtotalCell = row.querySelector(".row-subtotal");
  if (!subtotalCell) return;
  
  let subtotal = 0;
  
  if (category === "labor") {
    const hours = parseFloat(row.querySelector(".row-hours")?.value || 0);
    const rate = parseFloat(row.querySelector(".row-rate")?.value || 0);
    subtotal = hours * rate;
  } else if (category === "materials") {
    const qty = parseFloat(row.querySelector(".row-qty")?.value || 0);
    const unitCost = parseFloat(row.querySelector(".row-unit-cost")?.value || 0);
    subtotal = qty * unitCost;
  } else if (category === "subcontractors" || category === "other") {
    subtotal = parseFloat(row.querySelector(".row-amount")?.value || 0);
  }
  
  subtotalCell.textContent = formatCurrency(subtotal);
  calculateTotals();
}

// Calculate all totals
function calculateTotals() {
  // Category totals
  const laborTotal = calculateCategoryTotal("labor");
  const materialsTotal = calculateCategoryTotal("materials");
  const subcontractorsTotal = calculateCategoryTotal("subcontractors");
  const otherTotal = calculateCategoryTotal("other");
  
  $("laborTotal").textContent = formatCurrency(laborTotal);
  $("materialsTotal").textContent = formatCurrency(materialsTotal);
  $("subcontractorsTotal").textContent = formatCurrency(subcontractorsTotal);
  $("otherTotal").textContent = formatCurrency(otherTotal);
  
  // Subtotal
  const subtotal = laborTotal + materialsTotal + subcontractorsTotal + otherTotal;
  $("summarySubtotal").textContent = formatCurrency(subtotal);
  
  // Overhead
  const overheadPct = parseFloat($("overheadPct")?.value || 0);
  const overheadAmount = subtotal * (overheadPct / 100);
  $("overheadAmount").textContent = formatCurrency(overheadAmount);
  
  // Profit (on subtotal + overhead)
  const profitPct = parseFloat($("profitPct")?.value || 0);
  const profitBase = subtotal + overheadAmount;
  const profitAmount = profitBase * (profitPct / 100);
  $("profitAmount").textContent = formatCurrency(profitAmount);
  
  // Tax (if enabled)
  const taxEnabled = $("taxEnabled")?.checked || false;
  let taxAmount = 0;
  if (taxEnabled) {
    const taxPct = parseFloat($("taxPct")?.value || 0);
    const taxBase = subtotal + overheadAmount + profitAmount;
    taxAmount = taxBase * (taxPct / 100);
    $("taxAmount").textContent = formatCurrency(taxAmount);
  }
  
  // Grand total
  const grandTotal = subtotal + overheadAmount + profitAmount + taxAmount;
  $("grandTotal").textContent = formatCurrency(grandTotal);
}

// Calculate category total
function calculateCategoryTotal(category) {
  const body = $(`${category}Body`);
  if (!body) return 0;
  
  let total = 0;
  const rows = body.querySelectorAll("tr");
  
  rows.forEach(row => {
    const subtotalText = row.querySelector(".row-subtotal")?.textContent || "$0.00";
    const subtotal = parseFloat(subtotalText.replace(/[^0-9.-]/g, "")) || 0;
    total += subtotal;
  });
  
  return total;
}

// Add row
window.addRow = function(category) {
  const body = $(`${category}Body`);
  if (!body) return;
  
  const row = document.createElement("tr");
  
  if (category === "labor") {
    row.innerHTML = `
      <td><input type="text" placeholder="Description" class="row-desc" /></td>
      <td class="num"><input type="number" step="0.01" placeholder="0" class="row-hours" /></td>
      <td class="num"><input type="number" step="0.01" placeholder="0.00" class="row-rate" /></td>
      <td class="num row-subtotal">$0.00</td>
      <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
    `;
  } else if (category === "materials") {
    row.innerHTML = `
      <td><input type="text" placeholder="Description" class="row-desc" /></td>
      <td class="num"><input type="number" step="0.01" placeholder="0" class="row-qty" /></td>
      <td class="num"><input type="number" step="0.01" placeholder="0.00" class="row-unit-cost" /></td>
      <td class="num row-subtotal">$0.00</td>
      <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
    `;
  } else {
    row.innerHTML = `
      <td><input type="text" placeholder="Description" class="row-desc" /></td>
      <td class="num"><input type="number" step="0.01" placeholder="0.00" class="row-amount" /></td>
      <td class="num row-subtotal">$0.00</td>
      <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
    `;
  }
  
  body.appendChild(row);
  calculateTotals();
};

// Remove row
window.removeRow = function(btn, category) {
  const row = btn.closest("tr");
  if (row) {
    row.remove();
    calculateTotals();
  }
};

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount || 0);
}

// Get estimate data
function getEstimateData() {
  // In Quick Estimate mode, return null (cannot save)
  if (isQuickEstimateMode) {
    return null;
  }
  
  const job = jobs.find(j => j.id === currentJobId);
  if (!job) return null;
  
  const categories = {
    labor: getCategoryData("labor"),
    materials: getCategoryData("materials"),
    subcontractors: getCategoryData("subcontractors"),
    other: getCategoryData("other")
  };
  
  return {
    builderId: currentBuilderId,
    jobId: currentJobId,
    jobName: job.jobName || "Unknown Job",
    estimateName: $("estimateName")?.value.trim() || "Untitled Estimate",
    notes: $("estimateNotes")?.value.trim() || null,
    categories,
    overheadPct: parseFloat($("overheadPct")?.value || 0),
    profitPct: parseFloat($("profitPct")?.value || 0),
    taxPct: $("taxEnabled")?.checked ? parseFloat($("taxPct")?.value || 0) : 0,
    totals: {
      labor: calculateCategoryTotal("labor"),
      materials: calculateCategoryTotal("materials"),
      subcontractors: calculateCategoryTotal("subcontractors"),
      other: calculateCategoryTotal("other"),
      subtotal: parseFloat($("summarySubtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0),
      overhead: parseFloat($("overheadAmount")?.textContent.replace(/[^0-9.-]/g, "") || 0),
      profit: parseFloat($("profitAmount")?.textContent.replace(/[^0-9.-]/g, "") || 0),
      tax: parseFloat($("taxAmount")?.textContent.replace(/[^0-9.-]/g, "") || 0),
      grandTotal: parseFloat($("grandTotal")?.textContent.replace(/[^0-9.-]/g, "") || 0)
    }
  };
}

// Get category data
function getCategoryData(category) {
  const body = $(`${category}Body`);
  if (!body) return [];
  
  const rows = body.querySelectorAll("tr");
  const items = [];
  
  rows.forEach(row => {
    const desc = row.querySelector(".row-desc")?.value.trim();
    if (!desc) return; // Skip empty rows
    
    if (category === "labor") {
      const hours = parseFloat(row.querySelector(".row-hours")?.value || 0);
      const rate = parseFloat(row.querySelector(".row-rate")?.value || 0);
      items.push({ description: desc, hours, rate, subtotal: hours * rate });
    } else if (category === "materials") {
      const qty = parseFloat(row.querySelector(".row-qty")?.value || 0);
      const unitCost = parseFloat(row.querySelector(".row-unit-cost")?.value || 0);
      items.push({ description: desc, qty, unitCost, subtotal: qty * unitCost });
    } else {
      const amount = parseFloat(row.querySelector(".row-amount")?.value || 0);
      items.push({ description: desc, amount, subtotal: amount });
    }
  });
  
  return items;
}

// Enter Quick Estimate mode
function enterQuickEstimateMode() {
  isQuickEstimateMode = true;
  currentBuilderId = null;
  currentJobId = null;
  currentEstimateId = null;
  
  // Clear builder/job selections
  const builderSelect = $("builderSelect");
  const jobSelect = $("jobSelect");
  if (builderSelect) builderSelect.value = "";
  if (jobSelect) {
    jobSelect.value = "";
    jobSelect.disabled = true;
    jobSelect.innerHTML = '<option value="">-- Select Builder First --</option>';
  }
  
  // Disable builder/job selects
  if (builderSelect) builderSelect.disabled = true;
  
  // Show quick estimate active state
  const quickEstimateActive = $("quickEstimateActive");
  const startQuickEstimateBtn = $("startQuickEstimateBtn");
  if (quickEstimateActive) quickEstimateActive.style.display = "block";
  if (startQuickEstimateBtn) startQuickEstimateBtn.style.display = "none";
  
  // Show estimate card
  $("estimateCard").style.display = "block";
  
  // Set default estimate name
  const today = new Date();
  const dateStr = today.toLocaleDateString();
  $("estimateName").value = `Quick Estimate – ${dateStr}`;
  
  // Hide job-related UI
  $("goToJobContainer").style.display = "none";
  $("goToJobBtnFromActions").style.display = "none";
  $("estimatesListCard").style.display = "none";
  
  // Update save button
  updateSaveButtonForMode();
  
  // Clear estimate form
  newEstimate();
  
  showMessage("Quick Estimate mode activated. You can calculate estimates without linking to a job.", false);
}

// Exit Quick Estimate mode
function exitQuickEstimateMode() {
  isQuickEstimateMode = false;
  
  // Re-enable builder/job selects
  const builderSelect = $("builderSelect");
  const jobSelect = $("jobSelect");
  if (builderSelect) builderSelect.disabled = false;
  if (jobSelect) {
    jobSelect.disabled = true;
    jobSelect.innerHTML = '<option value="">-- Select Builder First --</option>';
  }
  
  // Hide quick estimate active state
  const quickEstimateActive = $("quickEstimateActive");
  const startQuickEstimateBtn = $("startQuickEstimateBtn");
  if (quickEstimateActive) quickEstimateActive.style.display = "none";
  if (startQuickEstimateBtn) startQuickEstimateBtn.style.display = "block";
  
  // Clear estimate form data to prevent contamination
  currentEstimateId = null;
  newEstimate();
  
  // Hide estimate card until builder/job selected
  $("estimateCard").style.display = "none";
  $("estimatesListCard").style.display = "none";
  $("goToJobContainer").style.display = "none";
  $("goToJobBtnFromActions").style.display = "none";
  
  // Update save button
  updateSaveButtonForMode();
  
  showMessage("Exited Quick Estimate mode. Select a builder and job to create a linked estimate.", false);
}

// Update save button based on mode
function updateSaveButtonForMode() {
  const saveBtn = $("saveBtn");
  const saveAsCopyBtn = $("saveAsCopyBtn");
  
  if (isQuickEstimateMode) {
    // In quick estimate mode, disable save buttons
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Save Estimate (Linked Mode Only)";
      saveBtn.title = "Quick estimates cannot be saved. Select a builder and job to save.";
    }
    if (saveAsCopyBtn) {
      saveAsCopyBtn.disabled = true;
      saveAsCopyBtn.textContent = "Save as Copy (Linked Mode Only)";
      saveAsCopyBtn.title = "Quick estimates cannot be saved. Select a builder and job to save.";
    }
  } else {
    // In linked mode, enable save buttons
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Estimate";
      saveBtn.title = "";
    }
    if (saveAsCopyBtn) {
      saveAsCopyBtn.disabled = false;
      saveAsCopyBtn.textContent = "Save as Copy";
      saveAsCopyBtn.title = "";
    }
  }
}

// Save estimate
async function saveEstimate(isCopy = false) {
  // Wait for auth to initialize
  if (!authInitialized) {
    showMessage("Please wait for authentication to complete.", true);
    return;
  }
  
  // Check if in Quick Estimate mode
  if (isQuickEstimateMode) {
    showMessage("Cannot save in Quick Estimate mode. Please select a builder and job, or exit Quick Estimate mode.", true);
    return;
  }
  
  // Verify auth state
  if (!currentUid) {
    const user = auth.currentUser;
    if (!user) {
      showMessage("Please sign in to save estimates.", true);
      window.location.href = "../login/login.html";
      return;
    }
    currentUid = user.uid;
  }
  
  if (!currentBuilderId || !currentJobId) {
    showMessage("Please select a builder and job first.", true);
    return;
  }
  
  const estimateData = getEstimateData();
  if (!estimateData) {
    showMessage("Error getting estimate data.", true);
    return;
  }
  
  if (!estimateData.estimateName || estimateData.estimateName.trim() === "") {
    showMessage("Estimate name is required.", true);
    return;
  }
  
  try {
    // Store estimate under job: users/{uid}/builders/{builderId}/jobs/{jobId}/estimates/{estimateId}
    const estimatesCol = collection(db, "users", currentUid, "builders", currentBuilderId, "jobs", currentJobId, "estimates");
    
    if (isCopy || !currentEstimateId) {
      // Create new estimate
      const estimateToSave = {
        ...estimateData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const newDocRef = await addDoc(estimatesCol, estimateToSave);
      showMessage("Estimate saved successfully!", false);
      currentEstimateId = isCopy ? null : newDocRef.id;
      await loadEstimatesForJob(currentJobId);
    } else {
      // Update existing estimate
      const estimateRef = doc(db, "users", currentUid, "builders", currentBuilderId, "jobs", currentJobId, "estimates", currentEstimateId);
      const estimateToSave = {
        ...estimateData,
        updatedAt: serverTimestamp()
      };
      // Don't overwrite createdAt
      delete estimateToSave.createdAt;
      await updateDoc(estimateRef, estimateToSave);
      showMessage("Estimate updated successfully!", false);
      await loadEstimatesForJob(currentJobId);
    }
  } catch (err) {
    console.error("Error saving estimate:", err);
    console.error("Error code:", err?.code);
    console.error("Error message:", err?.message);
    
    let errorMsg = "Error saving estimate. Please try again.";
    if (err?.code === "permission-denied") {
      // Check if it's actually an auth issue
      const user = auth.currentUser;
      if (!user || user.uid !== currentUid) {
        errorMsg = "Authentication expired. Please sign out and sign back in.";
      } else {
        errorMsg = "Permission denied. Please check that you have access to this builder and job.";
      }
    } else if (err?.message) {
      errorMsg = err.message;
    }
    showMessage(errorMsg, true);
  }
}

// Load estimates for job
async function loadEstimatesForJob(jobId) {
  // Wait for auth to initialize
  if (!authInitialized) {
    console.warn("Cannot load estimates: auth not initialized");
    return;
  }
  
  // Verify auth state
  if (!currentUid) {
    const user = auth.currentUser;
    if (!user) {
      console.warn("Cannot load estimates: not authenticated");
      return;
    }
    currentUid = user.uid;
  }
  
  if (!jobId || !currentBuilderId) {
    console.warn("Cannot load estimates: missing jobId or builderId");
    return;
  }
  
  try {
    // Load estimates from job subcollection
    const estimatesCol = collection(db, "users", currentUid, "builders", currentBuilderId, "jobs", jobId, "estimates");
    const snap = await getDocs(query(estimatesCol, orderBy("updatedAt", "desc")));
    
    let estimates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Fallback sort by updatedAt in memory if orderBy fails
    if (estimates.length > 0 && !estimates[0].updatedAt) {
      estimates.sort((a, b) => {
        const getTime = (est) => {
          if (!est.updatedAt) return 0;
          if (est.updatedAt.toDate) return est.updatedAt.toDate().getTime();
          if (est.updatedAt.seconds) return est.updatedAt.seconds * 1000;
          if (est.updatedAt instanceof Date) return est.updatedAt.getTime();
          return new Date(est.updatedAt).getTime() || 0;
        };
        return getTime(b) - getTime(a); // Descending
      });
    }
    
    const listContainer = $("estimatesList");
    if (!listContainer) return;
    
    if (estimates.length === 0) {
      listContainer.innerHTML = '<div class="muted">No saved estimates for this job yet.</div>';
      $("estimatesListCard").style.display = "block"; // Show card even when empty
      return;
    }
    
    $("estimatesListCard").style.display = "block";
    
    listContainer.innerHTML = estimates.map(est => {
      let updatedAt;
      if (est.updatedAt) {
        if (est.updatedAt.toDate) {
          updatedAt = est.updatedAt.toDate();
        } else if (est.updatedAt instanceof Date) {
          updatedAt = est.updatedAt;
        } else {
          updatedAt = new Date(est.updatedAt);
        }
      } else {
        updatedAt = new Date();
      }
      
      const dateStr = updatedAt.toLocaleDateString();
      const timeStr = updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const grandTotal = est.totals?.grandTotal || 0;
      const safeName = (est.estimateName || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      
      return `
        <div class="estimate-item" onclick="loadEstimate('${est.id}')">
          <div class="estimate-item-info">
            <div class="estimate-item-name">${safeName || "Untitled Estimate"}</div>
            <div class="estimate-item-meta">Updated: ${dateStr} ${timeStr} • Total: ${formatCurrency(grandTotal)}</div>
          </div>
          <div class="estimate-item-actions">
            <button type="button" class="btn small ghost" onclick="event.stopPropagation(); loadEstimate('${est.id}')">Load</button>
            <button type="button" class="btn small ghost btn-danger" onclick="event.stopPropagation(); deleteEstimate('${est.id}', '${safeName}')">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading estimates:", err);
    // If orderBy fails (no index), try without it
    if (err.code === 'failed-precondition') {
      try {
        const estimatesCol = collection(db, "users", currentUid, "builders", currentBuilderId, "jobs", jobId, "estimates");
        const snap = await getDocs(estimatesCol);
        let estimates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        estimates.sort((a, b) => {
          const getTime = (est) => {
            if (!est.updatedAt) return 0;
            if (est.updatedAt.toDate) return est.updatedAt.toDate().getTime();
            if (est.updatedAt.seconds) return est.updatedAt.seconds * 1000;
            if (est.updatedAt instanceof Date) return est.updatedAt.getTime();
            return new Date(est.updatedAt).getTime() || 0;
          };
          return getTime(b) - getTime(a);
        });
        
        const listContainer = $("estimatesList");
        if (!listContainer) return;
        
        if (estimates.length === 0) {
          listContainer.innerHTML = '<div class="muted">No saved estimates for this job yet.</div>';
          $("estimatesListCard").style.display = "block"; // Show card even when empty
          return;
        }
        
        $("estimatesListCard").style.display = "block";
        renderEstimatesList(estimates, listContainer);
      } catch (err2) {
        console.error("Error loading estimates (fallback):", err2);
        console.error("Error code:", err2?.code);
        console.error("Error message:", err2?.message);
        
        const listContainer = $("estimatesList");
        if (listContainer) {
          if (err2?.code === "permission-denied") {
            const user = auth.currentUser;
            if (!user || user.uid !== currentUid) {
              listContainer.innerHTML = '<div class="form-error">Authentication expired. Please refresh the page.</div>';
            } else {
              listContainer.innerHTML = '<div class="form-error">Permission denied. Please check your access.</div>';
            }
          } else {
            listContainer.innerHTML = '<div class="form-error">Error loading estimates. Please refresh the page.</div>';
          }
          $("estimatesListCard").style.display = "block";
        }
      }
    } else {
      console.error("Error loading estimates:", err);
      console.error("Error code:", err?.code);
      console.error("Error message:", err?.message);
      
      const listContainer = $("estimatesList");
      if (listContainer) {
        if (err?.code === "permission-denied") {
          const user = auth.currentUser;
          if (!user || user.uid !== currentUid) {
            listContainer.innerHTML = '<div class="form-error">Authentication expired. Please refresh the page.</div>';
          } else {
            listContainer.innerHTML = '<div class="form-error">Permission denied. Please check your access.</div>';
          }
        } else {
          listContainer.innerHTML = '<div class="form-error">Error loading estimates. Please refresh the page.</div>';
        }
        $("estimatesListCard").style.display = "block";
      }
    }
  }
}

// Render estimates list
function renderEstimatesList(estimates, container) {
  container.innerHTML = estimates.map(est => {
    let updatedAt;
    if (est.updatedAt) {
      if (est.updatedAt.toDate) {
        updatedAt = est.updatedAt.toDate();
      } else if (est.updatedAt instanceof Date) {
        updatedAt = est.updatedAt;
      } else {
        updatedAt = new Date(est.updatedAt);
      }
    } else {
      updatedAt = new Date();
    }
    
    const dateStr = updatedAt.toLocaleDateString();
    const timeStr = updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const grandTotal = est.totals?.grandTotal || 0;
    const safeName = (est.estimateName || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    
    return `
      <div class="estimate-item" onclick="loadEstimate('${est.id}')">
        <div class="estimate-item-info">
          <div class="estimate-item-name">${safeName || "Untitled Estimate"}</div>
          <div class="estimate-item-meta">Updated: ${dateStr} ${timeStr} • Total: ${formatCurrency(grandTotal)}</div>
        </div>
        <div class="estimate-item-actions">
          <button type="button" class="btn small ghost" onclick="event.stopPropagation(); loadEstimate('${est.id}')">Load</button>
          <button type="button" class="btn small ghost btn-danger" onclick="event.stopPropagation(); deleteEstimate('${est.id}', '${safeName}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

// Load latest estimate for job (auto-load on job selection)
async function loadLatestEstimateForJob(jobId) {
  // Wait for auth to initialize
  if (!authInitialized || !currentUid) {
    return;
  }
  
  // Verify auth state
  if (!currentUid) {
    const user = auth.currentUser;
    if (!user) return;
    currentUid = user.uid;
  }
  
  if (!jobId || !currentBuilderId) return;
  
  try {
    const estimatesCol = collection(db, "users", currentUid, "builders", currentBuilderId, "jobs", jobId, "estimates");
    const snap = await getDocs(query(estimatesCol, orderBy("updatedAt", "desc")));
    
    if (!snap.empty) {
      const latestEstimate = snap.docs[0];
      await loadEstimateData(latestEstimate.id, latestEstimate.data());
      currentEstimateId = latestEstimate.id;
    }
  } catch (err) {
    // If orderBy fails, try without it
    if (err.code === 'failed-precondition') {
      try {
        const estimatesCol = collection(db, "users", currentUid, "builders", currentBuilderId, "jobs", jobId, "estimates");
        const snap = await getDocs(estimatesCol);
        if (!snap.empty) {
          let estimates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          estimates.sort((a, b) => {
            const getTime = (est) => {
              if (!est.updatedAt) return 0;
              if (est.updatedAt.toDate) return est.updatedAt.toDate().getTime();
              if (est.updatedAt.seconds) return est.updatedAt.seconds * 1000;
              if (est.updatedAt instanceof Date) return est.updatedAt.getTime();
              return new Date(est.updatedAt).getTime() || 0;
            };
            return getTime(b) - getTime(a);
          });
          if (estimates.length > 0) {
            const latestEstimate = snap.docs.find(d => d.id === estimates[0].id);
            if (latestEstimate) {
              await loadEstimateData(latestEstimate.id, latestEstimate.data());
              currentEstimateId = latestEstimate.id;
            }
          }
        }
      } catch (err2) {
        // Silently fail - user can manually load estimates
        console.log("Could not auto-load latest estimate:", err2);
      }
    }
  }
}

// Load estimate data into form
async function loadEstimateData(estimateId, estimate) {
  if (!estimate) return;
  
  currentEstimateId = estimateId;
  
  // Set basic fields
  $("estimateName").value = estimate.estimateName || "";
  $("estimateNotes").value = estimate.notes || "";
  $("overheadPct").value = estimate.overheadPct || 10;
  $("profitPct").value = estimate.profitPct || 15;
  $("taxPct").value = estimate.taxPct || 0;
  $("taxEnabled").checked = (estimate.taxPct || 0) > 0;
  $("taxPct").disabled = !$("taxEnabled").checked;
  $("taxLine").style.display = $("taxEnabled").checked ? "block" : "none";
  
  // Load categories
  loadCategory("labor", estimate.categories?.labor || []);
  loadCategory("materials", estimate.categories?.materials || []);
  loadCategory("subcontractors", estimate.categories?.subcontractors || []);
  loadCategory("other", estimate.categories?.other || []);
  
  calculateTotals();
}

// Load estimate
window.loadEstimate = async function(estimateId) {
  // Wait for auth to initialize
  if (!authInitialized) {
    showMessage("Please wait for authentication to complete.", true);
    return;
  }
  
  // Verify auth state
  if (!currentUid) {
    const user = auth.currentUser;
    if (!user) {
      showMessage("Please sign in to load estimates.", true);
      window.location.href = "../login/login.html";
      return;
    }
    currentUid = user.uid;
  }
  
  if (!currentBuilderId || !currentJobId) {
    showMessage("Please select a builder and job first.", true);
    return;
  }
  
  if (!estimateId) {
    showMessage("Invalid estimate ID.", true);
    return;
  }
  
  try {
    const estimateRef = doc(db, "users", currentUid, "builders", currentBuilderId, "jobs", currentJobId, "estimates", estimateId);
    const snap = await getDoc(estimateRef);
    
    if (!snap.exists()) {
      showMessage("Estimate not found.", true);
      return;
    }
  
    const estimate = snap.data();
    await loadEstimateData(estimateId, estimate);
    showMessage("Estimate loaded.", false);
  } catch (err) {
    console.error("Error loading estimate:", err);
    console.error("Error code:", err?.code);
    console.error("Error message:", err?.message);
    
    let errorMsg = "Error loading estimate.";
    if (err?.code === "permission-denied") {
      const user = auth.currentUser;
      if (!user || user.uid !== currentUid) {
        errorMsg = "Authentication expired. Please refresh the page.";
      } else {
        errorMsg = "Permission denied. Please check your access.";
      }
    } else if (err?.message) {
      errorMsg = err.message;
    }
    showMessage(errorMsg, true);
  }
};

// Load category
function loadCategory(category, items) {
  const body = $(`${category}Body`);
  if (!body) return;
  
  body.innerHTML = "";
  
  if (items.length === 0) {
    // Add one empty row
    addRow(category);
    return;
  }
  
  items.forEach(item => {
    const row = document.createElement("tr");
    
    if (category === "labor") {
      row.innerHTML = `
        <td><input type="text" value="${escapeHtml(item.description || "")}" class="row-desc" /></td>
        <td class="num"><input type="number" step="0.01" value="${item.hours || 0}" class="row-hours" /></td>
        <td class="num"><input type="number" step="0.01" value="${item.rate || 0}" class="row-rate" /></td>
        <td class="num row-subtotal">${formatCurrency(item.subtotal || 0)}</td>
        <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
      `;
    } else if (category === "materials") {
      row.innerHTML = `
        <td><input type="text" value="${escapeHtml(item.description || "")}" class="row-desc" /></td>
        <td class="num"><input type="number" step="0.01" value="${item.qty || 0}" class="row-qty" /></td>
        <td class="num"><input type="number" step="0.01" value="${item.unitCost || 0}" class="row-unit-cost" /></td>
        <td class="num row-subtotal">${formatCurrency(item.subtotal || 0)}</td>
        <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
      `;
    } else {
      row.innerHTML = `
        <td><input type="text" value="${escapeHtml(item.description || "")}" class="row-desc" /></td>
        <td class="num"><input type="number" step="0.01" value="${item.amount || 0}" class="row-amount" /></td>
        <td class="num row-subtotal">${formatCurrency(item.subtotal || 0)}</td>
        <td><button type="button" class="btn small ghost" onclick="removeRow(this, '${category}')">Remove</button></td>
      `;
    }
    
    body.appendChild(row);
  });
}

// Delete estimate
window.deleteEstimate = async function(estimateId, estimateName) {
  if (!confirm(`Delete estimate "${estimateName}"? This cannot be undone.`)) {
    return;
  }
  
  // Wait for auth to initialize
  if (!authInitialized) {
    showMessage("Please wait for authentication to complete.", true);
    return;
  }
  
  // Verify auth state
  if (!currentUid) {
    const user = auth.currentUser;
    if (!user) {
      showMessage("Please sign in to delete estimates.", true);
      window.location.href = "../login/login.html";
      return;
    }
    currentUid = user.uid;
  }
  
  if (!currentBuilderId || !currentJobId) {
    showMessage("Please select a builder and job first.", true);
    return;
  }
  
  if (!estimateId) {
    showMessage("Invalid estimate ID.", true);
    return;
  }
  
  try {
    const estimateRef = doc(db, "users", currentUid, "builders", currentBuilderId, "jobs", currentJobId, "estimates", estimateId);
    await deleteDoc(estimateRef);
    showMessage("Estimate deleted.", false);
    await loadEstimatesForJob(currentJobId);
    
    if (currentEstimateId === estimateId) {
      currentEstimateId = null;
      newEstimate();
    }
  } catch (err) {
    console.error("Error deleting estimate:", err);
    console.error("Error code:", err?.code);
    console.error("Error message:", err?.message);
    
    let errorMsg = "Error deleting estimate.";
    if (err?.code === "permission-denied") {
      const user = auth.currentUser;
      if (!user || user.uid !== currentUid) {
        errorMsg = "Authentication expired. Please refresh the page.";
      } else {
        errorMsg = "Permission denied. Please check your access.";
      }
    } else if (err?.message) {
      errorMsg = err.message;
    }
    showMessage(errorMsg, true);
  }
};

// New estimate
function newEstimate() {
  currentEstimateId = null;
  
  if (isQuickEstimateMode) {
    const today = new Date();
    const dateStr = today.toLocaleDateString();
    $("estimateName").value = `Quick Estimate – ${dateStr}`;
  } else {
    const job = jobs.find(j => j.id === currentJobId);
    if (job) {
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      $("estimateName").value = `Estimate – ${job.jobName} – ${dateStr}`;
    }
  }
  
  $("estimateNotes").value = "";
  $("overheadPct").value = 10;
  $("profitPct").value = 15;
  $("taxPct").value = 0;
  $("taxEnabled").checked = false;
  $("taxPct").disabled = true;
  $("taxLine").style.display = "none";
  
  // Clear all categories
  ["labor", "materials", "subcontractors", "other"].forEach(cat => {
    const body = $(`${cat}Body`);
    if (body) {
      body.innerHTML = "";
      addRow(cat);
    }
  });
  
  calculateTotals();
  showMessage("New estimate ready.", false);
}

// Show message
function showMessage(text, isError = false) {
  const msgEl = $("saveMsg");
  if (!msgEl) return;
  
  msgEl.textContent = text;
  msgEl.className = isError ? "form-error" : "muted";
  msgEl.style.display = "block";
  
  if (!isError) {
    setTimeout(() => {
      msgEl.textContent = "";
      msgEl.style.display = "none";
    }, 3000);
  }
}

// Update "Go to Job" button
function updateGoToJobButton(jobId) {
  if (!currentBuilderId || !jobId) return;
  
  const goToJobContainer = $("goToJobContainer");
  const goToJobBtn = $("goToJobBtn");
  const goToJobBtnFromActions = $("goToJobBtnFromActions");
  
  if (goToJobContainer) goToJobContainer.style.display = "block";
  if (goToJobBtnFromActions) goToJobBtnFromActions.style.display = "inline-flex";
  
  // The href is set via event listener, but we can also set it here for accessibility
  if (goToJobBtn) {
    goToJobBtn.href = `../contracts/contracts.html?builder=${currentBuilderId}&job=${jobId}`;
  }
  if (goToJobBtnFromActions) {
    goToJobBtnFromActions.href = `../contracts/contracts.html?builder=${currentBuilderId}&job=${jobId}`;
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

