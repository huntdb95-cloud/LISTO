// config.js (ES module)
// Initializes Firebase + exports auth/db for use across your site

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBr6b0E8GN3svOILHgO2agCkW2VsJQIrdM",
  authDomain: "listo-c6a60.firebaseapp.com",
  projectId: "listo-c6a60",
  storageBucket: "listo-c6a60.firebasestorage.app",
  messagingSenderId: "646269984812",
  appId: "1:646269984812:web:6053f752c0d3c74f653189",
  measurementId: "G-HGZS09TX8G"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
