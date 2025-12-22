// signup.js
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "../config.js";

const form = document.getElementById("signupForm");
const displayNameEl = document.getElementById("displayName");
const emailEl = document.getElementById("signupEmail");
const passEl = document.getElementById("signupPassword");
const errorEl = document.getElementById("signupError");

function setError(text) {
  errorEl.textContent = text || "";
}

function cleanName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
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

  const displayName = cleanName(displayNameEl?.value);
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";
  const acceptTerms = document.getElementById("acceptTerms")?.checked;

  if (!displayName) {
    setError("Please enter a company / display name.");
    return;
  }
  if (displayName.length > 80) {
    setError("Display name is too long (max 80 characters).");
    return;
  }
  if (!acceptTerms) {
    setError("You must accept the Terms and Conditions to create an account.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Set Auth profile display name
    await updateProfile(cred.user, { displayName });

    // Store a profile doc in Firestore: /users/{uid}/profile/main
    await setDoc(doc(db, "users", cred.user.uid, "profile", "main"), {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      email,
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    window.location.href = "../index.html";
  } catch (err) {
    console.error(err);
    setError(friendlyAuthError(err));
  }
});
