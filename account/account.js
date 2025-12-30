// account.js
// My Account page - Profile picture, email, and password management

import { auth, db } from "../config.js";

import {
  updateEmail,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);

import { storage } from "../config.js";
import { 
  loadUserProfile, 
  saveUserProfile, 
  validatePhone, 
  validateZip, 
  validateState, 
  validateTIN,
  getUSStates 
} from "../profile-utils.js";

let currentUser = null;
let currentProfile = null;
let userProfileData = null; // Stores standardized profile from users/{uid}

// Initialize page
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadProfile();
    setupEventListeners();
    
    // Initialize prequalification status and uploads
    if (typeof window.loadPrequalStatus === 'function' && typeof window.updatePrequalUI === 'function') {
      const prequalData = await window.loadPrequalStatus(user.uid);
      await window.updatePrequalUI(prequalData, user.uid);
    }
    
    // Initialize Business License and Workers Comp uploads
    if (typeof window.initBusinessLicenseUpload === 'function') {
      await window.initBusinessLicenseUpload(user);
    }
    if (typeof window.initWorkersCompUpload === 'function') {
      await window.initWorkersCompUpload(user);
    }
  } else {
    // Should be redirected by scripts.js, but handle gracefully
    console.warn("No user authenticated");
  }
});

// Load user profile data
async function loadProfile() {
  if (!currentUser) return;

  try {
    // Load standardized profile from users/{uid}
    userProfileData = await loadUserProfile(currentUser.uid);
    
    // Also load legacy profile from private/profile for backward compatibility
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    currentProfile = profileSnap.exists() ? profileSnap.data() : {};
    
    // Display current email
    $("currentEmail").textContent = currentUser.email || "—";
    
    // Display current name if name field exists
    if ($("userName")) {
      $("userName").value = currentProfile.name || userProfileData?.companyName || currentUser.displayName || "";
    }
    
    // Populate contact & address fields
    if ($("profilePhoneNumber")) {
      $("profilePhoneNumber").value = userProfileData?.phoneNumber || "";
    }
    if ($("profileAddressStreet")) {
      $("profileAddressStreet").value = userProfileData?.address?.street || "";
    }
    if ($("profileAddressCity")) {
      $("profileAddressCity").value = userProfileData?.address?.city || "";
    }
    if ($("profileAddressState")) {
      // Populate state dropdown
      const stateSelect = $("profileAddressState");
      if (stateSelect && stateSelect.options.length <= 1) {
        const states = getUSStates();
        states.forEach(state => {
          const option = document.createElement("option");
          option.value = state.code;
          option.textContent = state.name;
          stateSelect.appendChild(option);
        });
      }
      if (userProfileData?.address?.state) {
        stateSelect.value = userProfileData.address.state;
      }
    }
    if ($("profileAddressZip")) {
      $("profileAddressZip").value = userProfileData?.address?.zip || "";
    }
    
    // Populate TIN field
    if ($("profileTaxpayerId")) {
      $("profileTaxpayerId").value = userProfileData?.taxpayerId || "";
    }
    
    // Display current language preference
    const userLang = currentProfile.language || "en";
    if ($("langEnBtn") && $("langEsBtn")) {
      $("langEnBtn").setAttribute("aria-pressed", userLang === "en" ? "true" : "false");
      $("langEsBtn").setAttribute("aria-pressed", userLang === "es" ? "true" : "false");
    }
    
    // Display profile picture or initials
    await displayProfilePicture();
    
    // Populate summary stat cards
    updateSummaryCards();
    
  } catch (err) {
    console.error("Error loading profile:", err);
    showError("logoError", "Failed to load profile.");
  }
}

