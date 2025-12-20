// scripts.js (ES Module)
import { firebaseConfig } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";

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
    "auth.logout": "Log out",

    "prequal.title": "Pre-Qualification",
    "prequal.subtitle": "Complete the items below to earn your “Pre-Qualified” status.",
    "prequal.statusTitle": "Status",
    "prequal.statusDesc": "Your checklist updates automatically when items are completed.",
    "prequal.badge.loading": "Loading…",
    "prequal.badge.prequalified": "Pre-Qualified",
    "prequal.badge.incomplete": "Incomplete",
    "prequal.itemW9": "W-9 Completed",
    "prequal.itemW9Desc": "Fill and submit your W-9.",
    "prequal.itemCOI": "Certificate of Insurance (COI)",
    "prequal.itemCOIDesc": "Upload an active COI and set the expiration date.",
    "prequal.itemAgreement": "Subcontractor Agreement",
    "prequal.itemAgreementDesc": "Review and sign your agreement.",
    "prequal.open": "Open",
    "prequal.updated": "Last updated:",
    "prequal.whatTitle": "What “Pre-Qualified” means",
    "prequal.whatBody": "Pre-Qualified subcontractors have a completed W-9, an active COI on file, and a signed subcontractor agreement. This makes it easier for general contractors to onboard and select you for work.",
    "prequal.nextTitle": "Next steps",
    "prequal.next1": "Complete the missing items in your checklist.",
    "prequal.next2": "Keep your COI current — update it before it expires.",
    "prequal.next3": "Once pre-qualified, build your Directory profile (coming next).",
    "prequal.noteTitle": "Tip:",
    "prequal.noteBody": "You can upload a new COI anytime. The latest upload becomes your active COI.",
    "prequal.coiExpires": "Expires",

    "coi.title": "Certificate of Insurance (COI)",
    "coi.subtitle": "Upload your most recent COI and enter the expiration date.",
    "coi.uploadTitle": "Upload COI",
    "coi.fileLabel": "COI File (PDF preferred)",
    "coi.fileHint": "Accepted: PDF, PNG, JPG",
    "coi.expLabel": "Expiration date",
    "coi.uploadBtn": "Upload & Save",
    "coi.currentTitle": "Current COI on file",
    "coi.download": "Download",
    "coi.currentFile": "File",
    "coi.currentExp": "Expires",
    "coi.currentUploaded": "Uploaded",
    "coi.backPrequal": "Back to Pre-Qualification",
    "coi.tipTitle": "What makes a COI “active”?",
    "coi.tipBody": "A COI is considered active when the expiration date is in the future. If your policy renews, upload the updated COI.",
    "coi.expiringSoon": "Your COI is expiring soon. Please upload an updated COI.",
    "coi.expired": "Your COI appears to be expired. Please upload an updated COI."
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
    "auth.logout": "Cerrar sesión",

    "prequal.title": "Precalificación",
    "prequal.subtitle": "Completa los elementos abajo para obtener tu estado de “Precalificado”.",
    "prequal.statusTitle": "Estado",
    "prequal.statusDesc": "Tu lista se actualiza automáticamente cuando completas elementos.",
    "prequal.badge.loading": "Cargando…",
    "prequal.badge.prequalified": "Precalificado",
    "prequal.badge.incomplete": "Incompleto",
    "prequal.itemW9": "W-9 Completado",
    "prequal.itemW9Desc": "Completa y envía tu W-9.",
    "prequal.itemCOI": "Certificado de Seguro (COI)",
    "prequal.itemCOIDesc": "Sube un COI vigente y define la fecha de vencimiento.",
    "prequal.itemAgreement": "Acuerdo de Subcontratista",
    "prequal.itemAgreementDesc": "Revisa y firma tu acuerdo.",
    "prequal.open": "Abrir",
    "prequal.updated": "Última actualización:",
    "prequal.whatTitle": "Qué significa “Precalificado”",
    "prequal.whatBody": "Los subcontratistas precalificados tienen un W-9 completo, un COI vigente en archivo y un acuerdo firmado. Esto facilita que los contratistas generales te incorporen y te seleccionen para trabajos.",
    "prequal.nextTitle": "Siguientes pasos",
    "prequal.next1": "Completa los elementos faltantes en tu lista.",
    "prequal.next2": "Mantén tu COI vigente — actualízalo antes de que venza.",
    "prequal.next3": "Una vez precalificado, crea tu perfil del Directorio (próximamente).",
    "prequal.noteTitle": "Tip:",
    "prequal.noteBody": "Puedes subir un COI nuevo en cualquier momento. La última carga será tu COI activo.",
    "prequal.coiExpires": "Vence",

    "coi.title": "Certificado de Seguro (COI)",
    "coi.subtitle": "Sube tu COI más reciente e ingresa la fecha de vencimiento.",
    "coi.uploadTitle": "Subir COI",
    "coi.fileLabel": "Archivo COI (PDF recomendado)",
    "coi.fileHint": "Aceptado: PDF, PNG, JPG",
    "coi.expLabel": "Fecha de vencimiento",
    "coi.uploadBtn": "Subir y Guardar",
    "coi.currentTitle": "COI actual en archivo",
    "coi.download": "Descargar",
    "coi.currentFile": "Archivo",
    "coi.currentExp": "Vence",
    "coi.currentUploaded": "Subido",
    "coi.backPrequal": "Volver a Precalificación",
    "coi.tipTitle": "¿Qué hace que un COI sea “vigente”?",
    "coi.tipBody": "Un COI se considera vigente cuando la fecha de vencimiento es futura. Si renuevas la póliza, sube el COI actualizado.",
    "coi.expiringSoon": "Tu COI vencerá pronto. Por favor sube un COI actualizado.",
    "coi.expired": "Tu COI parece vencido. Por favor sube un COI actualizado."
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

