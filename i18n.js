// i18n.js - Standalone translation module
// Works independently of scripts.js to ensure translations always work

// Firebase config and Firestore functions (loaded asynchronously)
let auth = null;
let db = null;
let doc, setDoc, serverTimestamp, getDoc;

// Load Firebase config and functions asynchronously
(async () => {
  try {
    const config = await import("./config.js");
    auth = config.auth;
    db = config.db;
    
    if (db) {
      try {
        const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
        doc = firestore.doc;
        setDoc = firestore.setDoc;
        serverTimestamp = firestore.serverTimestamp;
        getDoc = firestore.getDoc;
      } catch (err) {
        console.debug("[i18n] Firestore functions not available");
      }
    }
  } catch (err) {
    // Config not available - that's fine, we'll just skip Firestore sync
    console.debug("[i18n] Config not available, Firestore sync disabled");
  }
})();

// Try to get full I18N dictionary from scripts.js after it loads
let fullI18NLoaded = false;
function tryLoadFullI18N() {
  if (fullI18NLoaded) return;
  
  // Check if scripts.js has exposed I18N on window
  if (typeof window !== 'undefined' && window.I18N) {
    // Merge full dictionary from scripts.js
    if (window.I18N.en) {
      Object.assign(I18N.en, window.I18N.en);
    }
    if (window.I18N.es) {
      Object.assign(I18N.es, window.I18N.es);
    }
    fullI18NLoaded = true;
    // Re-apply translations with full dictionary
    applyTranslations(currentLang);
  }
}

// Translation dictionary (matches scripts.js)
const I18N = {
  en: {
    "nav.menu": "Menu", "nav.home": "Home", "nav.dashboard": "Home",
    "nav.prequal": "Pre-Qualification", "nav.contracts": "Contracts", "nav.payroll": "Payroll",
    "nav.employees": "Employees", "nav.bookkeeping": "Bookkeeping", "nav.tools": "Tools",
    "nav.audit": "Audit Help", "nav.documentTranslator": "Document Translator",
    "nav.invoiceBuilder": "Invoice Builder", "nav.jobEstimator": "Job Cost Estimator",
    "nav.1099": "1099-NEC Generator", "nav.account": "My Account", "nav.support": "Support",
    "nav.settings": "Settings", "footer.audit": "Audit", "footer.translator": "Translator",
    "footer.invoice": "Invoice", "footer.estimator": "Estimator",
    "tools.pageTitle": "Tools",
    "tools.pageSubtitle": "Access all available tools to help manage your business.",
    "settings.title": "Settings",
    "settings.subtitle": "Manage your account settings and get support.",
    "hero.title": "Focus on your work. We'll handle the paperwork.",
    "hero.subtitle": "Stop wasting time on business tasks. Listo automates payroll tracking, document management, invoicing, and compliance—so you can get back to what you do best.",
    "hero.ctaPrimary": "Log In", "hero.ctaSecondary": "Get Started with Listo",
    "landing.login": "Log In",
    "auth.loginTitle": "Welcome back", "auth.loginSubtitle": "Log in to access your Listo workspace.",
    "auth.signupTitle": "Create your account", "auth.signupSubtitle": "Use email + password to get started.",
    "auth.email": "Email", "auth.password": "Password", "auth.loginBtn": "Log In",
    "auth.createBtn": "Create Account", "signup.acceptTerms": "I agree to the",
    "signup.termsLink": "Terms and Conditions", "signup.and": " and ",
    "signup.privacyLink": "Privacy Policy", "auth.haveAccount": "Already have an account?",
    "auth.goLogin": "Log in", "auth.forgotTitle": "Reset password",
    "auth.forgotSubtitle": "Enter your email and we'll send you a reset link.",
    "auth.sendReset": "Send reset link", "auth.backToLogin": "Back to login",
    "auth.displayName": "Company / Display name",
    "auth.displayNamePlaceholder": "ABC Construction",
    "auth.emailPlaceholder": "you@company.com", "auth.passwordPlaceholder": "At least 6 characters",
    "auth.passwordPlaceholderLogin": "••••••••", "auth.confirmPassword": "Confirm Password",
    "auth.confirmPasswordPlaceholder": "Re-enter your password",
    "auth.createAccountLink": "Create account", "account.languageTitle": "Language Preference",
    "account.languageDesc": "Choose your preferred language for the application interface.",
    "account.languageLabel": "Language"
  },
  es: {
    "nav.menu": "Menú", "nav.home": "Inicio", "nav.dashboard": "Inicio",
    "nav.prequal": "Precalificación", "nav.contracts": "Contratos", "nav.payroll": "Nómina",
    "nav.employees": "Empleados", "nav.bookkeeping": "Contabilidad", "nav.tools": "Herramientas",
    "nav.audit": "Ayuda de Auditoría", "nav.documentTranslator": "Traductor de Documentos",
    "nav.invoiceBuilder": "Generador de Facturas", "nav.jobEstimator": "Estimador de Costos de Trabajo",
    "nav.account": "Mi Cuenta", "nav.support": "Soporte", "nav.settings": "Configuración",
    "footer.audit": "Auditoría", "footer.translator": "Traductor", "footer.invoice": "Factura",
    "footer.estimator": "Estimador", "tools.pageTitle": "Herramientas",
    "tools.pageSubtitle": "Accede a todas las herramientas disponibles para ayudar a administrar tu negocio.",
    "settings.title": "Configuración",
    "settings.subtitle": "Administra la configuración de tu cuenta y obtén soporte.",
    "hero.title": "Precalifícate. Cobra. Sé elegido.",
    "hero.subtitle": "Listo ayuda a subcontratistas a completar requisitos de incorporación, estar listos para auditorías y crear un perfil confiable para contratistas generales.",
    "hero.ctaPrimary": "Iniciar Sesión", "hero.ctaSecondary": "Comenzar con Listo",
    "landing.login": "Iniciar Sesión",
    "auth.loginTitle": "Bienvenido de nuevo",
    "auth.loginSubtitle": "Inicia sesión para acceder a tu espacio de Listo.",
    "auth.signupTitle": "Crea tu cuenta", "auth.signupSubtitle": "Usa correo + contraseña para comenzar.",
    "auth.email": "Correo", "auth.password": "Contraseña", "auth.loginBtn": "Iniciar sesión",
    "auth.createBtn": "Crear cuenta", "signup.acceptTerms": "Acepto los",
    "signup.termsLink": "Términos y Condiciones", "signup.and": " y la ",
    "signup.privacyLink": "Política de Privacidad", "auth.haveAccount": "¿Ya tienes cuenta?",
    "auth.goLogin": "Inicia sesión", "auth.forgotTitle": "Restablecer contraseña",
    "auth.forgotSubtitle": "Ingresa tu correo y te enviaremos un enlace para restablecer.",
    "auth.sendReset": "Enviar enlace de restablecimiento", "auth.backToLogin": "Volver al inicio de sesión",
    "auth.displayName": "Empresa / Nombre para mostrar",
    "auth.displayNamePlaceholder": "ABC Construction",
    "auth.emailPlaceholder": "tu@empresa.com", "auth.passwordPlaceholder": "Al menos 6 caracteres",
    "auth.passwordPlaceholderLogin": "••••••••", "auth.confirmPassword": "Confirmar Contraseña",
    "auth.confirmPasswordPlaceholder": "Vuelve a ingresar tu contraseña",
    "auth.createAccountLink": "Crear cuenta", "account.languageTitle": "Preferencia de Idioma",
    "account.languageDesc": "Elige tu idioma preferido para la interfaz de la aplicación.",
    "account.languageLabel": "Idioma"
  }
};