// Update summary stat cards with user data
function updateSummaryCards() {
  if (!currentUser) return;
  
  // Email stat card
  const emailEl = $("statCardEmail");
  if (emailEl) {
    emailEl.textContent = currentUser.email || "—";
  }
  
  // Email verified badge
  const emailVerifiedEl = $("statCardEmailVerified");
  if (emailVerifiedEl && currentUser.emailVerified) {
    emailVerifiedEl.style.display = "inline-flex";
  } else if (emailVerifiedEl) {
    emailVerifiedEl.style.display = "none";
  }
  
  // Language stat card
  const langEl = $("statCardLanguage");
  if (langEl) {
    const userLang = currentProfile?.language || "en";
    langEl.textContent = userLang === "es" ? "Español" : "English";
  }
  
  // Member Since stat card
  const memberSinceEl = $("statCardMemberSince");
  if (memberSinceEl && currentUser.metadata?.creationTime) {
    try {
      const creationDate = new Date(currentUser.metadata.creationTime);
      const options = { year: 'numeric', month: 'short' };
      memberSinceEl.textContent = creationDate.toLocaleDateString('en-US', options);
    } catch (err) {
      memberSinceEl.textContent = "—";
    }
  } else if (memberSinceEl) {
    memberSinceEl.textContent = "—";
  }
  
  // Last updated (optional, only show if available)
  const lastUpdatedEl = $("accountLastUpdated");
  if (lastUpdatedEl && currentProfile?.updatedAt) {
    try {
      // If updatedAt is a Firestore timestamp, convert it
      let updatedDate;
      if (currentProfile.updatedAt?.toDate) {
        updatedDate = currentProfile.updatedAt.toDate();
      } else if (currentProfile.updatedAt?.seconds) {
        updatedDate = new Date(currentProfile.updatedAt.seconds * 1000);
      } else {
        updatedDate = new Date(currentProfile.updatedAt);
      }
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      lastUpdatedEl.textContent = `Last updated: ${updatedDate.toLocaleDateString('en-US', options)}`;
      lastUpdatedEl.style.display = "block";
    } catch (err) {
      lastUpdatedEl.style.display = "none";
    }
  } else if (lastUpdatedEl) {
    lastUpdatedEl.style.display = "none";
  }
}

// Display profile picture or initials
async function displayProfilePicture(logoUrlOverride = null) {
  const avatarImage = $("avatarImage");
  const avatarInitials = $("avatarInitials");
  const removeBtn = $("removeLogoBtn");
  
  if (!avatarImage || !avatarInitials) {
    console.warn("Avatar elements not found");
    return;
  }
  
  // Get logo URL from override, profile, or auth user photoURL
  let logoUrl = logoUrlOverride || currentProfile?.logoUrl || currentUser?.photoURL;
  
  if (logoUrl) {
    // Add cache-busting query parameter to ensure fresh load
    const cacheBuster = logoUrl.includes('?') ? '&' : '?';
    const urlWithCache = logoUrl + cacheBuster + '_t=' + Date.now();
    
    // Set up image load handlers
    avatarImage.onload = () => {
      avatarImage.style.display = "block";
      avatarInitials.style.display = "none";
      if (removeBtn) removeBtn.style.display = "block";
    };
    
    avatarImage.onerror = () => {
      console.warn("Failed to load logo image, falling back to initials");
      avatarImage.style.display = "none";
      avatarInitials.style.display = "flex";
      if (removeBtn) removeBtn.style.display = "none";
      // Try to show initials
      showInitials(avatarInitials);
    };
    
    // Set the source (this will trigger onload or onerror)
    avatarImage.src = urlWithCache;
    
    // Optimistically show the image (in case onload doesn't fire immediately)
    avatarImage.style.display = "block";
    avatarInitials.style.display = "none";
    if (removeBtn) removeBtn.style.display = "block";
  } else {
    avatarImage.style.display = "none";
    avatarInitials.style.display = "flex";
    if (removeBtn) removeBtn.style.display = "none";
    showInitials(avatarInitials);
  }
}

// Helper function to show initials
function showInitials(avatarInitials) {
  if (!avatarInitials) return;
  
  // Generate initials from profile name, displayName, or email
  const profileName = currentProfile?.name || "";
  const displayName = currentUser?.displayName || "";
  const email = currentUser?.email || "";
  
  let initials = "";
  const nameToUse = profileName || displayName;
  if (nameToUse) {
    // Use name initials
    const parts = nameToUse.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts[0]) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }
  }
  
  if (!initials && email) {
    // Use email initials (first letter before @)
    initials = email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "");
  }
  
  if (!initials) {
    initials = "??";
  }
  
  avatarInitials.textContent = initials;
}

// Get user initials helper
function getUserInitials(user) {
  if (user.displayName) {
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts[0]) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "");
  }
  
  return "??";
}

