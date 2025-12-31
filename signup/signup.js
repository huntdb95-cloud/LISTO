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

// Ensure the "Select State" placeholder option has data-i18n attribute
// and translate it after population
if (addressStateEl && addressStateEl.firstElementChild) {
  const firstOption = addressStateEl.firstElementChild;
  if (firstOption && firstOption.value === "") {
    firstOption.setAttribute("data-i18n", "signup.selectState");
    // Apply translations after a short delay to ensure i18n.js has loaded
    setTimeout(() => {
      const lang = localStorage.getItem("listo_lang") || "en";
      if (typeof window.ListoI18n !== 'undefined' && typeof window.ListoI18n.applyTranslations === 'function') {
        window.ListoI18n.applyTranslations(lang);
      } else if (typeof window.applyTranslations === 'function') {
        window.applyTranslations(lang);
      }
    }, 100);
  }
}

function setError(text) {
  errorEl.textContent = text || "";
}

function cleanName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  const lang = localStorage.getItem("listo_lang") || "en";
  const i18n = window.I18N?.[lang] || window.ListoI18n?.I18N?.[lang] || {};
  
  if (code === "auth/invalid-email") return i18n["auth.error.invalidEmail"] || "Please enter a valid email address.";
  if (code === "auth/email-already-in-use") return i18n["auth.error.emailInUse"] || "That email is already in use. Try logging in instead.";
  if (code === "auth/weak-password") return i18n["auth.error.weakPassword"] || "Password is too weak. Use at least 6 characters.";
  if (code === "auth/operation-not-allowed") return i18n["auth.error.notAllowed"] || "Email/password sign-up is not enabled in Firebase Auth.";
  if (code === "auth/too-many-requests") return i18n["auth.error.tooManyRequests"] || "Too many attempts. Please wait a bit and try again.";
  return err?.message || i18n["auth.error.signupFailed"] || "Sign up failed. Please try again.";
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

  // Get current language for error messages
  const lang = localStorage.getItem("listo_lang") || "en";
  const i18n = window.I18N?.[lang] || window.ListoI18n?.I18N?.[lang] || {};
  
  // Validation
  if (!displayName) {
    setError(i18n["signup.error.noDisplayName"] || "Please enter a company / display name.");
    return;
  }
  if (displayName.length > 80) {
    setError(i18n["signup.error.displayNameTooLong"] || "Display name is too long (max 80 characters).");
    return;
  }
  if (password !== confirmPassword) {
    setError(i18n["signup.error.passwordsNotMatch"] || "Passwords do not match. Please try again.");
    return;
  }
  if (!acceptTerms) {
    setError(i18n["signup.error.mustAcceptTerms"] || "You must accept the Terms and Conditions to create an account.");
    return;
  }
  
  // Validate required profile fields
  if (!phoneNumber) {
    setError(i18n["signup.error.noPhone"] || "Please enter your phone number.");
    return;
  }
  if (!validatePhone(phoneNumber)) {
    setError(i18n["signup.error.invalidPhone"] || "Please enter a valid phone number (at least 10 digits).");
    return;
  }
  if (!addressStreet) {
    setError(i18n["signup.error.noStreet"] || "Please enter your street address.");
    return;
  }
  if (!addressCity) {
    setError(i18n["signup.error.noCity"] || "Please enter your city.");
    return;
  }
  if (!addressState) {
    setError(i18n["signup.error.noState"] || "Please select your state.");
    return;
  }
  if (!validateState(addressState)) {
    setError(i18n["signup.error.invalidState"] || "Please select a valid state.");
    return;
  }
  if (!addressZip) {
    setError(i18n["signup.error.noZip"] || "Please enter your ZIP code.");
    return;
  }
  if (!validateZip(addressZip)) {
    setError(i18n["signup.error.invalidZip"] || "Please enter a valid ZIP code (5 digits or 5+4 format).");
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