/* ========= Firebase ========= */
let app, auth, db, storage;

function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("Missing Firebase config. Paste it into config.js");
    return false;
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
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

  if (requiresAuth && !user) {
    const next = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `login.html?next=${encodeURIComponent(next)}`;
    return;
  }

  if (user && (page === "login" || page === "signup")) {
    window.location.href = getNextUrl();
  }
}

/* ========= Auth UI ========= */
function initAuthUI() {
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

  const signupForm = document.getElementById("signupForm");
  if (signupForm && auth) {
    const err = document.getElementById("signupError");
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.textContent = "";
      const email = document.getElementById("signupEmail")?.value?.trim();
      const password = document.getElementById("signupPassword")?.value;
      try {
        await createUserWithEmailAndEmailAndPasswordFix(auth, email, password);
      } catch (e) {
        // fallback if typo fixed below
      }
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        window.location.href = "index.html";
      } catch (error) {
        if (err) err.textContent = readableAuthError(error);
      }
    });
  }
}

// (no-op helper in case a browser caches a bad bundle; safe to ignore)
async function createUserWithEmailAndEmailAndPasswordFix() { return; }

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

/* ========= Prequal + COI data model =========
   Firestore doc: users/{uid}/prequal (single doc)
   Fields:
   - w9Completed: boolean
   - coiCompleted: boolean
   - agreementCompleted: boolean
   - coi: { fileName, filePath, expiresOn: "YYYY-MM-DD", uploadedAtMs: number }
   - updatedAt: serverTimestamp()
*/

async function getPrequalDocRef(uid) {
  return doc(db, "users", uid, "private", "prequal");
}

function formatDate(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  return yyyyMmDd;
}

