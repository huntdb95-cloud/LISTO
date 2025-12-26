// dashboard.js
// Dashboard page - Display account information

import { auth, db, storage } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getDownloadURL, ref } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);

// Initialize dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadDashboardData(user);
  }
});

// ============================================================================
// NOTE: Facebook embed code has been removed and replaced with Elfsight Social Feed
// The Elfsight widget is loaded directly in dashboard.html with lazy loading
// ============================================================================

// ============================================================================
// DASHBOARD DATA LOADING
// ============================================================================

async function loadDashboardData(user) {
  try {
    // Load profile from Firestore
    const profileRef = doc(db, "users", user.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    // Display name
    const name = profile.name || user.displayName || "—";
    $("dashboardName").textContent = name;

    // Display profile picture or initials
    await displayDashboardAvatar(user, profile);

    // Load reminders
    await loadReminders(user);

  } catch (err) {
    console.error("Error loading dashboard data:", err);
  }
}

async function displayDashboardAvatar(user, profile) {
  const avatarImage = $("dashboardAvatarImage");
  const avatarInitials = $("dashboardAvatarInitials");

  // Get logo URL from profile
  let logoUrl = profile?.logoUrl;

  if (logoUrl) {
    try {
      avatarImage.src = logoUrl;
      avatarImage.style.display = "block";
      avatarInitials.style.display = "none";
    } catch (err) {
      console.warn("Could not load avatar image:", err);
      displayInitials(user, profile);
    }
  } else {
    displayInitials(user, profile);
  }
}

function displayInitials(user, profile) {
  const avatarImage = $("dashboardAvatarImage");
  const avatarInitials = $("dashboardAvatarInitials");

  avatarImage.style.display = "none";
  avatarInitials.style.display = "flex";

  // Generate initials from name, displayName, or email
  const name = profile?.name || user.displayName || "";
  const email = user.email || "";

  let initials = "";
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts[0]) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }
  }

  if (!initials && email) {
    initials = email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "");
  }

  if (!initials) {
    initials = "??";
  }

  avatarInitials.textContent = initials;
}

// Load reminders - grouped into Labor and Jobs
async function loadReminders(user) {
  const container = $("remindersContainer");
  if (!container) return;

  try {
    // Group reminders into Labor and Jobs
    const laborReminders = [];
    const jobReminders = [];

    // LABOR REMINDERS
    // 1. Employees (non-subcontractors) without W9
    const employeesWithoutW9 = await getEmployeesWithoutW9(user.uid);
    employeesWithoutW9.forEach(emp => {
      laborReminders.push({
        text: `${emp.name} - Missing W-9`,
        link: "employees/employees.html"
      });
    });

    // 2. Subcontractors missing documents (W9, COI)
    const subcontractorsMissingDocs = await getSubcontractorsMissingDocs(user.uid);
    subcontractorsMissingDocs.forEach(sub => {
      // Filter out Sub Agreement (that's a job/contract thing, not labor)
      const laborDocs = sub.missingDocs.filter(doc => doc !== "Sub Agreement");
      if (laborDocs.length > 0) {
        laborReminders.push({
          text: `${sub.name} - Missing: ${laborDocs.join(", ")}`,
          link: sub.link || "employees/employees.html"
        });
      }
    });

    // 3. Laborers missing W-9 (from laborers collection)
    const laborersWithoutW9 = await getLaborersWithoutW9(user.uid);
    laborersWithoutW9.forEach(laborer => {
      // Build deep-link URL with laborer ID and focus on W-9
      const link = laborer.id 
        ? `bookkeeping/bookkeeping.html?laborerId=${encodeURIComponent(laborer.id)}&focus=w9`
        : "bookkeeping/bookkeeping.html";
      laborReminders.push({
        text: `${laborer.name} - Missing W-9`,
        link: link
      });
    });

    // JOBS REMINDERS
    // 1. Jobs with past due payments
    const pastDueJobs = await getPastDueJobs(user.uid);
    pastDueJobs.forEach(job => {
      jobReminders.push({
        text: `${job.builderName} - ${job.jobName} (Past due)`,
        link: "contracts/contracts.html",
        type: "past-due-payment",
        jobId: job.jobId,
        builderId: job.builderId,
        builderName: job.builderName,
        builderEmail: job.builderEmail,
        jobName: job.jobName
      });
    });

    // 2. Unpaid projects (invoices not sent)
    const unpaidProjects = await getUnpaidProjects(user.uid);
    unpaidProjects.forEach(project => {
      jobReminders.push({
        text: `${project.jobName} (${project.builderName}) - Send Invoice`,
        link: "invoice/invoice.html"
      });
    });

    // 3. Compliance reminders (expiring COI, Business License, Workers Comp)
    const complianceReminders = await getComplianceReminders(user.uid);
    complianceReminders.forEach(reminder => {
      jobReminders.push({
        text: reminder.text,
        link: reminder.link
      });
    });

    // 4. Subcontractor agreements missing (from contracts)
    subcontractorsMissingDocs.forEach(sub => {
      if (sub.missingDocs.includes("Sub Agreement")) {
        jobReminders.push({
          text: sub.name,
          link: sub.link || "contracts/contracts.html"
        });
      }
    });

    // Render reminders in two-column layout (desktop) or stacked (mobile)
    renderReminders(container, laborReminders, jobReminders);
  } catch (err) {
    console.error("Error loading reminders:", err);
    container.innerHTML = '<div class="form-error">Error loading reminders. Please refresh the page.</div>';
  }
}