// Setup event listeners
function setupEventListeners() {
  // Logo upload form
  $("logoForm").addEventListener("submit", handleLogoUpload);
  
  // Remove logo button
  $("removeLogoBtn").addEventListener("click", handleRemoveLogo);
  
  // Name update form
  if ($("nameForm")) {
    $("nameForm").addEventListener("submit", handleNameUpdate);
  }
  
  // Email update form
  $("emailForm").addEventListener("submit", handleEmailUpdate);
  
  // Password update form
  $("passwordForm").addEventListener("submit", handlePasswordUpdate);
  
  // Contact & Address form
  if ($("contactForm")) {
    $("contactForm").addEventListener("submit", handleContactUpdate);
  }
  
  // Tax Information form
  if ($("taxForm")) {
    $("taxForm").addEventListener("submit", handleTaxUpdate);
  }
  
  // Language preference buttons (Settings page only)
  // Stop propagation to prevent global handler from also firing
  if ($("langEnBtn")) {
    $("langEnBtn").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent global handler from firing
      handleLanguageChange("en");
    });
  }
  if ($("langEsBtn")) {
    $("langEsBtn").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent global handler from firing
      handleLanguageChange("es");
    });
  }
}

// Handle logo upload
async function handleLogoUpload(e) {
  e.preventDefault();
  
  const fileInput = $("logoFile");
  const file = fileInput?.files?.[0];
  
  if (!file) {
    showError("logoError", "Please select a file to upload.");
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith("image/")) {
    showError("logoError", "Please select an image file.");
    return;
  }
  
  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    showError("logoError", "File size must be less than 5MB.");
    return;
  }
  
  const btn = $("logoUploadBtn");
  const oldDisabled = btn.disabled;
  
  // Create preview URL for immediate display (before upload completes)
  let previewUrl = null;
  try {
    previewUrl = URL.createObjectURL(file);
    // Show preview immediately
    await displayProfilePicture(previewUrl);
  } catch (previewErr) {
    console.warn("Could not create preview:", previewErr);
  }
  
  try {
    btn.disabled = true;
    clearMessages("logo");
    showMsg("logoMsg", "Uploading logo...");
    
    // Upload to Firebase Storage
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = Date.now();
    const filePath = `users/${currentUser.uid}/profile/logo_${timestamp}_${safeName}`;
    const storageRef = ref(storage, filePath);
    
    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg"
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    // Delete old logo if it exists
    if (currentProfile?.logoPath) {
      try {
        const oldRef = ref(storage, currentProfile.logoPath);
        await deleteObject(oldRef);
      } catch (err) {
        console.warn("Could not delete old logo:", err);
        // Continue even if deletion fails
      }
    }
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      logoUrl: downloadURL,
      logoPath: filePath,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update current profile object immediately
    if (!currentProfile) currentProfile = {};
    currentProfile.logoUrl = downloadURL;
    currentProfile.logoPath = filePath;
    
    // Update auth profile photoURL
    await updateProfile(currentUser, {
      photoURL: downloadURL
    });
    
    // Revoke preview URL to free memory
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    // Display the uploaded logo immediately (don't wait for full reload)
    await displayProfilePicture(downloadURL);
    
    // Reload profile to ensure consistency
    await loadProfile();
    
    // Refresh header avatar if available
    if (typeof window.updateHeaderAvatar === 'function') {
      await window.updateHeaderAvatar(currentUser);
    }
    
    // Update summary cards
    updateSummaryCards();
    
    showMsg("logoMsg", "Logo uploaded successfully!", false);
    $("logoForm").reset();
    
  } catch (err) {
    console.error("Logo upload error:", err);
    showError("logoError", getFriendlyError(err));
    
    // Revoke preview URL on error
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    // Restore previous logo display
    await displayProfilePicture();
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Handle remove logo
async function handleRemoveLogo() {
  if (!confirm("Are you sure you want to remove your logo?")) {
    return;
  }
  
  try {
    clearMessages("logo");
    showMsg("logoMsg", "Removing logo...");
    
    // Delete from Storage
    if (currentProfile?.logoPath) {
      try {
        const storageRef = ref(storage, currentProfile.logoPath);
        await deleteObject(storageRef);
      } catch (err) {
        console.warn("Could not delete logo from storage:", err);
      }
    }
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      logoUrl: null,
      logoPath: null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update auth profile
    await updateProfile(currentUser, {
      photoURL: null
    });
    
    // Reload profile
    await loadProfile();
    
    // Refresh header avatar if available
    if (typeof window.updateHeaderAvatar === 'function') {
      await window.updateHeaderAvatar(currentUser);
    }
    
    showMsg("logoMsg", "Logo removed successfully!", false);
    
  } catch (err) {
    console.error("Remove logo error:", err);
    showError("logoError", getFriendlyError(err));
  }
}

// Handle name update
async function handleNameUpdate(e) {
  e.preventDefault();
  
  const name = $("userName").value.trim();
  
  if (!name) {
    showError("nameError", "Please enter your name.");
    return;
  }
  
  const btn = $("nameUpdateBtn");
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages("name");
    showMsg("nameMsg", "Updating name...");
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      name: name,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update auth displayName
    await updateProfile(currentUser, {
      displayName: name
    });
    
    // Reload profile
    await loadProfile();
    
    // Refresh header avatar if available
    if (typeof window.updateHeaderAvatar === 'function') {
      await window.updateHeaderAvatar(currentUser);
    }
    
    // Update summary cards
    updateSummaryCards();
    
    showMsg("nameMsg", "Name updated successfully!", false);
    
  } catch (err) {
    console.error("Name update error:", err);
    showError("nameError", getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Handle email update
async function handleEmailUpdate(e) {
  e.preventDefault();
  
  const newEmail = $("newEmail").value.trim();
  const password = $("emailPassword").value;
  
  if (!newEmail) {
    showError("emailError", "Please enter a new email address.");
    return;
  }
  
  if (newEmail === currentUser.email) {
    showError("emailError", "This is already your current email address.");
    return;
  }
  
  if (!password) {
    showError("emailError", "Please enter your current password.");
    return;
  }
  
  const btn = $("emailUpdateBtn");
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages("email");
    showMsg("emailMsg", "Updating email...");
    
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    
    // Update email
    await updateEmail(currentUser, newEmail);
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      email: newEmail,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Reload profile
    await loadProfile();
    
    // Update summary cards
    updateSummaryCards();
    
    showMsg("emailMsg", "Email updated successfully!", false);
    $("emailForm").reset();
    
  } catch (err) {
    console.error("Email update error:", err);
    showError("emailError", getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Handle password update
async function handlePasswordUpdate(e) {
  e.preventDefault();
  
  const currentPassword = $("currentPassword").value;
  const newPassword = $("newPassword").value;
  const confirmPassword = $("confirmPassword").value;
  
  if (!currentPassword) {
    showError("passwordError", "Please enter your current password.");
    return;
  }
  
  if (!newPassword || newPassword.length < 6) {
    showError("passwordError", "New password must be at least 6 characters.");
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showError("passwordError", "New passwords do not match.");
    return;
  }
  
  if (currentPassword === newPassword) {
    showError("passwordError", "New password must be different from your current password.");
    return;
  }
  
  const btn = $("passwordUpdateBtn");
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages("password");
    showMsg("passwordMsg", "Updating password...");
    
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // Update password
    await updatePassword(currentUser, newPassword);
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      passwordUpdatedAt: serverTimestamp()
    }, { merge: true });
    
    showMsg("passwordMsg", "Password updated successfully!", false);
    $("passwordForm").reset();
    
  } catch (err) {
    console.error("Password update error:", err);
    showError("passwordError", getFriendlyError(err));
  } finally {
    btn.disabled = oldDisabled;
  }
}

// Helper functions
function showMsg(id, text, isError = false) {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.className = isError ? "form-error" : "form-msg";
    el.style.display = "block";
  }
}

function showError(id, text) {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.style.display = "block";
  }
}

