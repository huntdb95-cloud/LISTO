// profile-utils.js
// Shared utility functions for user profile management
// Standardizes user profile data structure at: users/{uid}

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./config.js";

/**
 * Get user profile document reference
 */
export function getUserProfileDocRef(uid) {
  return doc(db, "users", uid);
}

/**
 * Load user profile from Firestore
 * Returns profile data or null if not found
 */
export async function loadUserProfile(uid) {
  if (!uid) return null;
  
  try {
    const profileRef = getUserProfileDocRef(uid);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      return profileSnap.data();
    }
    return null;
  } catch (err) {
    console.error("Error loading user profile:", err);
    throw err;
  }
}

/**
 * Save user profile to Firestore
 * Merges with existing data (use { merge: true })
 */
export async function saveUserProfile(uid, profileData) {
  if (!uid) throw new Error("User ID is required");
  
  try {
    const profileRef = getUserProfileDocRef(uid);
    const dataToSave = {
      ...profileData,
      updatedAt: serverTimestamp()
    };
    
    // Only set createdAt if document doesn't exist yet
    const existingDoc = await getDoc(profileRef);
    if (!existingDoc.exists()) {
      dataToSave.createdAt = serverTimestamp();
    }
    
    await setDoc(profileRef, dataToSave, { merge: true });
    return dataToSave;
  } catch (err) {
    console.error("Error saving user profile:", err);
    throw err;
  }
}

/**
 * Validate phone number (allows digits, spaces, parentheses, dashes)
 * Returns true if valid, false otherwise
 */
export function validatePhone(phone) {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10;
}

/**
 * Validate ZIP code (5 digits or 5+4 format)
 */
export function validateZip(zip) {
  if (!zip) return false;
  // Remove all non-digits
  const digitsOnly = zip.replace(/\D/g, "");
  // Must be 5 digits or 9 digits (5+4 format)
  return digitsOnly.length === 5 || digitsOnly.length === 9;
}

/**
 * Validate TIN (optional, but if provided must be 9 digits when dashes removed)
 */
export function validateTIN(tin) {
  if (!tin || tin.trim() === "") return true; // Optional, empty is valid
  const digitsOnly = tin.replace(/\D/g, "");
  return digitsOnly.length === 9;
}

/**
 * Validate US state code (2 letters)
 */
export function validateState(state) {
  if (!state) return false;
  const validStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC"
  ];
  return validStates.includes(state.toUpperCase());
}

/**
 * Get array of US states for dropdown
 * Returns array of { code, name } objects
 */
export function getUSStates() {
  return [
    { code: "AL", name: "Alabama" },
    { code: "AK", name: "Alaska" },
    { code: "AZ", name: "Arizona" },
    { code: "AR", name: "Arkansas" },
    { code: "CA", name: "California" },
    { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" },
    { code: "DE", name: "Delaware" },
    { code: "FL", name: "Florida" },
    { code: "GA", name: "Georgia" },
    { code: "HI", name: "Hawaii" },
    { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" },
    { code: "IN", name: "Indiana" },
    { code: "IA", name: "Iowa" },
    { code: "KS", name: "Kansas" },
    { code: "KY", name: "Kentucky" },
    { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" },
    { code: "MD", name: "Maryland" },
    { code: "MA", name: "Massachusetts" },
    { code: "MI", name: "Michigan" },
    { code: "MN", name: "Minnesota" },
    { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" },
    { code: "MT", name: "Montana" },
    { code: "NE", name: "Nebraska" },
    { code: "NV", name: "Nevada" },
    { code: "NH", name: "New Hampshire" },
    { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" },
    { code: "NY", name: "New York" },
    { code: "NC", name: "North Carolina" },
    { code: "ND", name: "North Dakota" },
    { code: "OH", name: "Ohio" },
    { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" },
    { code: "PA", name: "Pennsylvania" },
    { code: "RI", name: "Rhode Island" },
    { code: "SC", name: "South Carolina" },
    { code: "SD", name: "South Dakota" },
    { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" },
    { code: "UT", name: "Utah" },
    { code: "VT", name: "Vermont" },
    { code: "VA", name: "Virginia" },
    { code: "WA", name: "Washington" },
    { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" },
    { code: "WY", name: "Wyoming" },
    { code: "DC", name: "District of Columbia" }
  ];
}

/**
 * Format address fields into a single string for display
 */
export function formatAddress(address) {
  if (!address) return "";
  if (typeof address === "string") return address;
  
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.city) {
    const cityStateZip = [address.city];
    if (address.state) cityStateZip.push(address.state);
    if (address.zip) cityStateZip.push(address.zip);
    parts.push(cityStateZip.join(", "));
  }
  return parts.join("\n");
}

/**
 * Parse address string into structured object
 * Assumes format: "Street\nCity, State ZIP"
 */
export function parseAddress(addressStr) {
  if (!addressStr) return { street: "", city: "", state: "", zip: "" };
  
  const lines = addressStr.split("\n").map(l => l.trim()).filter(Boolean);
  const street = lines[0] || "";
  
  if (lines.length > 1) {
    // Parse "City, State ZIP" or "City State ZIP"
    const cityStateZip = lines[1];
    const match = cityStateZip.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (match) {
      return {
        street,
        city: match[1].trim(),
        state: match[2],
        zip: match[3]
      };
    }
  }
  
  return { street, city: "", state: "", zip: "" };
}

