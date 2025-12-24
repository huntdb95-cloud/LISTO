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

// Facebook plugin initialization - Mobile-safe iframe solution
// 
// FIX FOR IPHONE SAFARI: 
// Root cause: The Facebook embed was being wiped after initial render due to:
//   1. Using container.innerHTML = '' which destroys the iframe
//   2. Page re-renders after auth state loads clearing the container
//   3. CSS/layout issues on iOS Safari causing iframe to collapse
//
// Solution implemented:
//   1. Created dedicated mount node (#fbTimelineMount) that never gets wiped
//   2. Replaced all innerHTML usage with DOM manipulation (appendChild/removeChild)
//   3. Mount node is preserved even if container is rebuilt
//   4. Hardened CSS with proper min-height, overflow:visible, and no transforms
//   5. Added graceful fallback detection for iOS privacy blocking (5s timeout)
//   6. Initialization happens once on DOM ready (doesn't wait for auth)
//
// The mount node pattern ensures the iframe persists even if:
//   - Auth state changes trigger re-renders
//   - Other code rebuilds dashboard content
//   - Page refreshes or orientation changes
//
const FB_PAGE_URL = "https://www.facebook.com/profile.php?id=61585220295883";
let fbIframeTimeout = null;
let fbIframeLoaded = false;
let fbInitializationInProgress = false; // Guard against concurrent initialization
let fbMountNode = null; // Dedicated mount node that never gets destroyed
let fbInitialized = false; // Track if FB has been initialized

// Detect mobile viewport (same breakpoint as site)
function isMobile() {
  return window.innerWidth <= 768;
}

// Create or get dedicated mount node that never gets wiped
function ensureMountNode() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) {
    return null;
  }
  
  // Check if mount node already exists
  if (fbMountNode && container.contains(fbMountNode)) {
    return fbMountNode;
  }
  
  // Create new mount node
  fbMountNode = document.createElement('div');
  fbMountNode.id = 'fbTimelineMount';
  fbMountNode.style.cssText = 'width: 100%; min-height: 600px; position: relative;';
  
  // Clear container using DOM manipulation (safer than innerHTML)
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  // Append mount node
  container.appendChild(fbMountNode);
  
  return fbMountNode;
}

