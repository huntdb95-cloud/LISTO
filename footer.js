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
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const htmlFile = pathParts[pathParts.length - 1];
  const depth = pathParts.length - 1; // Subtract 1 because last part is the HTML file
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
      <p class="site-footer-global-tagline">Built to help contractors focus on their work by automating the business side of things.</p>
      <p class="site-footer-global-copyright">Copyright 2025 Listo Co LLC</p>
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