function clearMessages(prefix) {
  const msg = $(`${prefix}Msg`);
  const err = $(`${prefix}Error`);
  if (msg) {
    msg.textContent = "";
    msg.style.display = "none";
  }
  if (err) {
    err.textContent = "";
    err.style.display = "none";
  }
}

// Handle language change
async function handleLanguageChange(lang) {
  if (!currentUser) return;
  
  try {
    clearMessages("language");
    showMsg("languageMsg", "Updating language preference...");
    
    // Update Firestore profile
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    await setDoc(profileRef, {
      language: lang,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update current profile
    currentProfile.language = lang;
    
    // Update localStorage to ensure consistency
    localStorage.setItem("listo_lang", lang);
    
    // Update button states
    if ($("langEnBtn") && $("langEsBtn")) {
      $("langEnBtn").setAttribute("aria-pressed", lang === "en" ? "true" : "false");
      $("langEsBtn").setAttribute("aria-pressed", lang === "es" ? "true" : "false");
    }
    
    // Apply translations immediately
    if (typeof window.applyTranslations === 'function') {
      window.applyTranslations(lang);
    }
    
    // Update summary cards
    updateSummaryCards();
    
    showMsg("languageMsg", "Language preference updated successfully!", false);
    
  } catch (err) {
    console.error("Language update error:", err);
    showError("languageError", getFriendlyError(err));
  }
}

// Handle contact & address update
async function handleContactUpdate(e) {
  e.preventDefault();
  
  const phoneNumber = ($("profilePhoneNumber")?.value || "").trim();
  const addressStreet = ($("profileAddressStreet")?.value || "").trim();
  const addressCity = ($("profileAddressCity")?.value || "").trim();
  const addressState = ($("profileAddressState")?.value || "").trim().toUpperCase();
  const addressZip = ($("profileAddressZip")?.value || "").trim();
  
  // Validation
  if (!phoneNumber) {
    showError("contactError", "Please enter your phone number.");
    return;
  }
  if (!validatePhone(phoneNumber)) {
    showError("contactError", "Please enter a valid phone number (at least 10 digits).");
    return;
  }
  if (!addressStreet) {
    showError("contactError", "Please enter your street address.");
    return;
  }
  if (!addressCity) {
    showError("contactError", "Please enter your city.");
    return;
  }
  if (!addressState) {
    showError("contactError", "Please select your state.");
    return;
  }
  if (!validateState(addressState)) {
    showError("contactError", "Please select a valid state.");
    return;
  }
  if (!addressZip) {
    showError("contactError", "Please enter your ZIP code.");
    return;
  }
  if (!validateZip(addressZip)) {
    showError("contactError", "Please enter a valid ZIP code (5 digits or 5+4 format).");
    return;
  }
  
  const btn = $("contactUpdateBtn");
  if (!btn) {
    showError("contactError", "Form button not found. Please refresh the page.");
    return;
  }
  
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages("contact");
    showMsg("contactMsg", "Saving contact & address...");
    
    // Load existing profile data to merge
    const existingProfile = userProfileData || {};
    
    // Update profile
    await saveUserProfile(currentUser.uid, {
      ...existingProfile,
      phoneNumber,
      address: {
        street: addressStreet,
        city: addressCity,
        state: addressState,
        zip: addressZip
      }
    });
    
    // Reload profile
    await loadProfile();
    
    showMsg("contactMsg", "Contact & address updated successfully!", false);
    
  } catch (err) {
    console.error("Contact update error:", err);
    showError("contactError", getFriendlyError(err));
  } finally {
    if (btn) btn.disabled = oldDisabled;
  }
}

// Handle tax information update
async function handleTaxUpdate(e) {
  e.preventDefault();
  
  const taxpayerId = ($("profileTaxpayerId")?.value || "").trim();
  
  // Validation (TIN is optional, but if provided must be valid)
  if (taxpayerId && !validateTIN(taxpayerId)) {
    showError("taxError", "Please enter a valid TIN (9 digits when dashes are removed).");
    return;
  }
  
  const btn = $("taxUpdateBtn");
  if (!btn) {
    showError("taxError", "Form button not found. Please refresh the page.");
    return;
  }
  
  const oldDisabled = btn.disabled;
  
  try {
    btn.disabled = true;
    clearMessages("tax");
    showMsg("taxMsg", "Saving tax information...");
    
    // Load existing profile data to merge
    const existingProfile = userProfileData || {};
    
    // Update profile (only taxpayerId field)
    await saveUserProfile(currentUser.uid, {
      ...existingProfile,
      taxpayerId: taxpayerId || null // Save null if empty to clear it
    });
    
    // Reload profile
    await loadProfile();
    
    showMsg("taxMsg", "Tax information updated successfully!", false);
    
  } catch (err) {
    console.error("Tax update error:", err);
    showError("taxError", getFriendlyError(err));
  } finally {
    if (btn) btn.disabled = oldDisabled;
  }
}

function getFriendlyError(err) {
  const code = err?.code || "";
  const message = err?.message || "An error occurred.";
  
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Incorrect password. Please try again.";
  }
  if (code === "auth/email-already-in-use") {
    return "This email address is already in use.";
  }
  if (code === "auth/invalid-email") {
    return "Invalid email address.";
  }
  if (code === "auth/weak-password") {
    return "Password is too weak. Please use a stronger password.";
  }
  if (code === "auth/requires-recent-login") {
    return "Please log out and log back in before changing sensitive information.";
  }
  if (code === "permission-denied") {
    return "Permission denied. Please check your account permissions.";
  }
  
  return message;
}