// Load full dictionary from scripts.js I18N object if available
// This is a simplified version - in production, import the full dict from scripts.js
// For now, we'll use the minimal set and rely on scripts.js having the full set

const LANG_KEY = "listo_lang";
let currentLang = "en";
let translationObserver = null;

// Simple HTML sanitizer
function sanitizeHTML(html) {
  const allowedTags = ["b", "strong", "i", "em", "u", "br", "p"];
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  return html.replace(tagPattern, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    if (allowedTags.includes(lowerTag)) {
      return match.replace(/\s+[^>]*/, "").replace(/<(\w+)[^>]*>/, "<$1>");
    }
    return "";
  });
}

// Get current language from storage
function getCurrentLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "es" || saved === "en") {
      return saved;
    }
  } catch (err) {
    console.warn("[i18n] Could not read language from localStorage:", err);
  }
  return "en";
}

// Apply translations to the page
function applyTranslations(lang) {
  if (!I18N[lang]) {
    console.warn(`[i18n] Language "${lang}" not found, using "en"`);
    lang = "en";
  }
  
  currentLang = lang;
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  
  let translatedCount = 0;
  
  // Translate text content (including option elements in selects)
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      const translation = dict[key];
      if (translation.includes("<") && translation.includes(">")) {
        el.innerHTML = sanitizeHTML(translation);
      } else {
        // Handle option elements specially - only update textContent, not value
        if (el.tagName === "OPTION" && el.value !== "") {
          // For option elements with values (not placeholders), keep the value but translate text
          el.textContent = translation;
        } else {
          el.textContent = translation;
        }
      }
      translatedCount++;
    }
  });
  
  // Translate placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) {
      el.placeholder = dict[key];
      translatedCount++;
    }
  });
  
  // Translate values (for buttons, inputs, etc.)
  document.querySelectorAll("[data-i18n-value]").forEach(el => {
    const key = el.getAttribute("data-i18n-value");
    if (dict[key]) {
      el.value = dict[key];
      translatedCount++;
    }
  });
  
  // Translate aria-label
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria");
    if (dict[key]) {
      el.setAttribute("aria-label", dict[key]);
      translatedCount++;
    }
  });
  
  // Translate alt attributes
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (dict[key]) {
      el.setAttribute("alt", dict[key]);
      translatedCount++;
    }
  });
  
  // Update button pressed states
  setPressedButtons(lang);
  
  // Save to localStorage
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (err) {
    console.warn("[i18n] Could not save language to localStorage:", err);
  }
  
  // Set up MutationObserver if not already set up
  setupTranslationObserver();
}

