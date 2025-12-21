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
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);

const storage = getStorage();

let currentUser = null;
let currentProfile = null;

// Initialize page
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadProfile();
    setupEventListeners();
  } else {
    // Should be redirected by scripts.js, but handle gracefully
    console.warn("No user authenticated");
  }
});

// Load user profile data
async function loadProfile() {
  if (!currentUser) return;

  try {
    // Load profile from Firestore
    const profileRef = doc(db, "users", currentUser.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    
    currentProfile = profileSnap.exists() ? profileSnap.data() : {};
    
    // Display current email
    $("currentEmail").textContent = currentUser.email || "—";
    
    // Display current name if name field exists
    if ($("userName")) {
      $("userName").value = currentProfile.name || currentUser.displayName || "";
    }
    
    // Display profile picture or initials
    await displayProfilePicture();
    
  } catch (err) {
    console.error("Error loading profile:", err);
    showError("logoError", "Failed to load profile.");
  }
}

// Display profile picture or initials
async function displayProfilePicture() {
  const avatarImage = $("avatarImage");
  const avatarInitials = $("avatarInitials");
  const removeBtn = $("removeLogoBtn");
  
  // Get logo URL from profile or auth user photoURL
  let logoUrl = currentProfile?.logoUrl || currentUser.photoURL;
  
  if (logoUrl) {
    avatarImage.src = logoUrl;
    avatarImage.style.display = "block";
    avatarInitials.style.display = "none";
    removeBtn.style.display = "block";
  } else {
    avatarImage.style.display = "none";
    avatarInitials.style.display = "flex";
    
    // Generate initials from profile name, displayName, or email
    const profileName = currentProfile?.name || "";
    const displayName = currentUser.displayName || "";
    const email = currentUser.email || "";
    
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
    removeBtn.style.display = "none";
  }
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
    
    // Update auth profile photoURL
    await updateProfile(currentUser, {
      photoURL: downloadURL
    });
    
    // Reload profile
    await loadProfile();
    
    // Refresh header avatar if available
    if (typeof window.updateHeaderAvatar === 'function') {
      await window.updateHeaderAvatar(currentUser);
    }
    
    showMsg("logoMsg", "Logo uploaded successfully!", false);
    $("logoForm").reset();
    
  } catch (err) {
    console.error("Logo upload error:", err);
    showError("logoError", getFriendlyError(err));
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
  
  return message;
}

