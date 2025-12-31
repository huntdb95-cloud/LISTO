// login.js
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "../config.js";

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");

function setMsg(text) {
  msg.textContent = text || "";
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  const lang = localStorage.getItem("listo_lang") || "en";
  const i18n = window.I18N?.[lang] || window.ListoI18n?.I18N?.[lang] || {};
  
  if (code === "auth/invalid-email") return i18n["auth.error.invalidEmail"] || "Please enter a valid email address.";
  if (code === "auth/invalid-credential") return i18n["auth.error.invalidCredential"] || "Incorrect email or password.";
  if (code === "auth/user-disabled") return i18n["auth.error.userDisabled"] || "This account has been disabled.";
  if (code === "auth/too-many-requests") return i18n["auth.error.tooManyRequests"] || "Too many attempts. Please wait a bit and try again.";
  return err?.message || i18n["auth.error.loginFailed"] || "Login failed. Please try again.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    
    // Show login animation
    const animation = document.getElementById("loginAnimation");
    if (animation) {
      animation.style.display = "flex";
    }
    
    // Wait for animation to show, then redirect
    setTimeout(() => {
      // Check for next parameter or default to dashboard
      const urlParams = new URLSearchParams(window.location.search);
      let next = urlParams.get("next");
      
      // Prevent redirect loops: if next points to login page, default to dashboard
      if (next && (next.includes("/login/") || next.includes("login.html"))) {
        next = null;
      }
      
      if (next) {
        // Handle absolute paths, relative paths, and paths that already include ../
        if (next.startsWith("/")) {
          // Absolute path - prepend .. to go up from login/ directory
          // Remove leading slash and construct relative path
          const relativePath = next.substring(1); // Remove leading /
          window.location.href = `../${relativePath}`;
        } else if (next.startsWith("../") || next.startsWith("./")) {
          // Already a relative path - use as-is
          window.location.href = next;
        } else {
          // Simple filename or relative path - prepend ../
          window.location.href = `../${next}`;
        }
      } else {
        window.location.href = "../dashboard.html";
      }
    }, 1500); // Show animation for 1.5 seconds
  } catch (err) {
    console.error(err);
    setMsg(friendlyAuthError(err));
    // Hide animation if there was an error
    const animation = document.getElementById("loginAnimation");
    if (animation) {
      animation.style.display = "none";
    }
  }
});