// Set pressed state on language toggle buttons
function setPressedButtons(lang) {
  document.querySelectorAll("[data-lang]").forEach(btn => {
    const isActive = btn.getAttribute("data-lang") === lang;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

// Set language and optionally sync to Firestore
async function setLanguage(lang, { syncRemote = true } = {}) {
  if (lang !== "en" && lang !== "es") {
    console.warn(`[i18n] Invalid language: ${lang}`);
    return;
  }
  
  // Apply translations immediately (don't wait for Firestore)
  applyTranslations(lang);
  
  // Sync to Firestore if authenticated and syncRemote is true
  if (syncRemote && auth && db && doc && setDoc && serverTimestamp) {
    try {
      const user = auth.currentUser;
      if (user) {
        const profileRef = doc(db, "users", user.uid, "private", "profile");
        await setDoc(profileRef, {
          language: lang,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.warn("[i18n] Could not sync language to Firestore:", err);
      // Don't throw - translation is already applied
    }
  }
}

// Setup MutationObserver for dynamic content
function setupTranslationObserver() {
  if (translationObserver) return;
  
  let debounceTimer = null;
  const debouncedApply = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyTranslations(currentLang);
    }, 100);
  };
  
  const observeTargets = [
    document.getElementById("main"),
    document.body,
    document.querySelector(".app-layout"),
    document.querySelector(".auth-center")
  ].filter(Boolean);
  
  if (observeTargets.length > 0) {
    translationObserver = new MutationObserver((mutations) => {
      let shouldReapply = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.hasAttribute("data-i18n") || 
                  node.hasAttribute("data-i18n-placeholder") || 
                  node.hasAttribute("data-i18n-value") ||
                  node.hasAttribute("data-i18n-aria") ||
                  node.hasAttribute("data-i18n-alt") ||
                  node.querySelector("[data-i18n], [data-i18n-placeholder], [data-i18n-value], [data-i18n-aria], [data-i18n-alt]")) {
                shouldReapply = true;
                break;
              }
            }
          }
        }
        if (shouldReapply) break;
      }
      if (shouldReapply) {
        debouncedApply();
      }
    });
    
    observeTargets.forEach(target => {
      translationObserver.observe(target, {
        childList: true,
        subtree: true
      });
    });
  }
}

// Event delegation for language toggles
function setupLanguageToggles() {
  // Use capture phase and stopPropagation to handle before other handlers
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-lang]");
    if (!toggleBtn) return;
    
    // Skip only on Account page where account.js handles it
    const pageType = document.body?.getAttribute("data-page");
    if (pageType === "account" && (toggleBtn.id === "langEnBtn" || toggleBtn.id === "langEsBtn")) {
      return; // Let account.js handle it
    }
    
    // Handle toggle
    const selectedLang = toggleBtn.getAttribute("data-lang");
    if (selectedLang === "en" || selectedLang === "es") {
      e.preventDefault();
      e.stopPropagation();
      setLanguage(selectedLang, { syncRemote: true });
    }
  }, true); // Use capture phase
  
  // Also handle checkbox/switch toggles if present
  document.addEventListener("change", (e) => {
    const toggle = e.target.closest("input[type='checkbox'][data-action='toggle-language']");
    if (!toggle) return;
    
    const selectedLang = toggle.checked ? "es" : "en";
    setLanguage(selectedLang, { syncRemote: true });
  }, true);
}

// Initialize on DOMContentLoaded
function init() {
  // Try to load full I18N from scripts.js if available
  tryLoadFullI18N();
  
  // Also check periodically for a bit in case scripts.js loads late
  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;
    tryLoadFullI18N();
    if (fullI18NLoaded || checkCount > 10) {
      clearInterval(checkInterval);
    }
  }, 100);
  
  // Apply current language immediately
  const lang = getCurrentLang();
  applyTranslations(lang);
  
  // Set up toggle handlers
  setupLanguageToggles();
}

// Expose to window for other scripts
if (typeof window !== 'undefined') {
  window.ListoI18n = {
    getCurrentLang,
    setLanguage,
    applyTranslations,
    I18N
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

