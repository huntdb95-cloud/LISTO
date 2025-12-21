// login.js
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "../config.js";

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");

function setMsg(text) {
  msg.textContent = text || "";
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/invalid-credential") return "Incorrect email or password.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a bit and try again.";
  return err?.message || "Login failed. Please try again.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Check for next parameter or default to dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const next = urlParams.get("next");
    if (next) {
      window.location.href = next.startsWith("/") ? `..${next}` : `../${next}`;
    } else {
      window.location.href = "../dashboard.html";
    }
  } catch (err) {
    console.error(err);
    setMsg(friendlyAuthError(err));
  }
});
