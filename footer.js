// Global Footer Injection Script
// Injects footer on all non-auth pages and removes old footers

(function() {
  // Don't inject footer on auth pages
  const isAuthPage = document.body.classList.contains('auth-page') || 
                     (document.body.hasAttribute('data-page') && 
                      ['login', 'signup', 'forgot', 'reset'].includes(document.body.getAttribute('data-page')));
  
  if (isAuthPage) {
    return; // Skip footer on auth pages
  }
  
  // Remove old footer if it exists
  const oldFooter = document.querySelector('.site-footer');
  if (oldFooter) {
    oldFooter.remove();
  }
  
  // Check if new footer already exists
  const existingFooter = document.querySelector('.site-footer-global');
  if (existingFooter) {
    return; // Footer already exists
  }
  
  // Determine logo path based on page location
  let logoPath = 'images/logo.png';
  // Adjust path for subdirectories (count directory depth)
  // pathname format: /path/to/file.html or /file.html
  // Split and filter out empty strings, then count directories (exclude HTML file)
  const pathParts = window.location.pathname.split('/').filter(p => p && !p.endsWith('.html'));
  const depth = pathParts.length; // Count only directories, excluding HTML file
  if (depth > 0) {
    logoPath = '../'.repeat(depth) + 'images/logo.png';
  }
  
  // Find the main element or app-layout to insert footer before closing tag
  const main = document.querySelector('main');
  const appLayout = document.querySelector('.app-layout');
  const targetContainer = appLayout || main || document.body;
  
  // Create footer element
  const footer = document.createElement('footer');
  footer.className = 'site-footer-global';
  footer.innerHTML = `
    <div class="site-footer-global-content">
      <img src="${logoPath}" alt="Listo" class="site-footer-global-logo" />
      <p class="site-footer-global-tagline">Listo Built to help subcontractors look sharp, stay compliant, and win more work.</p>
      <p class="site-footer-global-copyright">© 2025 Listo Co LLC</p>
    </div>
  `;
  
  // Insert footer before mobile bottom nav or at end of target container
  const mobileNav = document.querySelector('.mobile-bottom-nav');
  if (mobileNav && mobileNav.parentElement === targetContainer) {
    targetContainer.insertBefore(footer, mobileNav);
  } else if (main) {
    main.appendChild(footer);
  } else {
    targetContainer.appendChild(footer);
  }
})();

