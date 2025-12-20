// scripts.js (ES Module)
import { firebaseConfig } from "./config.js";

// Firebase modular SDK via CDN (version noted in Firebase release notes)
// You can bump the version later if desired. :contentReference[oaicite:3]{index=3}
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

// (Next phase we’ll add Firestore + Storage imports)
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
// import { getStorage } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";

/* ========= i18n ========= */
const I18N = {
  en: {
    "nav.menu": "Menu",
    "nav.home": "Home",
    "nav.prequal": "Pre-Qualification",
    "nav.payroll": "Payroll",
    "nav.audit": "Insurance Audit Help",
    "nav.directory": "Directory",

    "hero.title": "Get pre-qualified. Get paid. Get picked.",
    "hero.subtitle": "Listo helps subcontractors complete onboarding requirements, stay audit-ready, and build a profile general contractors can trust.",
    "hero.ctaPrimary": "Start Pre-Qualification",
    "hero.ctaSecondary": "Explore the Directory",
    "hero.pill1": "W-9 Completed",
    "hero.pill2": "Active COI Uploaded",
    "hero.pill3": "Subcontractor Agreement Signed",

    "card.prequalTitle": "Pre-Qualification Checklist",
    "card.prequalDesc": "Complete these to earn a “Pre-Qualified” status.",
    "card.itemW9": "Fill out a W-9",
    "card.itemCOI": "Upload Certificate of Insurance (COI)",
    "card.itemAgreement": "Sign Subcontractor Agreement",
    "card.open": "Open",
    "card.goPrequal": "Go to Pre-Qualification",

    "features.title": "Tools built for subcontractors",
    "features.subtitle": "Simple workflows that help you stay compliant and look professional to GCs.",
    "features.f1Title": "Pre-Qualification Portal",
    "features.f1Desc": "One place to complete your W-9, upload your COI, and sign agreements.",
    "features.f2Title": "Payroll Tracker",
    "features.f2Desc": "Record payment date, employee name, amount paid, and work type—export-ready.",
    "features.f3Title": "Insurance Audit Helper",
    "features.f3Desc": "Know what to expect and upload key documents like Schedule C, bank statements, and payroll summaries.",
    "features.openTool": "Open tool →",

    "how.title": "How Listo works",
    "how.s1Title": "Complete onboarding",
    "how.s1Desc": "W-9 + COI + Agreement → earn Pre-Qualified status.",
    "how.s2Title": "Stay organized",
    "how.s2Desc": "Track payroll and keep records consistent all year.",
    "how.s3Title": "Be audit-ready",
    "how.s3Desc": "Upload audit documents and understand what the carrier checks.",

    "footer.note": "Built to help subcontractors look sharp, stay compliant, and win more work.",

    "auth.loginTitle": "Welcome back",
    "auth.loginSubtitle": "Log in to access your Listo workspace.",
    "auth.signupTitle": "Create your account",
    "auth.signupSubtitle": "Use email + password to get started.",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.loginBtn": "Log In",
    "auth.createBtn": "Create Account",
    "auth.noAccount": "No account?",
    "auth.goSignup": "Create one",
    "auth.haveAccount": "Already have an account?",
    "auth.goLogin": "Log in",
    "auth.sideTitle": "Private. Secure. Built for onboarding.",
    "auth.sideBody": "Your documents and uploads are protected behind your login.",
    "auth.logout": "Log out"
  },

  es: {
    "nav.menu": "Menú",
    "nav.home": "Inicio",
    "nav.prequal": "Precalificación",
    "nav.payroll": "Nómina",
    "nav.audit": "Ayuda de Auditoría de Seguro",
    "nav.directory": "Directorio",

    "hero.title": "Precalifícate. Cobra. Sé elegido.",
    "hero.subtitle": "Listo ayuda a subcontratistas a completar requisitos de incorporación, estar listos para auditorías y crear un perfil confiable para contratistas generales.",
    "hero.ctaPrimary": "Iniciar Precalificación",
    "hero.ctaSecondary": "Explorar el Directorio",
    "hero.pill1": "W-9 Completado",
    "hero.pill2": "COI Vigente Subido",
    "hero.pill3": "Contrato Firmado",

    "card.prequalTitle": "Lista de Precalificación",
    "card.prequalDesc": "Completa esto para obtener estado de “Precalificado”.",
    "card.itemW9": "Completar un W-9",
    "card.itemCOI": "Subir Certificado de Seguro (COI)",
    "card.itemAgreement": "Firmar el Acuerdo de Subcontratista",
    "card.open": "Abrir",
    "card.goPrequal": "Ir a Precalificación",

    "features.title": "Herramientas para subcontratistas",
    "features.subtitle": "Flujos simples para mantenerte en regla y verte profesional ante los contratistas generales.",
    "features.f1Title": "Portal de Precalificación",
    "features.f1Desc": "Un solo lugar para W-9, COI y firma de acuerdos.",
    "features.f2Title": "Registro de Nómina",
    "features.f2Desc": "Guarda fecha de pago, empleado, monto y tipo de trabajo—listo para exportar.",
    "features.f3Title": "Ayuda de Auditoría",
    "features.f3Desc": "Qué esperar y cómo subir documentos clave: Schedule C, estados bancarios y resúmenes de nómina.",
    "features.openTool": "Abrir herramienta →",

    "how.title": "Cómo funciona Listo",
    "how.s1Title": "Completa la incorporación",
    "how.s1Desc": "W-9 + COI + Contrato → obtén estado de Precalificado.",
    "how.s2Title": "Mantente organizado",
    "how.s2Desc": "Registra nómina y mantén tus archivos consistentes todo el año.",
    "how.s3Title": "Listo para auditoría",
    "how.s3Desc": "Sube documentos y entiende qué revisa la aseguradora.",

    "footer.note": "Diseñado para ayudar a subcontratistas a verse profesionales, cumplir requisitos y ganar más trabajo.",

    "auth.loginTitle": "Bienvenido de nuevo",
    "auth.loginSubtitle": "Inicia sesión para acceder a tu espacio de Listo.",
    "auth.signupTitle": "Crea tu cuenta",
    "auth.signupSubtitle": "Usa correo + contraseña para comenzar.",
    "auth.email": "Correo",
    "auth.password": "Contraseña",
    "auth.loginBtn": "Iniciar sesión",
    "auth.createBtn": "Crear cuenta",
    "auth.noAccount": "¿No tienes cuenta?",
    "auth.goSignup": "Crear una",
    "auth.haveAccount": "¿Ya tienes cuenta?",
    "auth.goLogin": "Inicia sesión",
    "auth.sideTitle": "Privado. Seguro. Hecho para incorporación.",
    "auth.sideBody": "Tus documentos y cargas están protegidos con tu inicio de sesión.",
    "auth.logout": "Cerrar sesión"
  }
};

