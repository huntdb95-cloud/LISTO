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
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/invalid-credential") return "Incorrect email or password.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a bit and try again.";
  return err?.message || "Login failed. Please try again.";
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
      const next = urlParams.get("next");
      if (next) {
        // Handle absolute paths, relative paths, and paths that already include ../
        if (next.startsWith("/")) {
          // Absolute path - prepend .. to go up from login/ directory
          window.location.href = `..${next}`;
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
