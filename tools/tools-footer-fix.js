/**
 * Tools page mobile footer fix
 * Ensures footer is fully visible above bottom navigation on mobile devices
 * 
 * This script:
 * - Only runs on Tools page (data-page="tools")
 * - Only runs on mobile (viewport <= 768px)
 * - Dynamically measures bottom nav height
 * - Sets CSS variable for Tools-specific padding calculation
 * - Handles resize and orientation changes
 */

(function() {
  'use strict';

  // Early exit: Must be on Tools page
  if (!document.body || document.body.dataset.page !== 'tools') {
    return;
  }

  // Early exit: Must be mobile
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) {
    return;
  }

  /**
   * Apply Tools-specific footer spacing
   * Measures bottom nav height and sets CSS variable for padding calculation
   */
  function applyToolsFooterSpacing() {
    // Only run on mobile
    if (window.innerWidth > 768) {
      return;
    }

    // Locate bottom nav element
    const bottomNav = document.querySelector('.mobile-bottom-nav');
    if (!bottomNav) {
      return;
    }

    // Measure actual nav height
    const navHeight = bottomNav.getBoundingClientRect().height;
    if (navHeight <= 0) {
      return;
    }

    // Set Tools-specific CSS variable for padding calculation
    // This variable will be used in CSS: calc(var(--tools-bottom-nav-h, 72px) + env(safe-area-inset-bottom, 0px) + 16px)
    document.documentElement.style.setProperty('--tools-bottom-nav-h', `${navHeight}px`);
  }

  /**
   * Initialize the fix with retry logic for late-loading nav
   */
  function initToolsFooterFix() {
    // Try immediately
    applyToolsFooterSpacing();

    // Retry after short delay (nav may render late)
    setTimeout(applyToolsFooterSpacing, 250);
    
    // Retry after longer delay (for slow connections)
    setTimeout(applyToolsFooterSpacing, 1000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolsFooterFix);
  } else {
    initToolsFooterFix();
  }

  // Recalculate on resize (with debounce)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(applyToolsFooterSpacing, 100);
  });

  // Recalculate on orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(applyToolsFooterSpacing, 200); // Delay for layout recalculation
  });
})();