function daysUntil(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  target.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diffMs = target - now;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function loadPrequalStatus(uid) {
  const refDoc = await getPrequalDocRef(uid);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
    // Initialize defaults
    await setDoc(refDoc, {
      w9Completed: false,
      coiCompleted: false,
      agreementCompleted: false,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return {
      w9Completed: false,
      coiCompleted: false,
      agreementCompleted: false
    };
  }

  return snap.data() || {};
}

function updatePrequalUI(data) {
  const list = document.getElementById("statusList");
  if (!list) return;

  const badge = document.getElementById("prequalBadge");
  const updatedAtEl = document.getElementById("prequalUpdatedAt");
  const coiMetaText = document.getElementById("coiMetaText");

  const w9 = !!data.w9Completed;
  const coi = !!data.coiCompleted;
  const agr = !!data.agreementCompleted;

  // Update dots
  list.querySelectorAll(".status-item").forEach(li => {
    const key = li.getAttribute("data-key");
    const dot = li.querySelector(".dot");
    const isOn = (key === "w9Completed" && w9) || (key === "coiCompleted" && coi) || (key === "agreementCompleted" && agr);
    dot?.classList.toggle("dot-on", isOn);
    dot?.classList.toggle("dot-off", !isOn);
  });

  // COI meta line (expires)
  const expiresOn = data?.coi?.expiresOn;
  if (coiMetaText) {
    if (expiresOn) {
      const lang = document.documentElement.lang || "en";
      const label = (I18N[lang]?.["prequal.coiExpires"] || "Expires");
      coiMetaText.textContent = `${label}: ${formatDate(expiresOn)}`;
    } else {
      // fallback translation already in HTML via data-i18n; leave it
    }
  }

  const allDone = w9 && coi && agr;

  if (badge) {
    badge.classList.remove("badge-ok", "badge-warn", "badge-wip");
    if (allDone) {
      badge.classList.add("badge-ok");
      const key = "prequal.badge.prequalified";
      badge.textContent = (I18N[document.documentElement.lang]?.[key] || I18N.en[key]);
    } else {
      badge.classList.add("badge-wip");
      const key = "prequal.badge.incomplete";
      badge.textContent = (I18N[document.documentElement.lang]?.[key] || I18N.en[key]);
    }
  }

  if (updatedAtEl) {
    const key = "prequal.updated";
    const label = (I18N[document.documentElement.lang]?.[key] || I18N.en[key]);
    updatedAtEl.textContent = data?.updatedAt?.toDate
      ? `${label} ${data.updatedAt.toDate().toLocaleString()}`
      : "";
  }
}

async function initPrequalPage(user) {
  const data = await loadPrequalStatus(user.uid);
  updatePrequalUI(data);
}

/* ========= COI page logic ========= */
async function renderCoiCurrent(user) {
  const refDoc = await getPrequalDocRef(user.uid);
  const snap = await getDoc(refDoc);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const coi = data.coi || null;

  const fileEl = document.getElementById("coiCurrentFile");
  const expEl = document.getElementById("coiCurrentExp");
  const upEl = document.getElementById("coiCurrentUploaded");
  const link = document.getElementById("coiDownloadLink");
  const note = document.getElementById("coiExpiryNote");

  if (!coi) {
    if (fileEl) fileEl.textContent = "—";
    if (expEl) expEl.textContent = "—";
    if (upEl) upEl.textContent = "—";
    if (link) link.hidden = true;
    if (note) note.hidden = true;
    return;
  }

  if (fileEl) fileEl.textContent = coi.fileName || "—";
  if (expEl) expEl.textContent = formatDate(coi.expiresOn);
  if (upEl) upEl.textContent = coi.uploadedAtMs ? new Date(coi.uploadedAtMs).toLocaleString() : "—";

  // Download link: generate URL from storage path
  if (link && coi.filePath) {
    try {
      const url = await getDownloadURL(ref(storage, coi.filePath));
      link.href = url;
      link.hidden = false;
    } catch {
      link.hidden = true;
    }
  }

  async function getW9DocRef(uid) {
  return doc(db, "users", uid, "private", "w9");
}

function collectW9FormData() {
  const taxClass = document.querySelector('input[name="taxClass"]:checked')?.value || "";
  const tinType = document.querySelector('input[name="tinType"]:checked')?.value || "ssn";

  return {
    name1: document.getElementById("w9_name1")?.value?.trim() || "",
    name2: document.getElementById("w9_name2")?.value?.trim() || "",
    taxClass,
    llcType: (document.getElementById("w9_llcType")?.value || "").trim().toUpperCase(),
    otherType: (document.getElementById("w9_otherType")?.value || "").trim(),
    exemptPayee: (document.getElementById("w9_exemptPayee")?.value || "").trim(),
    fatca: (document.getElementById("w9_fatca")?.value || "").trim(),
    address: (document.getElementById("w9_address")?.value || "").trim(),
    cityStateZip: (document.getElementById("w9_cityStateZip")?.value || "").trim(),
    requester: (document.getElementById("w9_requester")?.value || "").trim(),
    accounts: (document.getElementById("w9_accounts")?.value || "").trim(),
    tinType,
    tin: (document.getElementById("w9_tin")?.value || "").trim(),
    signature: (document.getElementById("w9_signature")?.value || "").trim(),
    date: (document.getElementById("w9_date")?.value || "").trim()
  };
}

function fillW9Form(data) {
  if (!data) return;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };

  setVal("w9_name1", data.name1);
  setVal("w9_name2", data.name2);
  setVal("w9_llcType", data.llcType);
  setVal("w9_otherType", data.otherType);
  setVal("w9_exemptPayee", data.exemptPayee);
  setVal("w9_fatca", data.fatca);
  setVal("w9_address", data.address);
  setVal("w9_cityStateZip", data.cityStateZip);
  setVal("w9_requester", data.requester);
  setVal("w9_accounts", data.accounts);
  setVal("w9_tin", data.tin);
  setVal("w9_signature", data.signature);
  setVal("w9_date", data.date);

  // tax class radios
  if (data.taxClass) {
    const r = document.querySelector(`input[name="taxClass"][value="${data.taxClass}"]`);
    if (r) r.checked = true;
  }
  // tin type radios
  if (data.tinType) {
    const t = document.querySelector(`input[name="tinType"][value="${data.tinType}"]`);
    if (t) t.checked = true;
  }
}

function updateW9Preview(data) {
  // text fields
  document.querySelectorAll(".w9-txt[data-bind]").forEach(el => {
    const key = el.getAttribute("data-bind");
    let val = data[key] ?? "";
    // simple date formatting for preview
    if (key === "date" && val) val = val;
    el.textContent = val;
  });

  // checkbox selection
  const selected = data.taxClass || "";
  document.querySelectorAll(".w9-check[data-check]").forEach(box => {
    const key = box.getAttribute("data-check");
    box.classList.toggle("on", key === selected);
  });

  // show/hide LLC/Other helper inputs on the form
  const llcWrap = document.getElementById("llcTypeWrap");
  const otherWrap = document.getElementById("otherTypeWrap");
  if (llcWrap) llcWrap.style.display = (selected === "llc") ? "block" : "none";
  if (otherWrap) otherWrap.style.display = (selected === "other") ? "block" : "none";
}

async function loadW9(user) {
  const w9Ref = await getW9DocRef(user.uid);
  const snap = await getDoc(w9Ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function saveW9(user, w9Data) {
  const w9Ref = await getW9DocRef(user.uid);

  await setDoc(w9Ref, {
    ...w9Data,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Mark prequal item complete
  const prequalRef = await getPrequalDocRef(user.uid);
  await setDoc(prequalRef, {
    w9Completed: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function attachW9LivePreview() {
  const form = document.getElementById("w9Form");
  if (!form) return;

  const handler = () => updateW9Preview(collectW9FormData());

  form.addEventListener("input", handler);
  form.addEventListener("change", handler);

  const refreshBtn = document.getElementById("w9RefreshBtn");
  refreshBtn?.addEventListener("click", handler);

  // initial render
  handler();
}

async function initW9Page(user) {
  const msg = document.getElementById("w9Msg");
  const err = document.getElementById("w9Err");
  const btn = document.getElementById("w9SaveBtn");
  const meta = document.getElementById("w9LoadedMeta");

  // Ensure helper fields are hidden until needed
  const llcWrap = document.getElementById("llcTypeWrap");
  const otherWrap = document.getElementById("otherTypeWrap");
  if (llcWrap) llcWrap.style.display = "none";
  if (otherWrap) otherWrap.style.display = "none";

  // Load existing
  const existing = await loadW9(user);
  if (existing) {
    fillW9Form(existing);
    updateW9Preview(existing);
    if (meta && existing.updatedAt?.toDate) {
      meta.textContent = `Loaded: ${existing.updatedAt.toDate().toLocaleString()}`;
    }
  }

  attachW9LivePreview();

  // Submit handler
  document.getElementById("w9Form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const data = collectW9FormData();
    if (!data.name1) { if (err) err.textContent = "Name (line 1) is required."; return; }
    if (!data.taxClass) { if (err) err.textContent = "Please select a tax classification."; return; }

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Saving…";

      await saveW9(user, data);

      if (msg) msg.textContent = "Saved. Your W-9 is stored in your account.";
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Save failed. Please try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}


  // Expiry note
  const until = daysUntil(coi.expiresOn);
  if (note && until !== null) {
    const lang = document.documentElement.lang || "en";
    if (until < 0) {
      note.textContent = I18N[lang]?.["coi.expired"] || I18N.en["coi.expired"];
      note.hidden = false;
    } else if (until <= 14) {
      note.textContent = I18N[lang]?.["coi.expiringSoon"] || I18N.en["coi.expiringSoon"];
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
}

async function initCoiPage(user) {
  await renderCoiCurrent(user);

  const form = document.getElementById("coiForm");
  if (!form) return;

  const fileInput = document.getElementById("coiFile");
  const expInput = document.getElementById("coiExpires");
  const msg = document.getElementById("coiMsg");
  const err = document.getElementById("coiErr");
  const btn = document.getElementById("coiUploadBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const file = fileInput?.files?.[0];
    const expiresOn = expInput?.value;

    if (!file) { if (err) err.textContent = "Please choose a file."; return; }
    if (!expiresOn) { if (err) err.textContent = "Please choose an expiration date."; return; }

    // Upload path: users/{uid}/coi/{timestamp}_{filename}
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `users/${user.uid}/coi/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Uploading…";

      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream"
      });

      // Update Firestore prequal doc
      const prequalRef = await getPrequalDocRef(user.uid);
      await setDoc(prequalRef, {
        coiCompleted: true,
        coi: {
          fileName: file.name,
          filePath: path,
          expiresOn,
          uploadedAtMs: Date.now()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (msg) msg.textContent = "Saved. Your COI is now on file.";
      form.reset();
      await renderCoiCurrent(user);
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Upload failed. Please try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
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

  if (!initFirebase()) return;

  onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.hidden = !user;

    requireAuthGuard(user);
    initAuthUI();

    if (!user) return;

    const page = document.body?.getAttribute("data-page");
    try {
      if (page === "prequal") await initPrequalPage(user);
      if (page === "coi") await initCoiPage(user);
    } catch (e) {
      console.error(e);
    }
  });
});
