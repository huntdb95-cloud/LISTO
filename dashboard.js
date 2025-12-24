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

// Facebook plugin initialization and mobile Safari support
const FB_PAGE_URL = "https://www.facebook.com/profile.php?id=61585220295883";
let fbPluginInitialized = false;
let resizeTimeout = null;
let fbRenderCheckInterval = null;

// Show loading state
function showFacebookLoading() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="facebook-loading-state" style="
      padding: 40px 20px;
      text-align: center;
      color: var(--muted);
      min-height: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    ">
      <div style="font-size: 0.95rem;">Loading Facebook feed...</div>
      <div style="width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
  `;
  
  // Add spin animation if not already in styles
  if (!document.getElementById('fb-loading-spin-style')) {
    const style = document.createElement('style');
    style.id = 'fb-loading-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
}

// Show error state with fallback
function showFacebookError() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="facebook-error-state" style="
      padding: 40px 20px;
      text-align: center;
      color: var(--muted);
      min-height: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    ">
      <div style="font-size: 0.95rem; margin-bottom: 8px;">Facebook feed couldn't load on this device.</div>
      <a href="${FB_PAGE_URL}" target="_blank" rel="noopener noreferrer" class="btn primary" style="
        display: inline-block;
        padding: 12px 24px;
        text-decoration: none;
        margin-top: 8px;
      ">Open Updates on Facebook</a>
    </div>
  `;
}

// Fallback: Use iframe embed directly (more reliable on mobile)
function renderFacebookIframeFallback() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) return;
  
  const containerWidth = container.offsetWidth || container.clientWidth || 500;
  const containerHeight = Math.max(600, window.innerHeight * 0.6);
  
  container.innerHTML = `
    <iframe 
      src="https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FB_PAGE_URL)}&tabs=timeline&width=${containerWidth}&height=${containerHeight}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId"
      width="${containerWidth}" 
      height="${containerHeight}"
      style="border:none;overflow:hidden;width:100%;max-width:100%;display:block;" 
      scrolling="no" 
      frameborder="0" 
      allowfullscreen="true" 
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
      id="fbPageIframe"
    ></iframe>
  `;
  
  console.log("[FB Plugin] Rendered iframe fallback");
}

// Check if Facebook plugin iframe has rendered
function checkFacebookRender() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) return false;
  
  // Check for iframe inside fb-page
  const fbPage = container.querySelector('.fb-page');
  if (fbPage) {
    const iframe = fbPage.querySelector('iframe');
    if (iframe && iframe.offsetHeight > 0 && iframe.offsetWidth > 0) {
      return true;
    }
  }
  
  // Also check for direct iframe
  const directIframe = container.querySelector('iframe');
  if (directIframe && directIframe.offsetHeight > 0 && directIframe.offsetWidth > 0) {
    return true;
  }
  
  return false;
}

// Make function globally accessible for SDK onload callback
window.initFacebookPlugin = function() {
  // Prevent multiple simultaneous initializations
  if (fbPluginInitialized && checkFacebookRender()) {
    console.log("[FB Plugin] Already initialized and rendered, skipping");
    return;
  }

  console.log("[FB Plugin] Initializing Facebook plugin...");
  
  // Wait for fb-root to exist
  const fbRoot = document.getElementById('fb-root');
  if (!fbRoot) {
    console.error("[FB Plugin] fb-root element not found");
    setTimeout(window.initFacebookPlugin, 100);
    return;
  }

  if (!window.FB) {
    console.warn("[FB Plugin] window.FB not available yet, retrying...");
    setTimeout(window.initFacebookPlugin, 200);
    return;
  }

  const container = document.getElementById('facebookFeedContainer');
  const plugin = document.getElementById('fbPagePlugin');
  
  if (!container) {
    console.error("[FB Plugin] Container not found");
    return;
  }

  try {
    // Ensure plugin element exists - create it if missing
    if (!plugin) {
      // Create plugin element (this replaces any loading state, which is expected)
      container.innerHTML = `
        <div class="fb-page" 
             id="fbPagePlugin"
             data-href="${FB_PAGE_URL}" 
             data-tabs="timeline" 
             data-width="500" 
             data-height="600" 
             data-small-header="false" 
             data-adapt-container-width="true" 
             data-hide-cover="false" 
             data-show-facepile="true">
          <blockquote cite="${FB_PAGE_URL}" class="fb-xfbml-parse-ignore">
            <a href="${FB_PAGE_URL}">Listo - Business Tools</a>
            <a href="${FB_PAGE_URL}">Listo</a>
          </blockquote>
        </div>
      `;
    } else {
      // Plugin exists, but show loading if container is empty or only has loading state
      // This handles cases where plugin exists but hasn't rendered yet
      const hasContent = container.children.length > 0 && 
                        !container.querySelector('.facebook-loading-state') &&
                        !container.querySelector('.facebook-error-state');
      if (!hasContent) {
        showFacebookLoading();
      }
    }
    
    const pluginElement = document.getElementById('fbPagePlugin');
    if (!pluginElement) {
      console.error("[FB Plugin] Plugin element not found after creation");
      return;
    }
    
    // Set responsive width based on container (critical for mobile)
    const containerWidth = Math.max(280, container.offsetWidth || container.clientWidth || 500);
    pluginElement.setAttribute('data-width', containerWidth.toString());
    
    const isMobile = window.innerWidth <= 768;
    console.log(`[FB Plugin] Container width: ${containerWidth}px, Mobile: ${isMobile}`);
    
    // Parse XFBML - only parse the container, not the entire document
    window.FB.XFBML.parse(container, function() {
      console.log("[FB Plugin] Facebook plugin parsed successfully");
      
      // Start checking if iframe rendered
      let checkCount = 0;
      const maxChecks = 20; // Check for up to 4 seconds (20 * 200ms)
      
      if (fbRenderCheckInterval) {
        clearInterval(fbRenderCheckInterval);
      }
      
      fbRenderCheckInterval = setInterval(() => {
        checkCount++;
        
        if (checkFacebookRender()) {
          console.log("[FB Plugin] Facebook iframe rendered successfully");
          clearInterval(fbRenderCheckInterval);
          fbRenderCheckInterval = null;
          fbPluginInitialized = true;
          
          // Clear any loading state
          const loadingState = container.querySelector('.facebook-loading-state');
          if (loadingState) {
            loadingState.remove();
          }
        } else if (checkCount >= maxChecks) {
          console.warn("[FB Plugin] Facebook iframe did not render after timeout, trying fallback");
          clearInterval(fbRenderCheckInterval);
          fbRenderCheckInterval = null;
          
          // Try iframe fallback on mobile if SDK render fails
          if (isMobile) {
            renderFacebookIframeFallback();
            fbPluginInitialized = true;
          } else {
            showFacebookError();
          }
        }
      }, 200);
      
      // Also re-parse after a delay for mobile Safari compatibility
      if (isMobile) {
        setTimeout(() => {
          if (window.FB && window.FB.XFBML && container.isConnected) {
            window.FB.XFBML.parse(container);
            console.log("[FB Plugin] Re-parsed for mobile Safari compatibility");
          }
        }, 500);
      }
    });
  } catch (error) {
    console.error("[FB Plugin] Error initializing:", error);
    showFacebookError();
  }
};