// Render reminders in Labor/Jobs split layout
function renderReminders(container, laborReminders, jobReminders) {
  if (laborReminders.length === 0 && jobReminders.length === 0) {
    container.innerHTML = '<div class="muted">No reminders at this time.</div>';
    return;
  }

  container.innerHTML = `
    <div class="reminders-split">
      <div class="reminders-column reminders-labor">
        <h3 class="reminders-column-title">Labor</h3>
        <div class="reminders-list">
          ${laborReminders.length > 0 
            ? laborReminders.map(item => `
                <div class="reminder-item">
                  ${item.link ? `<a href="${item.link}" class="reminder-link">${escapeHtml(item.text)}</a>` : escapeHtml(item.text)}
                </div>
              `).join("")
            : '<div class="reminder-empty">All caught up</div>'
          }
        </div>
      </div>
      <div class="reminders-column reminders-jobs">
        <h3 class="reminders-column-title">Jobs</h3>
        <div class="reminders-list">
          ${jobReminders.length > 0 
            ? jobReminders.map(item => {
                // Handle past-due payment reminders with email functionality
                if (item.type === "past-due-payment") {
                  return `
                    <div class="reminder-item">
                      <a href="#" class="reminder-link" data-reminder-type="past-due-payment" 
                         data-job-id="${escapeHtml(item.jobId)}" 
                         data-builder-id="${escapeHtml(item.builderId)}"
                         data-builder-name="${escapeHtml(item.builderName)}"
                         data-builder-email="${escapeHtml(item.builderEmail || '')}"
                         data-job-name="${escapeHtml(item.jobName)}">${escapeHtml(item.text)}</a>
                    </div>
                  `;
                }
                // Regular reminder links
                return `
                  <div class="reminder-item">
                    ${item.link ? `<a href="${item.link}" class="reminder-link">${escapeHtml(item.text)}</a>` : escapeHtml(item.text)}
                  </div>
                `;
              }).join("")
            : '<div class="reminder-empty">All caught up</div>'
          }
        </div>
      </div>
    </div>
  `;
  
  // Add click handlers for past-due payment reminders
  container.querySelectorAll('[data-reminder-type="past-due-payment"]').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const jobId = link.dataset.jobId;
      const builderId = link.dataset.builderId;
      const builderName = link.dataset.builderName;
      const builderEmail = link.dataset.builderEmail;
      const jobName = link.dataset.jobName;
      
      await handlePastDuePaymentClick(jobId, builderId, builderName, builderEmail, jobName);
    });
  });
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Get laborers without W-9
async function getLaborersWithoutW9(uid) {
  try {
    const laborersCol = collection(db, "users", uid, "laborers");
    const laborersSnap = await getDocs(query(laborersCol, orderBy("displayName", "asc")));
    const laborersWithoutW9 = [];

    laborersSnap.docs.forEach(doc => {
      const laborer = doc.data();
      // Check if W-9 is missing (no documents.w9 or w9Url or w9Completed flag)
      const hasW9 = laborer.documents?.w9?.downloadURL || laborer.w9Url || laborer.w9Completed;
      if (!hasW9) {
        laborersWithoutW9.push({
          id: doc.id, // Include laborer ID for deep-linking
          name: laborer.displayName || laborer.name || "Unknown"
        });
      }
    });

    return laborersWithoutW9;
  } catch (err) {
    console.error("Error getting laborers without W9:", err);
    return [];
  }
}

