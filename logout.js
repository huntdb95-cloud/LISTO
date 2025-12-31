// logout.js - Dedicated logout module (works independently of scripts.js)
// Ensures logout works reliably on all pages, even if scripts.js fails

import { auth as configAuth } from "./config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// State management
let isLoggingOut = false;
let logoutModalOpen = false;

// Calculate login redirect path based on current location
// Matches the logic in scripts.js requireAuthGuard for consistency
function getLoginPath() {
  const pathname = window.location.pathname;
  // Count directory depth (excluding HTML filename)
  const pathSegments = pathname.split("/").filter(p => p && !p.endsWith(".html"));
  const depth = pathSegments.length;
  // Use same logic as requireAuthGuard for consistency
  return depth > 0 ? "../".repeat(depth) + "login/login.html" : "login/login.html";
}

// Show logout confirmation modal
function showLogoutConfirmation() {
  // Prevent multiple modal openings
  if (isLoggingOut || logoutModalOpen) {
    return;
  }
  
  logoutModalOpen = true;
  
  // Get or create modal
  let modal = document.getElementById("logoutConfirmationModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "logoutConfirmationModal";
    modal.className = "logout-modal-overlay";
    modal.innerHTML = `
      <div class="logout-modal-content">
        <div class="logout-modal-header">
          <h3 data-i18n="logout.confirmTitle">Are you sure you want to log out?</h3>
        </div>
        <div class="logout-modal-body">
          <p data-i18n="logout.confirmMessage">You will need to log in again to access your account.</p>
        </div>
        <div class="logout-modal-footer">
          <button type="button" class="btn ghost" id="logoutCancelBtn" data-i18n="logout.cancel">Cancel</button>
          <button type="button" class="btn primary" id="logoutConfirmBtn" data-i18n="logout.confirm">Log Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Close on overlay click (only attach once)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideLogoutConfirmation();
      }
    });
  }
  
  // Set up button event listeners every time modal is shown
  const cancelBtn = document.getElementById("logoutCancelBtn");
  const confirmBtn = document.getElementById("logoutConfirmBtn");
  
  if (cancelBtn && confirmBtn) {
    // Remove existing listeners if they exist
    if (cancelBtn._cancelHandler) {
      cancelBtn.removeEventListener("click", cancelBtn._cancelHandler);
    }
    if (confirmBtn._confirmHandler) {
      confirmBtn.removeEventListener("click", confirmBtn._confirmHandler);
    }
    
    // Create and store new handlers
    const cancelHandler = () => {
      hideLogoutConfirmation();
    };
    cancelBtn._cancelHandler = cancelHandler;
    cancelBtn.addEventListener("click", cancelHandler);
    
    const confirmHandler = async () => {
      // Prevent multiple logout attempts
      if (isLoggingOut) {
        return;
      }
      
      isLoggingOut = true;
      
      // Disable button to prevent double-clicks
      confirmBtn.disabled = true;
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = "Signing out...";
      
      try {
        // Sign out from Firebase
        if (!configAuth) {
          throw new Error("Authentication not initialized. Please refresh the page.");
        }
        
        await signOut(configAuth);
        
        // Clear auth-related storage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        sessionStorage.clear();
        
        // Redirect to login page
        const loginPath = getLoginPath();
        window.location.href = loginPath;
      } catch (e) {
        console.error("Logout error:", e);
        // Reset flags on error
        isLoggingOut = false;
        logoutModalOpen = false;
        // Re-enable button on error
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
        hideLogoutConfirmation();
        alert("Failed to sign out. Please try again.");
      }
    };
    confirmBtn._confirmHandler = confirmHandler;
    confirmBtn.addEventListener("click", confirmHandler);
  }
  
  // Set up Escape key handler every time modal is shown
  const existingEscapeHandler = modal._escapeHandler;
  if (existingEscapeHandler) {
    document.removeEventListener("keydown", existingEscapeHandler);
  }
  
  const escapeHandler = (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      hideLogoutConfirmation();
      document.removeEventListener("keydown", escapeHandler);
      modal._escapeHandler = null;
    }
  };
  modal._escapeHandler = escapeHandler;
  document.addEventListener("keydown", escapeHandler);
  
  // Show modal
  modal.classList.add("show");
  
  // Apply translations if available
  if (typeof applyTranslations === "function") {
    const currentLang = window.currentLang || localStorage.getItem("listo_lang") || "en";
    applyTranslations(currentLang);
  }
}

function hideLogoutConfirmation() {
  const modal = document.getElementById("logoutConfirmationModal");
  if (modal) {
    modal.classList.remove("show");
  }
  // Reset flags when modal is closed
  logoutModalOpen = false;
  isLoggingOut = false;
}

// Logout event handler (capture phase to work even if stopPropagation is called)
function handleLogoutEvent(e) {
  // Check if click/touch target is a logout button
  const logoutBtn = e.target.closest('[data-action="logout"]') || 
                    e.target.closest('#mobileLogoutBtn') || 
                    e.target.closest('#sidebarLogoutBtn') || 
                    e.target.closest('.logout-btn');
  if (!logoutBtn) return;
  
  // Prevent default and stop propagation
  e.preventDefault();
  e.stopPropagation();
  
  // Show logout confirmation modal
  showLogoutConfirmation();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Attach in CAPTURE phase (runs before bubbling phase)
    document.addEventListener("click", handleLogoutEvent, { capture: true, passive: false });
    document.addEventListener("pointerup", handleLogoutEvent, { capture: true, passive: false });
  });
} else {
  // DOM already ready, attach immediately
  document.addEventListener("click", handleLogoutEvent, { capture: true, passive: false });
  document.addEventListener("pointerup", handleLogoutEvent, { capture: true, passive: false });
}

