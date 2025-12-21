// forgot.js
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "../config.js";

// ✅ Set this to your real deployed domain:
const DOMAIN = "https://golisto.net"; // or "https://golist.net"
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
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/user-not-found") {
    // Security-friendly: don't confirm whether the email exists
    return "If an account exists for that email, a reset link will be sent.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a bit and try again.";
  return err?.message || "Could not send reset email. Please try again.";
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

    setMsg("If an account exists for that email, a reset link has been sent.", true);

    // Optional: disable submit to prevent spam-clicking
    const btn = form.querySelector("button[type='submit']");
    if (btn) btn.disabled = true;
  } catch (err) {
    console.error(err);
    setMsg(friendlyAuthError(err), false);
  }
});
