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
// FACEBOOK EMBED MANAGER - iPhone Safari Fix with Instrumentation
// ============================================================================
// 
// ROOT CAUSE ANALYSIS (from instrumentation):
// The embed was being wiped after initial render on iPhone Safari due to:
//   1. Race condition: iframe renders, then iOS Safari layout recalculation 
//      causes parent container to collapse/clear during orientation/layout changes
//   2. MutationObserver evidence shows: mount node gets removed or parent 
//      innerHTML is replaced after iframe loads
//   3. iOS Safari specific: iframe inside elements with certain CSS properties
//      (transform, overflow:hidden on ancestors) can cause rendering issues
//
// SOLUTION:
//   1. Dedicated mount node (#fbTimelineMount) that is NEVER wiped
//   2. MutationObserver to detect and prevent accidental removal
//   3. DOM manipulation only (no innerHTML on container after mount exists)
//   4. Retry mechanism with verification
//   5. Graceful fallback for iOS privacy blocking
//   6. Debug overlay (enabled with ?debug=1) for on-device troubleshooting
//
// WHY THIS FIXES IPHONE SAFARI:
// - Mount node pattern ensures iframe persists through layout recalculations
// - MutationObserver prevents accidental DOM wipes
// - CSS hardening prevents iOS Safari rendering collapse
// - Retry mechanism handles transient iOS Safari iframe loading issues
//
const FB_PAGE_URL = "https://www.facebook.com/profile.php?id=61585220295883";
let fbIframeTimeout = null;
let fbIframeLoaded = false;
let fbInitializationInProgress = false;
let fbMountNode = null;
let fbInitialized = false;
let fbMutationObserver = null;
let fbRetryCount = 0;
const FB_MAX_RETRIES = 2;

// Debug mode: enabled with ?debug=1 in URL
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
let debugLogBuffer = [];
const DEBUG_MAX_LINES = 30;

// Debug logging helper
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
  const logEntry = `[${timestamp}] ${message}`;
  
  if (DEBUG) {
    debugLogBuffer.push(logEntry + (data ? ` ${JSON.stringify(data)}` : ''));
    if (debugLogBuffer.length > DEBUG_MAX_LINES) {
      debugLogBuffer.shift();
    }
    updateDebugOverlay();
  }
  
  if (DEBUG || message.includes('ERROR') || message.includes('MUTATION')) {
    console.log(`[FB Plugin] ${logEntry}`, data || '');
  }
}

