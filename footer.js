// Global Footer Injection Script
// Injects footer on all non-auth pages and removes old footers

function injectFooter() {
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
  
  // Find the main element to insert footer into
  // Footer should be INSIDE main so it works with flexbox sticky footer layout
  const main = document.querySelector('main');
  const targetContainer = main || document.body;
  
  if (!targetContainer) {
    // If main/body don't exist yet, try again after a short delay
    setTimeout(injectFooter, 50);
    return;
  }
  
  // Create footer element
  const footer = document.createElement('footer');
  footer.className = 'site-footer-global';
  const currentYear = new Date().getFullYear();
  footer.innerHTML = `
    <div class="site-footer-global-content">
      <img src="${logoPath}" alt="Listo" class="site-footer-global-logo" />
      <p class="site-footer-global-tagline">Listo Built to help subcontractors look sharp, stay compliant, and win more work.</p>
      <p class="site-footer-global-copyright">© ${currentYear} Listo Co LLC</p>
    </div>
  `;
  
  // Always append footer to the end of main (or body if no main)
  // This ensures it appears after all content and works with sticky footer flexbox layout
  targetContainer.appendChild(footer);
}

// Run footer injection when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFooter);
} else {
  // DOM is already ready
  injectFooter();
}

