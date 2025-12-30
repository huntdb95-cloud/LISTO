/**
 * Sidebar Navigation Component
 * Desktop-only sidebar with expandable Tools submenu
 */

function createSidebarHTML(basePath = '') {
  // Determine path prefix based on current location
  const isRoot = basePath === '' || basePath === './';
  const pathPrefix = isRoot ? '' : basePath;
  
  return `
    <aside class="app-sidebar" aria-label="Primary navigation">
      <nav class="sidebar-nav">
        <ul class="sidebar-menu">
          <li class="sidebar-menu-item">
            <a href="${pathPrefix}dashboard.html" class="sidebar-link" data-nav="dashboard">
              <span class="sidebar-icon"><i class="bx bx-home-alt"></i></span>
              <span class="sidebar-label">Home</span>
            </a>
          </li>
          <li class="sidebar-menu-item">
            <a href="${pathPrefix}contracts/contracts.html" class="sidebar-link" data-nav="contracts">
              <span class="sidebar-icon"><i class="bx bx-file-blank"></i></span>
              <span class="sidebar-label">Contracts</span>
            </a>
          </li>
          <li class="sidebar-menu-item">
            <a href="${pathPrefix}bookkeeping/bookkeeping.html" class="sidebar-link" data-nav="bookkeeping">
              <span class="sidebar-icon"><i class="bx bx-book"></i></span>
              <span class="sidebar-label">Bookkeeping</span>
            </a>
          </li>
          <li class="sidebar-menu-item sidebar-menu-item-submenu">
            <button class="sidebar-link sidebar-submenu-toggle" type="button" aria-expanded="false" data-nav="tools">
              <span class="sidebar-icon"><i class="bx bx-wrench"></i></span>
              <span class="sidebar-label">Tools</span>
              <img src="${pathPrefix}images/arrow.png" class="sidebar-dropdown-arrow" alt="Expand" aria-hidden="true" />
            </button>
            <ul class="sidebar-submenu">
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}invoice/invoice.html" class="sidebar-link sidebar-submenu-link" data-nav="invoice">
                  <span class="sidebar-icon"><i class="bx bx-receipt"></i></span>
                  <span class="sidebar-label">Invoice Builder</span>
                </a>
              </li>
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}job-estimator/job-estimator.html" class="sidebar-link sidebar-submenu-link" data-nav="job-estimator">
                  <span class="sidebar-icon"><i class="bx bx-calculator"></i></span>
                  <span class="sidebar-label">Job Cost Estimator</span>
                </a>
              </li>
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}contract-scanner/contract-scanner.html" class="sidebar-link sidebar-submenu-link" data-nav="document-translator">
                  <span class="sidebar-icon"><i class="bx bx-scan"></i></span>
                  <span class="sidebar-label">Document Translator</span>
                </a>
              </li>
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}audit/audit.html" class="sidebar-link sidebar-submenu-link" data-nav="audit">
                  <span class="sidebar-icon"><i class="bx bx-clipboard"></i></span>
                  <span class="sidebar-label">Audit Help</span>
                </a>
              </li>
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}tools/1099.html" class="sidebar-link sidebar-submenu-link" data-nav="1099">
                  <span class="sidebar-icon"><i class="bx bx-file"></i></span>
                  <span class="sidebar-label">1099-NEC Generator</span>
                </a>
              </li>
              <li class="sidebar-submenu-item">
                <a href="${pathPrefix}prequal.html" class="sidebar-link sidebar-submenu-link" data-nav="prequal">
                  <span class="sidebar-icon"><i class="bx bx-check-square"></i></span>
                  <span class="sidebar-label">Pre-Qualification</span>
                </a>
              </li>
            </ul>
          </li>
          <li class="sidebar-menu-item">
            <a href="${pathPrefix}account/account.html" class="sidebar-link" data-nav="account">
              <span class="sidebar-icon"><i class="bx bx-user"></i></span>
              <span class="sidebar-label">My Account</span>
            </a>
          </li>
          <li class="sidebar-menu-item">
            <a href="${pathPrefix}support.html" class="sidebar-link" data-nav="support">
              <span class="sidebar-icon"><i class="bx bx-help-circle"></i></span>
              <span class="sidebar-label">Support</span>
            </a>
          </li>
        </ul>
        <div class="sidebar-footer">
          <button id="sidebarLogoutBtn" class="sidebar-link sidebar-logout-btn" type="button" data-nav="logout" data-action="logout" hidden>
            <span class="sidebar-icon"><i class="bx bx-log-out"></i></span>
            <span class="sidebar-label" data-i18n="auth.logout">Log out</span>
          </button>
        </div>
      </nav>
    </aside>
  `;
}

