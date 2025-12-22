// dashboard.js
// Dashboard page - Display account information

import { auth, db } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { ref, getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);
const storage = getStorage();

// Initialize dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadDashboardData(user);
  }
});

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

// Load reminders
async function loadReminders(user) {
  const container = $("remindersContainer");
  if (!container) return;

  try {
    const reminders = [];

    // 1. Unpaid projects reminder
    const unpaidProjects = await getUnpaidProjects(user.uid);
    if (unpaidProjects.length > 0) {
      reminders.push({
        type: "invoice",
        title: "Send Invoices",
        items: unpaidProjects.map(p => ({
          text: `${p.jobName} (${p.builderName})`,
          link: "invoice/invoice.html"
        }))
      });
    }

    // 2. Compliance reminders
    const complianceReminders = await getComplianceReminders(user.uid);
    if (complianceReminders.length > 0) {
      reminders.push({
        type: "compliance",
        title: "Compliance Renewals",
        items: complianceReminders
      });
    }

    // 3. Employees (non-subcontractors) without W9
    const employeesWithoutW9 = await getEmployeesWithoutW9(user.uid);
    if (employeesWithoutW9.length > 0) {
      reminders.push({
        type: "employees",
        title: "Employees Missing W-9",
        items: employeesWithoutW9.map(emp => ({
          text: emp.name,
          link: "employees/employees.html"
        }))
      });
    }

    // 4. Subcontractors missing documents (W9, COI, or Sub Agreement)
    const subcontractorsMissingDocs = await getSubcontractorsMissingDocs(user.uid);
    if (subcontractorsMissingDocs.length > 0) {
      reminders.push({
        type: "subcontractors",
        title: "Subcontractors Missing Documents",
        items: subcontractorsMissingDocs.map(sub => ({
          text: `${sub.name} - Missing: ${sub.missingDocs.join(", ")}`,
          link: sub.link || "employees/employees.html"
        }))
      });
    }

    // Render reminders
    if (reminders.length === 0) {
      container.innerHTML = '<div class="muted">No reminders at this time.</div>';
    } else {
      container.innerHTML = reminders.map(reminder => `
        <div class="reminder-section" style="margin-bottom: 24px;">
          <h3 class="h3" style="margin-top: 0; margin-bottom: 12px;">${reminder.title}</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${reminder.items.map(item => `
              <li style="margin-bottom: 8px;">
                ${item.link ? `<a href="${item.link}" style="color: var(--primary); text-decoration: none;">${item.text}</a>` : item.text}
              </li>
            `).join("")}
          </ul>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error loading reminders:", err);
    container.innerHTML = '<div class="form-error">Error loading reminders. Please refresh the page.</div>';
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