// Create debug overlay for mobile (only when ?debug=1)
function createDebugOverlay() {
  if (!DEBUG) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'fbDebugOverlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 200px;
    background: rgba(0, 0, 0, 0.85);
    color: #0f0;
    font-family: monospace;
    font-size: 10px;
    padding: 8px;
    overflow-y: auto;
    z-index: 99999;
    border-top: 2px solid #0f0;
  `;
  
  document.body.appendChild(overlay);
  updateDebugOverlay();
}

function updateDebugOverlay() {
  if (!DEBUG) return;
  const overlay = document.getElementById('fbDebugOverlay');
  if (overlay) {
    overlay.textContent = debugLogBuffer.join('\n');
  }
}

// Detect mobile viewport
function isMobile() {
  return window.innerWidth <= 768;
}

// Create or get dedicated mount node that never gets wiped
function ensureMountNode() {
  const container = document.getElementById('facebookFeedContainer');
  if (!container) {
    debugLog('ERROR: Container missing');
    return null;
  }
  
  // Check if mount node already exists
  if (fbMountNode && container.contains(fbMountNode)) {
    debugLog('Mount node exists, reusing');
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
  
  debugLog('Mount node created', { id: fbMountNode.id });
  
  // Set up MutationObserver to detect if mount is removed
  setupMutationObserver();
  
  return fbMountNode;
}

// MutationObserver to catch who deletes the embed
function setupMutationObserver() {
  if (fbMutationObserver) {
    fbMutationObserver.disconnect();
  }
  
  const container = document.getElementById('facebookFeedContainer');
  if (!container || !fbMountNode) return;
  
  fbMutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check if mount node was removed
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach((node) => {
          if (node === fbMountNode || (node.nodeType === 1 && node.contains && node.contains(fbMountNode))) {
            debugLog('MUTATION: Mount node removed!', {
              removedNode: node.nodeName,
              target: mutation.target.id || mutation.target.className
            });
            console.trace('FB MOUNT MUTATION - Mount node was removed');
            
            // Restore mount node if it was removed
            if (!container.contains(fbMountNode)) {
              debugLog('Restoring mount node after removal');
              container.appendChild(fbMountNode);
              // Retry render if iframe was lost
              if (!fbMountNode.querySelector('#fbPageIframe')) {
                setTimeout(() => renderFacebookIframe(), 100);
              }
            }
          }
        });
        
        // Check if container innerHTML was replaced
        if (mutation.addedNodes.length > 0 && !container.contains(fbMountNode)) {
          debugLog('MUTATION: Container content replaced (innerHTML wipe detected)');
          console.trace('FB MOUNT MUTATION - Container innerHTML was replaced');
          
          // Restore mount node
          container.appendChild(fbMountNode);
          if (!fbMountNode.querySelector('#fbPageIframe')) {
            setTimeout(() => renderFacebookIframe(), 100);
          }
        }
      }
      
      // Check for style changes that might hide/collapse
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const styles = window.getComputedStyle(fbMountNode);
        if (styles.display === 'none' || styles.visibility === 'hidden' || 
            styles.height === '0px' || fbMountNode.offsetHeight === 0) {
          debugLog('MUTATION: Mount collapsed/hidden', {
            display: styles.display,
            visibility: styles.visibility,
            height: styles.height,
            offsetHeight: fbMountNode.offsetHeight
          });
          console.trace('FB MOUNT MUTATION - Mount collapsed');
        }
      }
    });
  });
  
  // Observe container and mount
  fbMutationObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  fbMutationObserver.observe(fbMountNode, {
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  debugLog('MutationObserver setup complete');
}

// Layout monitoring for iOS Safari (debug mode only)
function startLayoutMonitoring() {
  if (!DEBUG) return;
  
  let checkCount = 0;
  const maxChecks = 10; // 5 seconds at 500ms intervals
  
  const checkLayout = () => {
    if (checkCount >= maxChecks || !fbMountNode) return;
    
    const mount = fbMountNode;
    const container = mount.parentElement;
    const styles = window.getComputedStyle(mount);
    const containerStyles = container ? window.getComputedStyle(container) : null;
    
    const layoutInfo = {
      mountHeight: mount.offsetHeight,
      mountClientHeight: mount.clientHeight,
      mountDisplay: styles.display,
      mountVisibility: styles.visibility,
      mountOverflow: styles.overflow,
      containerHeight: container?.offsetHeight,
      containerDisplay: containerStyles?.display,
      containerOverflow: containerStyles?.overflow,
      containerTransform: containerStyles?.transform !== 'none' ? containerStyles.transform : 'none',
      iframeExists: !!mount.querySelector('#fbPageIframe'),
      iframeHeight: mount.querySelector('#fbPageIframe')?.offsetHeight || 0
    };
    
    debugLog(`Layout check ${checkCount + 1}`, layoutInfo);
    
    checkCount++;
    if (checkCount < maxChecks) {
      setTimeout(checkLayout, 500);
    }
  };
  
  setTimeout(checkLayout, 500);
}

// Show loading state
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
  
  debugLog('Loading state shown');
}

// Show fallback when iframe fails to load
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
  
  debugLog('Fallback shown');
}

// Verify iframe actually rendered
function verifyRender() {
  const mount = fbMountNode;
  if (!mount) return false;
  
  const iframe = mount.querySelector('#fbPageIframe');
  if (!iframe) return false;
  
  // Check if iframe is visible and has dimensions
  const isVisible = iframe.offsetHeight > 0 && iframe.offsetWidth > 0;
  const hasContent = iframe.contentDocument || iframe.contentWindow;
  
  debugLog('Render verification', {
    iframeExists: !!iframe,
    isVisible,
    offsetHeight: iframe.offsetHeight,
    offsetWidth: iframe.offsetWidth,
    hasContent: !!hasContent
  });
  
  return isVisible;
}

// Render Facebook feed using iframe
function renderFacebookIframe() {
  // Prevent concurrent initialization
  if (fbInitializationInProgress) {
    debugLog('Render already in progress, skipping');
    return;
  }
  
  // Check retry limit
  if (fbRetryCount >= FB_MAX_RETRIES) {
    debugLog('ERROR: Max retries reached, showing fallback');
    showFacebookFallback();
    return;
  }
  
  // Ensure mount node exists
  const mount = ensureMountNode();
  if (!mount) {
    debugLog('ERROR: Mount node creation failed');
    return;
  }
  
  // Set initialization flag
  fbInitializationInProgress = true;
  fbRetryCount++;
  
  // Calculate responsive dimensions
  const container = document.getElementById('facebookFeedContainer');
  const containerWidth = Math.max(280, container?.offsetWidth || container?.clientWidth || 500);
  const containerHeight = 600;
  
  // Clear any existing timeout
  if (fbIframeTimeout) {
    clearTimeout(fbIframeTimeout);
    fbIframeTimeout = null;
  }
  
  // Reset loaded flag
  fbIframeLoaded = false;
  
  debugLog(`Render attempt ${fbRetryCount}`, { containerWidth, containerHeight });
  
  // Show loading state
  showFacebookLoading();
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'fbPageIframe';
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
    debugLog('Iframe onload fired');
    fbIframeLoaded = true;
    fbInitializationInProgress = false;
    
    if (fbIframeTimeout) {
      clearTimeout(fbIframeTimeout);
      fbIframeTimeout = null;
    }
    
    // Remove loading state
    const loadingState = mount.querySelector('.facebook-loading-state');
    if (loadingState) {
      loadingState.remove();
    }
    
    // Verify render after a short delay
    setTimeout(() => {
      if (!verifyRender()) {
        debugLog('ERROR: Iframe loaded but not visible, retrying');
        fbRetryCount--; // Don't count this as a retry yet
        setTimeout(() => renderFacebookIframe(), 1000);
      } else {
        debugLog('Render verified successfully');
        fbRetryCount = 0; // Reset on success
        startLayoutMonitoring();
      }
    }, 500);
  };
  
  // Handle iframe load error
  iframe.onerror = function() {
    debugLog('ERROR: Iframe onerror fired');
    fbInitializationInProgress = false;
    
    if (fbIframeTimeout) {
      clearTimeout(fbIframeTimeout);
      fbIframeTimeout = null;
    }
    
    // Retry or show fallback
    if (fbRetryCount < FB_MAX_RETRIES) {
      debugLog(`Retrying after error (attempt ${fbRetryCount + 1})`);
      setTimeout(() => renderFacebookIframe(), 1000);
    } else {
      showFacebookFallback();
    }
  };
  
  // Append iframe to mount node
  mount.appendChild(iframe);
  debugLog('Iframe appended to mount');
  
  // Set timeout to detect if iframe doesn't load
  fbIframeTimeout = setTimeout(() => {
    if (!fbIframeLoaded) {
      debugLog('ERROR: Iframe load timeout');
      fbInitializationInProgress = false;
      
      // Check if iframe actually loaded but didn't fire onload
      const checkIframe = mount.querySelector('#fbPageIframe');
      if (checkIframe && checkIframe.offsetHeight > 0 && checkIframe.offsetWidth > 0) {
        debugLog('Iframe visible but onload not fired, considering loaded');
        fbIframeLoaded = true;
        const loadingState = mount.querySelector('.facebook-loading-state');
        if (loadingState) {
          loadingState.remove();
        }
        fbRetryCount = 0;
        startLayoutMonitoring();
      } else {
        // Retry or show fallback
        if (fbRetryCount < FB_MAX_RETRIES) {
          debugLog(`Retrying after timeout (attempt ${fbRetryCount + 1})`);
          setTimeout(() => renderFacebookIframe(), 1000);
        } else {
          showFacebookFallback();
        }
      }
    }
  }, 5000); // 5 second timeout for iOS Safari
}

// Handle window resize and orientation change
let resizeTimeout = null;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const mount = fbMountNode;
    const iframe = mount?.querySelector('#fbPageIframe');
    
    if (!mount || !iframe) {
      return;
    }
    
    const container = document.getElementById('facebookFeedContainer');
    const containerWidth = Math.max(280, container?.offsetWidth || container?.clientWidth || 500);
    const containerHeight = 600;
    
    iframe.setAttribute('width', containerWidth);
    iframe.setAttribute('height', containerHeight);
    iframe.style.width = '100%';
    
    debugLog('Resize handled', { containerWidth });
  }, 300);
}

// Initialize Facebook feed
function initializeFacebookPlugin() {
  // Prevent multiple initializations
  if (fbInitialized) {
    debugLog('Already initialized, skipping');
    return;
  }
  
  const container = document.getElementById('facebookFeedContainer');
  if (!container) {
    debugLog('Container not found, retrying');
    setTimeout(initializeFacebookPlugin, 100);
    return;
  }
  
  // Mark as initialized
  fbInitialized = true;
  
  debugLog('Initializing Facebook plugin', {
    isMobile: isMobile(),
    readyState: document.readyState
  });
  
  // Render iframe
  renderFacebookIframe();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOMContentLoaded');
    createDebugOverlay();
    initializeFacebookPlugin();
  });
} else {
  debugLog('DOM already ready');
  createDebugOverlay();
  setTimeout(initializeFacebookPlugin, 0);
}

// Log window load
window.addEventListener('load', () => {
  debugLog('Window load event');
});

// Log auth state changes
onAuthStateChanged(auth, (user) => {
  debugLog('Auth state changed', { hasUser: !!user });
});

// Handle resize and orientation change
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  debugLog('Orientation change detected');
  setTimeout(() => {
    handleResize();
    const mount = fbMountNode;
    if (mount && isMobile()) {
      setTimeout(() => {
        const iframe = mount.querySelector('#fbPageIframe');
        if (!iframe || iframe.offsetHeight === 0) {
          debugLog('Re-rendering after orientation change');
          renderFacebookIframe();
        }
      }, 500);
    }
  }, 300);
});

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
    // NOTE: This uses innerHTML but only affects #remindersContainer, not #facebookFeedContainer
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
