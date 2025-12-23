// signup.js
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "../config.js";
import { saveUserProfile, validatePhone, validateZip, validateState, getUSStates } from "../profile-utils.js";

const form = document.getElementById("signupForm");
const displayNameEl = document.getElementById("displayName");
const emailEl = document.getElementById("signupEmail");
const passEl = document.getElementById("signupPassword");
const confirmPassEl = document.getElementById("confirmPassword");
const phoneNumberEl = document.getElementById("phoneNumber");
const addressStreetEl = document.getElementById("addressStreet");
const addressCityEl = document.getElementById("addressCity");
const addressStateEl = document.getElementById("addressState");
const addressZipEl = document.getElementById("addressZip");
const errorEl = document.getElementById("signupError");

// Populate state dropdown
const states = getUSStates();
states.forEach(state => {
  const option = document.createElement("option");
  option.value = state.code;
  option.textContent = state.name;
  addressStateEl.appendChild(option);
});

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
  const confirmPassword = confirmPassEl?.value || "";
  const acceptTerms = document.getElementById("acceptTerms")?.checked;
  
  // Get address fields
  const phoneNumber = (phoneNumberEl?.value || "").trim();
  const addressStreet = (addressStreetEl?.value || "").trim();
  const addressCity = (addressCityEl?.value || "").trim();
  const addressState = (addressStateEl?.value || "").trim().toUpperCase();
  const addressZip = (addressZipEl?.value || "").trim();

  // Validation
  if (!displayName) {
    setError("Please enter a company / display name.");
    return;
  }
  if (displayName.length > 80) {
    setError("Display name is too long (max 80 characters).");
    return;
  }
  if (password !== confirmPassword) {
    setError("Passwords do not match. Please try again.");
    return;
  }
  if (!acceptTerms) {
    setError("You must accept the Terms and Conditions to create an account.");
    return;
  }
  
  // Validate required profile fields
  if (!phoneNumber) {
    setError("Please enter your phone number.");
    return;
  }
  if (!validatePhone(phoneNumber)) {
    setError("Please enter a valid phone number (at least 10 digits).");
    return;
  }
  if (!addressStreet) {
    setError("Please enter your street address.");
    return;
  }
  if (!addressCity) {
    setError("Please enter your city.");
    return;
  }
  if (!addressState) {
    setError("Please select your state.");
    return;
  }
  if (!validateState(addressState)) {
    setError("Please select a valid state.");
    return;
  }
  if (!addressZip) {
    setError("Please enter your ZIP code.");
    return;
  }
  if (!validateZip(addressZip)) {
    setError("Please enter a valid ZIP code (5 digits or 5+4 format).");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Set Auth profile display name
    await updateProfile(cred.user, { displayName });

    // Store profile in Firestore at users/{uid}
    // Use the standardized profile structure
    await saveUserProfile(cred.user.uid, {
      companyName: displayName,
      email,
      phoneNumber,
      address: {
        street: addressStreet,
        city: addressCity,
        state: addressState,
        zip: addressZip
      }
      // Note: taxpayerId is NOT set at signup - user adds it later in Settings
    });

    // Also keep the legacy profile/main doc for backward compatibility if needed
    await setDoc(doc(db, "users", cred.user.uid, "profile", "main"), {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      email,
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    window.location.href = "../dashboard.html";
  } catch (err) {
    console.error(err);
    setError(friendlyAuthError(err));
  }
});