// Get jobs with past due payment status
async function getPastDueJobs(uid) {
  try {
    const buildersCol = collection(db, "users", uid, "builders");
    const buildersSnap = await getDocs(buildersCol);
    const pastDueJobs = [];

    for (const builderDoc of buildersSnap.docs) {
      const builder = builderDoc.data();
      const builderId = builderDoc.id;
      const builderName = builder.name || "Unknown Builder";
      const builderEmail = builder.email || null;

      // Load jobs for this builder
      const jobsCol = collection(db, "users", uid, "builders", builderId, "jobs");
      const jobsSnap = await getDocs(query(jobsCol, orderBy("jobName", "asc")));

      jobsSnap.docs.forEach(jobDoc => {
        const job = jobDoc.data();
        // Check if payment status is past_due
        const paymentStatus = job.paymentStatus || "up_to_date";
        if (paymentStatus === "past_due") {
          pastDueJobs.push({
            builderName,
            builderEmail,
            jobName: job.jobName || "Unnamed Job",
            jobId: jobDoc.id,
            builderId
          });
        }
      });
    }

    return pastDueJobs;
  } catch (err) {
    console.error("Error getting past due jobs:", err);
    return [];
  }
}

// Get unpaid projects
async function getUnpaidProjects(uid) {
  try {
    const contractsCol = collection(db, "users", uid, "contracts");
    const contractsSnap = await getDocs(query(contractsCol, orderBy("builderName")));
    const unpaidProjects = [];

    for (const contractDoc of contractsSnap.docs) {
      const contract = contractDoc.data();
      // Only check active contracts
      if (contract.isActive !== false) {
        const jobsCol = collection(db, "users", uid, "contracts", contractDoc.id, "jobs");
        const jobsSnap = await getDocs(query(jobsCol, orderBy("jobName")));

        for (const jobDoc of jobsSnap.docs) {
          const job = jobDoc.data();
          if (job.isPaid !== true) {
            unpaidProjects.push({
              builderName: contract.builderName || "Unknown Builder",
              jobName: job.jobName || "Unnamed Job"
            });
          }
        }
      }
    }

    return unpaidProjects;
  } catch (err) {
    console.error("Error getting unpaid projects:", err);
    return [];
  }
}