function initSidebar() {
  // Only initialize on desktop (≥1024px)
  if (window.innerWidth < 1024) {
    return;
  }

  const sidebarContainer = document.getElementById('sidebar');
  if (!sidebarContainer) return;

  // Determine base path
  const currentPath = window.location.pathname;
  let basePath = '';
  if (currentPath.includes('/contracts/') || 
      currentPath.includes('/bookkeeping/') || 
      currentPath.includes('/invoice/') || 
      currentPath.includes('/job-estimator/') ||
      currentPath.includes('/contract-scanner/') || // Note: path still uses contract-scanner folder name 
      currentPath.includes('/audit/') || 
      currentPath.includes('/tools/') ||
      currentPath.includes('/account/') ||
      currentPath.includes('/tools/') ||
      currentPath.includes('/settings/') ||
      currentPath.includes('/employees/') ||
      currentPath.includes('/payroll/')) {
    basePath = '../';
  } else if (currentPath === '/' || currentPath.endsWith('/dashboard.html') || currentPath.endsWith('/dashboard')) {
    basePath = '';
  } else {
    basePath = '';
  }

  // Inject sidebar HTML
  sidebarContainer.innerHTML = createSidebarHTML(basePath);

  // Initialize sidebar functionality
  initSidebarBehavior();
  markActiveLink();
}

function initSidebarBehavior() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  // Align sidebar with header - update CSS variable for sticky positioning
  const updateSidebarPosition = () => {
    const header = document.querySelector('.site-header');
    if (header && sidebar) {
      const headerHeight = header.offsetHeight;
      // Update CSS variable so sticky positioning uses correct top offset
      document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
      // Update height calculation for sticky sidebar (CSS handles top positioning)
      sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
      sidebar.style.maxHeight = `calc(100vh - ${headerHeight}px)`;
    }
  };

  updateSidebarPosition();
  
  // Update on resize (in case header height changes)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateSidebarPosition, 100);
  });
  
  // Also update on scroll in case header height changes dynamically
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateSidebarPosition, 50);
  }, { passive: true });

  // Handle Tools submenu toggle
  const toolsToggle = sidebar.querySelector('.sidebar-submenu-toggle');
  if (toolsToggle) {
    // Check if submenu should be open (active tool page or localStorage)
    const shouldBeOpen = checkIfSubmenuShouldBeOpen() || 
                        localStorage.getItem('sidebar-tools-open') === 'true';
    
    if (shouldBeOpen) {
      toolsToggle.closest('.sidebar-menu-item-submenu').classList.add('is-open');
      toolsToggle.setAttribute('aria-expanded', 'true');
    }

    toolsToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const menuItem = toolsToggle.closest('.sidebar-menu-item-submenu');
      const isOpen = menuItem.classList.contains('is-open');
      
      if (isOpen) {
        menuItem.classList.remove('is-open');
        toolsToggle.setAttribute('aria-expanded', 'false');
        localStorage.setItem('sidebar-tools-open', 'false');
      } else {
        menuItem.classList.add('is-open');
        toolsToggle.setAttribute('aria-expanded', 'true');
        localStorage.setItem('sidebar-tools-open', 'true');
      }
    });

    // Keyboard support
    toolsToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toolsToggle.click();
      }
    });
  }
}

function checkIfSubmenuShouldBeOpen() {
  const currentPath = window.location.pathname.toLowerCase();
  const toolPaths = ['/invoice/', '/job-estimator/', '/contract-scanner/', '/audit/', '/tools/', '/1099']; // Note: path still uses contract-scanner folder
  return toolPaths.some(path => currentPath.includes(path));
}

function markActiveLink() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  const currentPath = window.location.pathname;
  const currentFile = currentPath.split('/').pop() || '';
  const allLinks = sidebar.querySelectorAll('.sidebar-link:not(.sidebar-submenu-toggle)');

  allLinks.forEach(link => {
    link.classList.remove('is-active');
    link.removeAttribute('aria-current');
    
    const href = link.getAttribute('href') || '';
    if (!href) return;

    // Normalize paths for comparison
    const hrefFile = href.split('/').pop() || '';
    const currentPathNormalized = currentPath.replace(/\/$/, '').toLowerCase();
    const hrefNormalized = href.replace(/\/$/, '').toLowerCase();

    let isMatch = false;

    // Exact path match
    if (currentPathNormalized === hrefNormalized || 
        currentPathNormalized.endsWith(hrefNormalized)) {
      isMatch = true;
    }
    // Filename match
    else if (currentFile && hrefFile && currentFile.toLowerCase() === hrefFile.toLowerCase()) {
      isMatch = true;
    }
    // Dashboard special case
    else if ((currentPathNormalized === '' || 
              currentPathNormalized.endsWith('/dashboard') || 
              currentPathNormalized.endsWith('/dashboard.html')) && 
             (hrefFile === 'dashboard.html' || hrefNormalized.includes('dashboard'))) {
      isMatch = true;
    }
    // Check if current URL contains the href
    else if (currentPath.toLowerCase().includes(href.replace(/^\.\.\//g, '').replace(/^\.\//g, '').toLowerCase())) {
      isMatch = true;
    }

    if (isMatch) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
      
      // If it's a tool link, ensure Tools submenu is open
      const isToolLink = link.classList.contains('sidebar-submenu-link');
      if (isToolLink) {
        const toolsMenuItem = link.closest('.sidebar-menu-item-submenu');
        if (toolsMenuItem) {
          toolsMenuItem.classList.add('is-open');
          const toggle = toolsMenuItem.querySelector('.sidebar-submenu-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
            localStorage.setItem('sidebar-tools-open', 'true');
          }
        }
      }
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}

// Re-initialize on window resize (for desktop/mobile switching)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth >= 1024) {
      initSidebar();
    }
  }, 250);
});