// Handle window resize and orientation change (critical for mobile)
// IMPORTANT: Do NOT replace innerHTML - just update data-width attribute
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const container = document.getElementById('facebookFeedContainer');
    const plugin = document.getElementById('fbPagePlugin');
    
    if (!container || !window.FB) return;
    
    const containerWidth = Math.max(280, container.offsetWidth || container.clientWidth || 500);
    
    // Update iframe fallback if it exists
    const iframe = container.querySelector('iframe#fbPageIframe');
    if (iframe) {
      const containerHeight = Math.max(600, window.innerHeight * 0.6);
      iframe.setAttribute('width', containerWidth);
      iframe.setAttribute('height', containerHeight);
      iframe.style.width = '100%';
      return;
    }
    
    // Update plugin data-width without destroying the iframe
    if (plugin && window.FB) {
      const currentWidth = parseInt(plugin.getAttribute('data-width') || '0');
      
      // Only update if width changed significantly (avoid constant updates)
      if (Math.abs(currentWidth - containerWidth) > 10) {
        console.log(`[FB Plugin] Resize detected: ${currentWidth}px -> ${containerWidth}px`);
        plugin.setAttribute('data-width', containerWidth.toString());
        
        // Re-parse only if plugin is already initialized (don't destroy iframe)
        if (fbPluginInitialized && checkFacebookRender()) {
          // Just update width, don't re-parse (re-parsing can destroy the iframe)
          // The iframe should adapt automatically with data-adapt-container-width="true"
          console.log("[FB Plugin] Updated width attribute, iframe should adapt automatically");
        }
      }
    }
  }, 300);
}

// Initialize when DOM is ready
function initializeFacebookPlugin() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) {
    console.warn("[FB Plugin] Container not found, waiting for DOM...");
    setTimeout(initializeFacebookPlugin, 100);
    return;
  }
  
  // Check if plugin element already exists in HTML
  const existingPlugin = document.getElementById('fbPagePlugin');
  
  // Only show loading if plugin exists but hasn't rendered yet, or if container is empty
  // If plugin doesn't exist, initFacebookPlugin() will create it immediately (no need for loading)
  if (existingPlugin || container.children.length === 0) {
    showFacebookLoading();
  }
  
  // Check if FB SDK is already loaded
  if (window.FB) {
    window.initFacebookPlugin();
  } else {
    // Wait for SDK to load (handled by SDK script onload)
    let checkCount = 0;
    const maxChecks = 50; // Wait up to 5 seconds
    
    const checkInterval = setInterval(() => {
      checkCount++;
      if (window.FB) {
        clearInterval(checkInterval);
        window.initFacebookPlugin();
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        console.error("[FB Plugin] Facebook SDK failed to load after 5 seconds");
        // Try iframe fallback
        renderFacebookIframeFallback();
      }
    }, 100);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFacebookPlugin);
} else {
  // DOM already ready
  initializeFacebookPlugin();
}

// Handle window load event (backup initialization)
window.addEventListener('load', () => {
  console.log("[FB Plugin] Window load event fired");
  if (window.FB && !fbPluginInitialized) {
    window.initFacebookPlugin();
  }
});

// Handle resize and orientation change (critical for mobile)
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  console.log("[FB Plugin] Orientation change detected");
  // Delay to allow layout to settle after orientation change
  setTimeout(() => {
    handleResize();
    // Also re-initialize on mobile after orientation change
    if (window.innerWidth <= 768 && window.FB && !checkFacebookRender()) {
      setTimeout(() => {
        if (!checkFacebookRender()) {
          console.log("[FB Plugin] Re-initializing after orientation change");
          fbPluginInitialized = false;
          window.initFacebookPlugin();
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