// Get compliance reminders
async function getComplianceReminders(uid) {
  const reminders = [];
  
  try {
    const prequalRef = doc(db, "users", uid, "private", "prequal");
    const prequalSnap = await getDoc(prequalRef);
    const prequalData = prequalSnap.exists() ? prequalSnap.data() : {};

    // Check COI expiration
    if (prequalData.coi?.expiresOn) {
      const daysUntil = daysUntilExpiration(prequalData.coi.expiresOn);
      if (daysUntil !== null && daysUntil <= 60) {
        const status = daysUntil <= 0 ? "expired" : daysUntil <= 30 ? "expiring soon" : "expiring";
        reminders.push({
          text: `Certificate of Insurance ${status} (${formatReminderDate(prequalData.coi.expiresOn)})`,
          link: "coi.html"
        });
      }
    }

    // Check Business License expiration (if expiration date exists)
    if (prequalData.businessLicense?.expiresOn) {
      const daysUntil = daysUntilExpiration(prequalData.businessLicense.expiresOn);
      if (daysUntil !== null && daysUntil <= 60) {
        const status = daysUntil <= 0 ? "expired" : daysUntil <= 30 ? "expiring soon" : "expiring";
        reminders.push({
          text: `Business License ${status} (${formatReminderDate(prequalData.businessLicense.expiresOn)})`,
          link: "account/account.html"
        });
      }
    }

    // Check Workers Comp Exemption expiration (if expiration date exists)
    if (prequalData.workersComp?.expiresOn) {
      const daysUntil = daysUntilExpiration(prequalData.workersComp.expiresOn);
      if (daysUntil !== null && daysUntil <= 60) {
        const status = daysUntil <= 0 ? "expired" : daysUntil <= 30 ? "expiring soon" : "expiring";
        reminders.push({
          text: `Workers Compensation Exemption ${status} (${formatReminderDate(prequalData.workersComp.expiresOn)})`,
          link: "account/account.html"
        });
      }
    }
  } catch (err) {
    console.error("Error getting compliance reminders:", err);
  }

  return reminders;
}

// Get employees (non-subcontractors) without W9
async function getEmployeesWithoutW9(uid) {
  try {
    const employeesCol = collection(db, "users", uid, "employees");
    const employeesSnap = await getDocs(query(employeesCol, orderBy("nameLower")));
    const employeesWithoutW9 = [];

    employeesSnap.docs.forEach(doc => {
      const emp = doc.data();
      // Only check employees, not subcontractors (subcontractors are handled separately)
      if (emp.type !== "subcontractor" && !emp.w9Url) {
        employeesWithoutW9.push({ name: emp.name || "Unknown" });
      }
    });

    return employeesWithoutW9;
  } catch (err) {
    console.error("Error getting employees without W9:", err);
    return [];
  }
}

// Get subcontractors missing documents
async function getSubcontractorsMissingDocs(uid) {
  try {
    const employeesCol = collection(db, "users", uid, "employees");
    const employeesSnap = await getDocs(query(employeesCol, orderBy("nameLower")));
    const subcontractorsMissingDocs = [];

    // Check subcontractors in employees for missing W9 and COI
    employeesSnap.docs.forEach(doc => {
      const emp = doc.data();
      if (emp.type === "subcontractor") {
        const missingDocs = [];
        if (!emp.w9Url) missingDocs.push("W-9");
        if (!emp.coiUrl) missingDocs.push("COI");
        
        if (missingDocs.length > 0) {
          subcontractorsMissingDocs.push({
            name: emp.name || "Unknown",
            missingDocs,
            link: "employees/employees.html"
          });
        }
      }
    });

    // Check contracts for missing sub agreements
    const contractsCol = collection(db, "users", uid, "contracts");
    const contractsSnap = await getDocs(query(contractsCol, orderBy("builderName")));
    
    contractsSnap.docs.forEach(contractDoc => {
      const contract = contractDoc.data();
      // Only check active contracts
      if (contract.isActive !== false) {
        // Check if sub agreement is missing
        const hasUploadedAgreement = !!contract.subAgreementUrl;
        const hasSignedAgreement = contract.subAgreementType === "sign" && contract.subAgreementSigned === true;
        
        if (!hasUploadedAgreement && !hasSignedAgreement) {
          subcontractorsMissingDocs.push({
            name: `Contract with ${contract.builderName || "Unknown Builder"}`,
            missingDocs: ["Sub Agreement"],
            link: "contracts/contracts.html"
          });
        }
      }
    });

    return subcontractorsMissingDocs;
  } catch (err) {
    console.error("Error getting subcontractors missing docs:", err);
    return [];
  }
}

