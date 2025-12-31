// forgot.js
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "../config.js";

// ✅ Dynamically use current domain (works with both listonow.com and golisto.net)
// Primary domain: listonow.com (also works with golisto.net via GoDaddy redirect)
const DOMAIN = window.location.origin; // Automatically uses current domain
const LOGIN_URL = `${DOMAIN}/login/login.html`;

const form = document.getElementById("forgotForm");
const msg = document.getElementById("forgotMsg");
const emailEl = document.getElementById("email");

function setMsg(text, isSuccess = false) {
  msg.textContent = text || "";
  msg.classList.remove("success", "danger");
  if (text) msg.classList.add(isSuccess ? "success" : "danger");
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  const lang = localStorage.getItem("listo_lang") || "en";
  const i18n = window.I18N?.[lang] || window.ListoI18n?.I18N?.[lang] || {};
  
  if (code === "auth/invalid-email") return i18n["auth.error.invalidEmail"] || "Please enter a valid email address.";
  if (code === "auth/user-not-found") {
    // Security-friendly: don't confirm whether the email exists
    return i18n["auth.error.userNotFound"] || "If an account exists for that email, a reset link will be sent.";
  }
  if (code === "auth/too-many-requests") return i18n["auth.error.tooManyRequests"] || "Too many attempts. Please wait a bit and try again.";
  return err?.message || i18n["auth.error.resetFailed"] || "Could not send reset email. Please try again.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = (emailEl.value || "").trim();

  try {
    const actionCodeSettings = {
      url: LOGIN_URL,
      handleCodeInApp: false,
    };

    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    const lang = localStorage.getItem("listo_lang") || "en";
    const i18n = window.I18N?.[lang] || window.ListoI18n?.I18N?.[lang] || {};
    setMsg(i18n["auth.error.resetSent"] || "If an account exists for that email, a reset link has been sent.", true);

    // Optional: disable submit to prevent spam-clicking
    const btn = form.querySelector("button[type='submit']");
    if (btn) btn.disabled = true;
  } catch (err) {
    console.error(err);
    setMsg(friendlyAuthError(err), false);
  }
});