// Show loading state (using DOM manipulation, not innerHTML)
function showFacebookLoading() {
  const mount = ensureMountNode();
  if (!mount) return;
  
  // Clear mount using DOM manipulation
  while (mount.firstChild) {
    mount.removeChild(mount.firstChild);
  }
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'facebook-loading-state';
  loadingDiv.style.cssText = `
    padding: 40px 20px;
    text-align: center;
    color: var(--muted);
    min-height: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  `;
  loadingDiv.innerHTML = `
    <div style="font-size: 0.95rem;">Loading Facebook feed...</div>
    <div style="width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite;"></div>
  `;
  
  mount.appendChild(loadingDiv);
  
  // Add spin animation if not already in styles
  if (!document.getElementById('fb-loading-spin-style')) {
    const style = document.createElement('style');
    style.id = 'fb-loading-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
}

// Show fallback when iframe fails to load (using DOM manipulation)
function showFacebookFallback() {
  const mount = ensureMountNode();
  if (!mount) return;
  
  // Clear mount using DOM manipulation
  while (mount.firstChild) {
    mount.removeChild(mount.firstChild);
  }
  
  const fallbackDiv = document.createElement('div');
  fallbackDiv.className = 'facebook-error-state';
  fallbackDiv.style.cssText = `
    padding: 40px 20px;
    text-align: center;
    color: var(--muted);
    min-height: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  `;
  fallbackDiv.innerHTML = `
    <div style="font-size: 0.95rem; margin-bottom: 8px;">Updates couldn't load here.</div>
    <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 12px;">If your browser blocks embedded Facebook content, open directly.</div>
    <a href="${FB_PAGE_URL}" target="_blank" rel="noopener noreferrer" class="btn primary" style="
      display: inline-block;
      padding: 12px 24px;
      text-decoration: none;
      margin-top: 8px;
    ">View updates on Facebook</a>
  `;
  
  mount.appendChild(fallbackDiv);
}

// Render Facebook feed using iframe (stable solution for mobile and desktop)
// FIX: Use mount node and DOM manipulation to prevent container from being wiped
function renderFacebookIframe() {
  // Prevent concurrent initialization attempts
  if (fbInitializationInProgress) {
    return;
  }
  
  // Ensure mount node exists (never gets wiped)
  const mount = ensureMountNode();
  if (!mount) {
    return;
  }
  
  // Set initialization flag to prevent concurrent calls
  fbInitializationInProgress = true;
  
  // Calculate responsive dimensions
  const container = document.getElementById('facebookFeedContainer');
  const containerWidth = Math.max(280, container?.offsetWidth || container?.clientWidth || 500);
  const containerHeight = 600; // Fixed height for both mobile and desktop
  
  // Clear any existing timeout
  if (fbIframeTimeout) {
    clearTimeout(fbIframeTimeout);
    fbIframeTimeout = null;
  }
  
  // Reset loaded flag
  fbIframeLoaded = false;
  
  // Show loading state (clears mount and adds loading indicator)
  showFacebookLoading();
  
  // Create iframe with properly formatted URL
  const iframe = document.createElement('iframe');
  iframe.id = 'fbPageIframe';
  // Build URL with all required parameters
  const fbUrlParams = new URLSearchParams({
    href: FB_PAGE_URL,
    tabs: 'timeline',
    width: containerWidth.toString(),
    height: containerHeight.toString(),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'true'
  });
  iframe.src = `https://www.facebook.com/plugins/page.php?${fbUrlParams.toString()}`;
  iframe.width = containerWidth;
  iframe.height = containerHeight;
  iframe.style.cssText = 'border:none;overflow:hidden;width:100%;max-width:100%;display:block;min-height:600px;';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share');
  
  // Handle iframe load success
  iframe.onload = function() {
    fbIframeLoaded = true;
    fbInitializationInProgress = false;
    if (fbIframeTimeout) {
      clearTimeout(fbIframeTimeout);
      fbIframeTimeout = null;
    }
    // Remove loading state from mount
    const loadingState = mount.querySelector('.facebook-loading-state');
    if (loadingState) {
      loadingState.remove();
    }
  };
  
  // Handle iframe load error
  iframe.onerror = function() {
    fbInitializationInProgress = false;
    if (fbIframeTimeout) {
      clearTimeout(fbIframeTimeout);
      fbIframeTimeout = null;
    }
    showFacebookFallback();
  };
  
  // Append iframe to mount node (never wipe mount node itself)
  mount.appendChild(iframe);
  
  // Set timeout to detect if iframe doesn't load (5 seconds for iOS)
  fbIframeTimeout = setTimeout(() => {
    if (!fbIframeLoaded) {
      fbInitializationInProgress = false;
      // Check if iframe actually loaded but didn't fire onload
      const checkIframe = mount.querySelector('#fbPageIframe');
      if (checkIframe && checkIframe.offsetHeight > 0 && checkIframe.offsetWidth > 0) {
        // Iframe is visible, consider it loaded
        fbIframeLoaded = true;
        const loadingState = mount.querySelector('.facebook-loading-state');
        if (loadingState) {
          loadingState.remove();
        }
      } else {
        // Iframe didn't load, show fallback (iOS privacy blocking or other issue)
        showFacebookFallback();
      }
    }
  }, 5000); // 5 second timeout for iOS Safari
}

// Handle window resize and orientation change - update iframe dimensions
// FIX: Use mount node instead of container to find iframe
let resizeTimeout = null;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const mount = fbMountNode;
    const iframe = mount?.querySelector('#fbPageIframe');
    
    if (!mount || !iframe) {
      return;
    }
    
    // Update iframe dimensions on resize
    const container = document.getElementById('facebookFeedContainer');
    const containerWidth = Math.max(280, container?.offsetWidth || container?.clientWidth || 500);
    const containerHeight = 600; // Fixed height for both mobile and desktop
    
    // Update iframe src with new width (Facebook iframe adapts automatically with adapt_container_width=true)
    // Just update the width attribute for consistency
    iframe.setAttribute('width', containerWidth);
    iframe.setAttribute('height', containerHeight);
    iframe.style.width = '100%';
  }, 300);
}

// Initialize Facebook feed - ensure it only runs once
function initializeFacebookPlugin() {
  // Prevent multiple initializations
  if (fbInitialized) {
    return;
  }
  
  const container = document.getElementById('facebookFeedContainer');
  if (!container) {
    setTimeout(initializeFacebookPlugin, 100);
    return;
  }
  
  // Mark as initialized
  fbInitialized = true;
  
  // Use iframe directly (no SDK needed) - works on both mobile and desktop
  renderFacebookIframe();
}

// Initialize when DOM is ready
// FIX: Facebook embed doesn't need auth, just DOM. Mount node protects against re-renders.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFacebookPlugin);
} else {
  // DOM already ready - use setTimeout to ensure other scripts have run
  setTimeout(initializeFacebookPlugin, 0);
}

// Handle resize and orientation change
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  // Delay to allow layout to settle after orientation change
  setTimeout(() => {
    handleResize();
    // Re-render iframe after orientation change to ensure proper dimensions (iOS Safari)
    const mount = fbMountNode;
    if (mount && isMobile()) {
      setTimeout(() => {
        // Only re-render if iframe exists and is visible
        const iframe = mount.querySelector('#fbPageIframe');
        if (!iframe || iframe.offsetHeight === 0) {
          renderFacebookIframe();
        }
      }, 500);
    }
  }, 300);
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

