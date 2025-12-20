/* Listo starter: mobile nav + bilingual i18n (EN/ES) */

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

    "footer.note": "Built to help subcontractors look sharp, stay compliant, and win more work."
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

    "footer.note": "Diseñado para ayudar a subcontratistas a verse profesionales, cumplir requisitos y ganar más trabajo."
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

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector("#navMenu");
  if (!toggle || !menu) return;

  const setState = (open) => {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.contains("open");
    setState(!isOpen);
  });

  // Close menu when clicking a link (mobile)
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => setState(false));
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("open")) return;
    const clickedInside = menu.contains(e.target) || toggle.contains(e.target);
    if (!clickedInside) setState(false);
  });

  // Close on escape
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
});
