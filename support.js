/**
 * Support Page JavaScript
 * Minimal functionality - mainly handled by scripts.js
 */

import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize page when authenticated
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Page is ready - scripts.js handles most functionality
    console.log("Support page loaded");
  }
});

