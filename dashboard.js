// dashboard.js
// Dashboard page - Display account information

import { auth, db } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { ref, getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);
const storage = getStorage();

// Initialize dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadDashboardData(user);
  }
});

async function loadDashboardData(user) {
  try {
    // Load profile from Firestore
    const profileRef = doc(db, "users", user.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    // Display name
    const name = profile.name || user.displayName || "—";
    $("dashboardName").textContent = name;

    // Display email
    $("dashboardEmail").textContent = user.email || "—";

    // Display account created date
    if (user.metadata?.creationTime) {
      const createdDate = new Date(user.metadata.creationTime);
      $("dashboardCreated").textContent = createdDate.toLocaleDateString();
    } else {
      $("dashboardCreated").textContent = "—";
    }

    // Display profile picture or initials
    await displayDashboardAvatar(user, profile);

  } catch (err) {
    console.error("Error loading dashboard data:", err);
  }
}

async function displayDashboardAvatar(user, profile) {
  const avatarImage = $("dashboardAvatarImage");
  const avatarInitials = $("dashboardAvatarInitials");

  // Get logo URL from profile
  let logoUrl = profile?.logoUrl;

  if (logoUrl) {
    try {
      avatarImage.src = logoUrl;
      avatarImage.style.display = "block";
      avatarInitials.style.display = "none";
    } catch (err) {
      console.warn("Could not load avatar image:", err);
      displayInitials(user, profile);
    }
  } else {
    displayInitials(user, profile);
  }
}

function displayInitials(user, profile) {
  const avatarImage = $("dashboardAvatarImage");
  const avatarInitials = $("dashboardAvatarInitials");

  avatarImage.style.display = "none";
  avatarInitials.style.display = "flex";

  // Generate initials from name, displayName, or email
  const name = profile?.name || user.displayName || "";
  const email = user.email || "";

  let initials = "";
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts[0]) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }
  }

  if (!initials && email) {
    initials = email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "");
  }

  if (!initials) {
    initials = "??";
  }

  avatarInitials.textContent = initials;
}

