// signup.js
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth } from "./config.js";

const form = document.getElementById("signupForm");
const emailEl = document.getElementById("signupEmail");
const passEl = document.getElementById("signupPassword");
const errorEl = document.getElementById("signupError");

function setError(text) {
  errorEl.textContent = text || "";
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/email-already-in-use") return "That email is already in use. Try logging in instead.";
  if (code === "auth/weak-password") return "Password is too weak. Use at least 6 characters.";
  if (code === "auth/operation-not-allowed") return "Email/password sign-up is not enabled in Firebase Auth.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a bit and try again.";
  return err?.message || "Sign up failed. Please try again.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");

  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Optional: set a displayName from the email prefix (safe default)
    const displayName = email.split("@")[0]?.slice(0, 40) || "";
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    // Redirect after successful signup
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    setError(friendlyAuthError(err));
  }
});