// Helper function to calculate days until expiration
function daysUntilExpiration(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffMs = target - now;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Helper function to format date for reminders
function formatReminderDate(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString();
}

// Handle past-due payment reminder click - open email draft
async function handlePastDuePaymentClick(jobId, builderId, builderName, builderEmail, jobName) {
  try {
    // Validate required data
    if (!jobId || !builderId || !jobName) {
      showMessage("Error: Missing job information. Please try again.", true);
      return;
    }

    // Get current user for profile data
    const user = auth.currentUser;
    if (!user) {
      showMessage("Please log in to send emails.", true);
      return;
    }

    // Load user profile data
    const profileRef = doc(db, "users", user.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    // Also try to load from users/{uid} for phone/email
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    // Get customer info for email signature
    const customerName = profile.name || user.displayName || "Customer";
    const customerPhone = userData.phoneNumber || profile.phone || "";
    const customerEmail = user.email || userData.email || "";

    // Build email subject
    const subject = `Past-Due Payment for ${jobName}`;

    // Build email body template
    const builderNameGreeting = builderName && builderName !== "Unknown Builder" ? builderName : "there";
    const body = `Hi ${builderNameGreeting},

I hope you're doing well. I'm writing to follow up regarding the payment for the ${jobName} project, which is currently past due according to our records.

As of today, we have not yet received payment for this job. If payment has already been sent, or if there is any discrepancy, issue, or detail that we may be unaware of, please reply to this email with an explanation so we can review and resolve it promptly.

If payment is still outstanding, we would appreciate your attention to this matter at your earliest convenience. Please let us know if you need another copy of the invoice or any additional information.

Thank you for your time and cooperation. We look forward to getting this resolved quickly.

Best regards,
${customerName}${customerPhone ? `\n${customerPhone}` : ""}${customerEmail ? `\n${customerEmail}` : ""}`;

    // Build mailto: URL
    let mailtoUrl = "mailto:";
    if (builderEmail && builderEmail.trim()) {
      mailtoUrl += encodeURIComponent(builderEmail.trim());
    }
    
    mailtoUrl += `?subject=${encodeURIComponent(subject)}`;
    mailtoUrl += `&body=${encodeURIComponent(body)}`;

    // Open email client
    window.location.href = mailtoUrl;

    // Show confirmation message
    showMessage("Draft email opened in your mail app.", false);

    // If builder email is missing, show additional message
    if (!builderEmail || !builderEmail.trim()) {
      setTimeout(() => {
        showMessage("Builder email not found—please add it in the Builder profile.", true);
      }, 2000);
    }
  } catch (err) {
    console.error("Error opening email draft:", err);
    showMessage("Error opening email. Please try again.", true);
  }
}

// Show message to user (reusable helper)
function showMessage(text, isError = false) {
  // Try to find an existing message container or create one
  let messageEl = document.getElementById("reminderMessage");
  if (!messageEl) {
    messageEl = document.createElement("div");
    messageEl.id = "reminderMessage";
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: ${isError ? "#fee" : "#efe"};
      color: ${isError ? "#c33" : "#3c3"};
      border: 1px solid ${isError ? "#fcc" : "#cfc"};
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-width: 300px;
      font-size: 0.9rem;
    `;
    document.body.appendChild(messageEl);
  }

  messageEl.textContent = text;
  messageEl.style.display = "block";

  // Auto-hide after 5 seconds (or 7 seconds for errors)
  setTimeout(() => {
    messageEl.style.display = "none";
  }, isError ? 7000 : 5000);
}
