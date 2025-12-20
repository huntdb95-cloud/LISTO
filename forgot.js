// forgot.js
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./config.js";

const form = document.getElementById("forgotForm");
const msg = document.getElementById("forgotMsg");
const emailEl = document.getElementById("email");

function setMsg(text, isSuccess = false) {
  msg.textContent = text || "";
  // Reuse your existing classes (form-error is red). If success, style green.
  msg.classList.remove("success", "danger");
  if (text) msg.classList.add(isSuccess ? "success" : "danger");
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/user-not-found") {
    // You can either show this directly or keep it generic for security.
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
    // Optional: If you want reset links to send them back to your login page,
    // you can configure this in Firebase Console or pass actionCodeSettings.
    await sendPasswordResetEmail(auth, email);

    // Security-friendly success message (doesn't confirm account existence)
    setMsg("If an account exists for that email, a reset link has been sent.", true);

    // Optional: disable form to prevent repeated sends
    form.querySelector("button[type='submit']").disabled = true;
  } catch (err) {
    console.error(err);
    setMsg(friendlyAuthError(err), false);
  }
});