const LANG_KEY = "listo_lang";
function setPressedButtons(lang) {
  document.querySelectorAll("[data-lang]").forEach(btn => {
    const isActive = btn.getAttribute("data-lang") === lang;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}
function applyTranslations(lang) {
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  setPressedButtons(lang);
  localStorage.setItem(LANG_KEY, lang);
}
function initLanguage() {
  const saved = localStorage.getItem(LANG_KEY);
  const lang = (saved && I18N[saved]) ? saved : "en";
  applyTranslations(lang);
  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => applyTranslations(btn.getAttribute("data-lang")));
  });
}

/* ========= Firebase Auth =========
   Firebase web setup + Auth start docs :contentReference[oaicite:4]{index=4}
*/
let app, auth;

function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("Missing Firebase config. Paste it into config.js");
    return false;
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  return true;
}

function getNextUrl() {
  const url = new URL(window.location.href);
  const next = url.searchParams.get("next");
  return next && next.startsWith("/") === false ? next : "index.html";
}

function requireAuthGuard(user) {
  const body = document.body;
  const requiresAuth = body?.hasAttribute("data-requires-auth");
  const page = body?.getAttribute("data-page");

  // If page requires auth and there's no user, send to login
  if (requiresAuth && !user) {
    const next = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `login.html?next=${encodeURIComponent(next)}`;
    return;
  }

  // If user is logged in and they are on login/signup, bounce to next/index
  if (user && (page === "login" || page === "signup")) {
    window.location.href = getNextUrl();
  }
}

function initAuthUI() {
  // Logout button (shows only when logged in)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn && auth) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "login.html";
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm && auth) {
    const err = document.getElementById("loginError");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.textContent = "";
      const email = document.getElementById("loginEmail")?.value?.trim();
      const password = document.getElementById("loginPassword")?.value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = getNextUrl();
      } catch (error) {
        if (err) err.textContent = readableAuthError(error);
      }
    });
  }

  // Signup form
  const signupForm = document.getElementById("signupForm");
  if (signupForm && auth) {
    const err = document.getElementById("signupError");
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.textContent = "";
      const email = document.getElementById("signupEmail")?.value?.trim();
      const password = document.getElementById("signupPassword")?.value;
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        window.location.href = "index.html";
      } catch (error) {
        if (err) err.textContent = readableAuthError(error);
      }
    });
  }
}

function readableAuthError(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/user-not-found")) return "No user found with that email.";
  if (code.includes("auth/wrong-password")) return "Incorrect password.";
  if (code.includes("auth/invalid-credential")) return "Invalid login. Check email and password.";
  if (code.includes("auth/email-already-in-use")) return "That email is already in use.";
  if (code.includes("auth/weak-password")) return "Password should be at least 6 characters.";
  return error?.message || "Something went wrong. Please try again.";
}

/* ========= Existing UI bits ========= */
function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector("#navMenu");
  if (!toggle || !menu) return;

  const setState = (open) => {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => setState(!menu.classList.contains("open")));
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setState(false)));

  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("open")) return;
    const clickedInside = menu.contains(e.target) || toggle.contains(e.target);
    if (!clickedInside) setState(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setState(false);
  });
}

function initYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  initMobileNav();
  initYear();

  // Firebase init
  if (!initFirebase()) return;

  // Watch auth state
  onAuthStateChanged(auth, (user) => {
    // Toggle logout button visibility if present
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.hidden = !user;

    // Route guard behavior
    requireAuthGuard(user);
  });

  // Attach auth handlers (login/signup/logout)
  initAuthUI();
});
