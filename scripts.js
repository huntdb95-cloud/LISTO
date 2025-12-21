// scripts.js (ES Module)
import { firebaseConfig } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

/* ========= i18n ========= */
const I18N = {
  en: {
    "nav.menu": "Menu",
    "nav.home": "Home",
    "nav.prequal": "Pre-Qualification",
    "nav.payroll": "Payroll",
    "nav.audit": "Insurance Audit Help",
    "nav.contractScanner": "Contract Scanner",
    "nav.invoiceBuilder": "Invoice Builder",
    "nav.support": "Support",

    "hero.title": "Get pre-qualified. Get paid. Get picked.",
    "hero.subtitle": "Listo helps subcontractors complete onboarding requirements, stay audit-ready, and build a profile general contractors can trust.",
    "hero.ctaPrimary": "Start Pre-Qualification",
    "hero.ctaSecondary": "Get Support",
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
    "prequal.next3": "Once pre-qualified, you'll have access to all Listo tools and features.",
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
    "coi.expired": "Your COI appears to be expired. Please upload an updated COI.",

    "contractScanner.title": "Contract Scanner",
    "contractScanner.subtitle": "Google OCR • English ↔ Spanish Translation",
    "contractScanner.description": "Upload a contract document (PDF, HEIC, JPG, or PNG) to extract text using Google OCR and translate it into Spanish. View the original English text alongside the Spanish translation.",
    "contractScanner.uploadTitle": "1) Upload Contract Document",
    "contractScanner.fileLabel": "Contract File",
    "contractScanner.fileHint": "Supported formats: PDF, HEIC, JPG, JPEG, PNG",
    "contractScanner.scanBtn": "Scan & Translate Contract",
    "contractScanner.clearBtn": "Clear",
    "contractScanner.resultsTitle": "2) Translated Contract",
    "contractScanner.resultsDesc": "English text (left) and Spanish translation (right)",
    "contractScanner.englishTitle": "English (Original)",
    "contractScanner.spanishTitle": "Español (Traducción)",
    "contractScanner.copyEnglish": "Copy English Text",
    "contractScanner.copySpanish": "Copy Spanish Text",
    "contractScanner.downloadEnglish": "Download English (.txt)",
    "contractScanner.downloadSpanish": "Download Spanish (.txt)",

    "audit.title": "Audit Help Tool",
    "audit.subtitle": "Printer-friendly package • PDF 8.5×11 • SendGrid email",
    "audit.description": "This tool helps you prepare an audit package by collecting your payroll summary (for your prior policy period), supporting documents, and a short questionnaire.",
    "audit.expectationsTitle": "Audit expectations",
    "audit.expectationsDesc": "Your insurance carrier is verifying <b>payroll paid during your previous policy period</b> so your premium can be calculated correctly.",
    "audit.expectations1": "Payroll amounts actually paid (by employee and totals)",
    "audit.expectations2": "Payment methods (check, cash, electronic)",
    "audit.expectations3": "Independent contractor payments (1099s) if applicable",
    "audit.expectations4": "Supporting bank statements and tax forms",
    "audit.expectationsNote": "After you upload documents and complete the questionnaire, we compile everything into a printer-friendly PDF and email it with attachments.",
    "audit.periodTitle": "1) Audit period",
    "audit.policyStart": "Policy Start Date",
    "audit.policyEnd": "Policy End Date",
    "audit.quickActions": "Quick actions",
    "audit.loadPayroll": "Load payroll summary",
    "audit.clear": "Clear",
    "audit.businessTitle": "2) Business information",
    "audit.businessName": "Business Name",
    "audit.phone": "Phone",
    "audit.copyEmail": "Copy Email (for audit package)",
    "audit.auditorEmail": "Auditor Email",
    "audit.uploadTitle": "4) Upload supporting documents",
    "audit.uploadDesc": "Upload documents like Schedule C, bank statements, payroll summaries, or other supporting documents.",
    "audit.selectType": "Document Type",
    "audit.selectFile": "Select File",
    "audit.uploadBtn": "Upload Document",
    "audit.uploadedTitle": "Uploaded Documents",
    "audit.payrollTitle": "3) Payroll summary",
    "audit.tableWorker": "Worker",
    "audit.tablePaymentType": "Payment Type",
    "audit.tableTotalPaid": "Total Paid",
    "audit.tablePayments": "# Payments",
    "audit.tableGrandTotal": "Grand Total",
    "audit.payrollDesc": "Summary of payroll entries for the audit period",
    "audit.loadPayrollBtn": "Load Payroll Data",
    "audit.questionnaireTitle": "5) Audit questionnaire",
    "audit.questionnaireDesc": "Answer these questions to help complete your audit package.",
    "audit.qCash": "Were any payments made in cash?",
    "audit.qCashExplain": "If yes, explain",
    "audit.qSubs": "Did you pay any subcontractors (1099)?",
    "audit.qCOI": "Did you collect COIs from subcontractors?",
    "audit.qOwnerLabor": "Did you perform any owner labor?",
    "audit.qChanges": "Any changes to your business during the period?",
    "audit.qNotes": "Additional notes for auditor (optional)",
    "audit.saveQuestionnaire": "Save questionnaire",
    "audit.generateTitle": "6) Generate PDF + email audit package",
    "audit.generateDesc": "This generates a printer-friendly PDF and sends it (plus uploaded documents) via SendGrid.",
    "audit.generatePdf": "Generate PDF preview",
    "audit.emailPackage": "Email audit package",

    "invoice.title": "Invoice Builder",
    "invoice.pageDescription": "Create, save, export, and send invoices (PDF attached via SendGrid).",
    "invoice.new": "New",
    "invoice.save": "Save",
    "invoice.downloadPdf": "Download PDF",
    "invoice.sendEmail": "Send Invoice (Email PDF)",
    "invoice.yourCompany": "Your Company",
    "invoice.companyName": "Company / Contractor Name",
    "invoice.replyEmail": "Email (Reply-To)",
    "invoice.phone": "Phone",
    "invoice.address": "Address",
    "invoice.customer": "Customer",
    "invoice.customerName": "Customer Name",
    "invoice.customerEmail": "Customer Email",
    "invoice.customerPhone": "Customer Phone",
    "invoice.customerAddress": "Customer Address",
    "invoice.invoiceNumber": "Invoice #",
    "invoice.invoiceDate": "Invoice Date",
    "invoice.dueDate": "Due Date",
    "invoice.projectName": "Project / Description",
    "invoice.lineItems": "Line Items",
    "invoice.addItem": "+ Add Item",
    "invoice.description": "Description",
    "invoice.quantity": "Qty",
    "invoice.unitPrice": "Unit Price",
    "invoice.lineTotal": "Line Total",
    "invoice.taxRate": "Tax %",
    "invoice.discount": "Discount ($)",
    "invoice.deposit": "Deposit Paid ($)",
    "invoice.subtotal": "Subtotal",
    "invoice.tax": "Tax",
    "invoice.discountLabel": "Discount",
    "invoice.depositLabel": "Deposit",
    "invoice.totalDue": "Total Due",
    "invoice.notes": "Notes",
    "invoice.paymentInstructions": "Payment Instructions",
    "invoice.recentInvoices": "Recent Saved Invoices",
    "invoice.loadInvoice": "Load",
    "invoice.deleteInvoice": "Delete",
    "invoice.sendNote": "\"Send Invoice\" emails a PDF attachment through your Firebase backend + SendGrid.",

    "support.title": "Support",
    "support.subtitle": "Get help with Listo. Find answers to common questions and learn how to use our tools.",
    "support.contactTitle": "Get in Touch",
    "support.contactDesc": "Need help? Contact us for assistance with your account or questions about using Listo.",
    "support.emailLabel": "Email:",
    "support.email": "support@listo.com",
    "support.hoursLabel": "Support Hours:",
    "support.hours": "Monday - Friday, 9 AM - 5 PM EST",
    "support.resourcesTitle": "Resources",
    "support.resourcesDesc": "Quick links to help you get started and make the most of Listo.",
    "support.resource1": "Pre-Qualification Guide",
    "support.resource2": "Payroll Tracker Help",
    "support.resource3": "Insurance Audit Preparation",
    "support.faqTitle": "Frequently Asked Questions",
    "support.faq1Q": "How do I become Pre-Qualified?",
    "support.faq1A": "Complete three items: fill out your W-9, upload an active Certificate of Insurance (COI), and sign the Subcontractor Agreement. Once all three are complete, you'll earn Pre-Qualified status.",
    "support.faq2Q": "How do I track payroll payments?",
    "support.faq2A": "Use the Payroll Tracker to record each payment with the employee name, payment date, amount, and payment method. You can search and filter your payment history, and export it as a CSV file.",
    "support.faq3Q": "What documents do I need for an insurance audit?",
    "support.faq3A": "Common documents include Schedule C, bank statements, payroll summaries, and invoices. Use the Audit Help Tool to upload documents and generate a printer-friendly PDF package for your audit.",
    "support.faq4Q": "Can I update my COI after uploading it?",
    "support.faq4A": "Yes! You can upload a new COI anytime. The latest upload becomes your active COI. Make sure to set the correct expiration date when uploading.",
    "support.faq5Q": "How does the Contract Scanner work?",
    "support.faq5A": "Upload a contract document (PDF, HEIC, JPG, or PNG). The tool uses Google OCR to extract text and translates it into Spanish. View both the original English text and Spanish translation side-by-side."
  },

  es: {
    "nav.menu": "Menú",
    "nav.home": "Inicio",
    "nav.prequal": "Precalificación",
    "nav.payroll": "Nómina",
    "nav.audit": "Ayuda de Auditoría de Seguro",
    "nav.contractScanner": "Escáner de Contratos",
    "nav.invoiceBuilder": "Generador de Facturas",
    "nav.support": "Soporte",

    "hero.title": "Precalifícate. Cobra. Sé elegido.",
    "hero.subtitle": "Listo ayuda a subcontratistas a completar requisitos de incorporación, estar listos para auditorías y crear un perfil confiable para contratistas generales.",
    "hero.ctaPrimary": "Iniciar Precalificación",
    "hero.ctaSecondary": "Obtener Soporte",
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
    "prequal.next3": "Una vez precalificado, tendrás acceso a todas las herramientas y funciones de Listo.",
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
    "coi.expired": "Tu COI parece vencido. Por favor sube un COI actualizado.",

    "contractScanner.title": "Escáner de Contratos",
    "contractScanner.subtitle": "OCR de Google • Traducción Inglés ↔ Español",
    "contractScanner.description": "Sube un documento de contrato (PDF, HEIC, JPG o PNG) para extraer texto usando OCR de Google y traducirlo al español. Ve el texto original en inglés junto con la traducción al español.",
    "contractScanner.uploadTitle": "1) Subir Documento de Contrato",
    "contractScanner.fileLabel": "Archivo de Contrato",
    "contractScanner.fileHint": "Formatos soportados: PDF, HEIC, JPG, JPEG, PNG",
    "contractScanner.scanBtn": "Escanear y Traducir Contrato",
    "contractScanner.clearBtn": "Limpiar",
    "contractScanner.resultsTitle": "2) Contrato Traducido",
    "contractScanner.resultsDesc": "Texto en inglés (izquierda) y traducción al español (derecha)",
    "contractScanner.englishTitle": "Inglés (Original)",
    "contractScanner.spanishTitle": "Español (Traducción)",
    "contractScanner.copyEnglish": "Copiar Texto en Inglés",
    "contractScanner.copySpanish": "Copiar Texto en Español",
    "contractScanner.downloadEnglish": "Descargar Inglés (.txt)",
    "contractScanner.downloadSpanish": "Descargar Español (.txt)",

    "audit.title": "Herramienta de Ayuda de Auditoría",
    "audit.subtitle": "Paquete para imprimir • PDF 8.5×11 • Email SendGrid",
    "audit.description": "Esta herramienta te ayuda a preparar un paquete de auditoría recopilando tu resumen de nómina (para tu período de póliza anterior), documentos de respaldo y un cuestionario corto.",
    "audit.expectationsTitle": "Expectativas de auditoría",
    "audit.expectationsDesc": "Tu aseguradora está verificando <b>la nómina pagada durante tu período de póliza anterior</b> para que tu prima se calcule correctamente.",
    "audit.expectations1": "Montos de nómina realmente pagados (por empleado y totales)",
    "audit.expectations2": "Métodos de pago (cheque, efectivo, electrónico)",
    "audit.expectations3": "Pagos a contratistas independientes (1099) si aplica",
    "audit.expectations4": "Estados bancarios y formularios fiscales de respaldo",
    "audit.expectationsNote": "Después de subir documentos y completar el cuestionario, compilamos todo en un PDF para imprimir y lo enviamos por email con adjuntos.",
    "audit.periodTitle": "1) Período de auditoría",
    "audit.policyStart": "Fecha de Inicio de Póliza",
    "audit.policyEnd": "Fecha de Fin de Póliza",
    "audit.quickActions": "Acciones rápidas",
    "audit.loadPayroll": "Cargar resumen de nómina",
    "audit.clear": "Limpiar",
    "audit.businessTitle": "2) Información del negocio",
    "audit.businessName": "Nombre del Negocio",
    "audit.phone": "Teléfono",
    "audit.copyEmail": "Correo de Copia (para paquete de auditoría)",
    "audit.auditorEmail": "Correo del Auditor",
    "audit.uploadTitle": "3) Subir documentos de respaldo",
    "audit.uploadDesc": "Sube documentos como Schedule C, estados bancarios, resúmenes de nómina u otros documentos de respaldo.",
    "audit.selectType": "Tipo de Documento",
    "audit.selectFile": "Seleccionar Archivo",
    "audit.uploadBtn": "Subir Documento",
    "audit.uploadedTitle": "Documentos Subidos",
    "audit.payrollTitle": "3) Resumen de nómina",
    "audit.payrollDesc": "Resumen de entradas de nómina para el período de auditoría",
    "audit.tableWorker": "Trabajador",
    "audit.tablePaymentType": "Tipo de Pago",
    "audit.tableTotalPaid": "Total Pagado",
    "audit.tablePayments": "# Pagos",
    "audit.tableGrandTotal": "Gran Total",
    "audit.loadPayrollBtn": "Cargar Datos de Nómina",
    "audit.questionnaireTitle": "5) Cuestionario de auditoría",
    "audit.questionnaireDesc": "Responde estas preguntas para ayudar a completar tu paquete de auditoría.",
    "audit.qCash": "¿Se hicieron pagos en efectivo?",
    "audit.qCashExplain": "Si sí, explica",
    "audit.qSubs": "¿Pagaste a subcontratistas (1099)?",
    "audit.qCOI": "¿Recolectaste COIs de subcontratistas?",
    "audit.qOwnerLabor": "¿Realizaste trabajo del dueño?",
    "audit.qChanges": "¿Algún cambio en tu negocio durante el período?",
    "audit.qNotes": "Notas adicionales para el auditor (opcional)",
    "audit.saveQuestionnaire": "Guardar cuestionario",
    "audit.generateTitle": "6) Generar PDF + enviar paquete de auditoría por email",
    "audit.generateDesc": "Esto genera un PDF para imprimir y lo envía (más documentos subidos) vía SendGrid.",
    "audit.generatePdf": "Generar vista previa PDF",
    "audit.emailPackage": "Enviar paquete de auditoría por email",

    "invoice.title": "Generador de Facturas",
    "invoice.pageDescription": "Crea, guarda, exporta y envía facturas (PDF adjunto vía SendGrid).",
    "invoice.new": "Nuevo",
    "invoice.save": "Guardar",
    "invoice.downloadPdf": "Descargar PDF",
    "invoice.sendEmail": "Enviar Factura (Email PDF)",
    "invoice.yourCompany": "Tu Empresa",
    "invoice.companyName": "Nombre de Empresa / Contratista",
    "invoice.replyEmail": "Correo (Para Respuesta)",
    "invoice.phone": "Teléfono",
    "invoice.address": "Dirección",
    "invoice.customer": "Cliente",
    "invoice.customerName": "Nombre del Cliente",
    "invoice.customerEmail": "Correo del Cliente",
    "invoice.customerPhone": "Teléfono del Cliente",
    "invoice.customerAddress": "Dirección del Cliente",
    "invoice.invoiceNumber": "Número de Factura",
    "invoice.invoiceDate": "Fecha de Factura",
    "invoice.dueDate": "Fecha de Vencimiento",
    "invoice.projectName": "Proyecto / Descripción",
    "invoice.lineItems": "Artículos de Línea",
    "invoice.addItem": "+ Agregar Artículo",
    "invoice.description": "Descripción",
    "invoice.quantity": "Cant",
    "invoice.unitPrice": "Precio Unitario",
    "invoice.lineTotal": "Total de Línea",
    "invoice.taxRate": "Impuesto %",
    "invoice.discount": "Descuento ($)",
    "invoice.deposit": "Depósito Pagado ($)",
    "invoice.subtotal": "Subtotal",
    "invoice.tax": "Impuesto",
    "invoice.discountLabel": "Descuento",
    "invoice.depositLabel": "Depósito",
    "invoice.totalDue": "Total a Pagar",
    "invoice.notes": "Notas",
    "invoice.paymentInstructions": "Instrucciones de Pago",
    "invoice.recentInvoices": "Facturas Guardadas Recientes",
    "invoice.loadInvoice": "Cargar",
    "invoice.deleteInvoice": "Eliminar",
    "invoice.sendNote": "\"Enviar Factura\" envía un adjunto PDF a través de tu backend de Firebase + SendGrid.",

    "support.title": "Soporte",
    "support.subtitle": "Obtén ayuda con Listo. Encuentra respuestas a preguntas comunes y aprende a usar nuestras herramientas.",
    "support.contactTitle": "Contáctanos",
    "support.contactDesc": "¿Necesitas ayuda? Contáctanos para asistencia con tu cuenta o preguntas sobre cómo usar Listo.",
    "support.emailLabel": "Correo electrónico:",
    "support.email": "support@listo.com",
    "support.hoursLabel": "Horario de Atención:",
    "support.hours": "Lunes - Viernes, 9 AM - 5 PM EST",
    "support.resourcesTitle": "Recursos",
    "support.resourcesDesc": "Enlaces rápidos para ayudarte a comenzar y aprovechar al máximo Listo.",
    "support.resource1": "Guía de Precalificación",
    "support.resource2": "Ayuda del Rastreador de Nómina",
    "support.resource3": "Preparación para Auditoría de Seguro",
    "support.faqTitle": "Preguntas Frecuentes",
    "support.faq1Q": "¿Cómo me convierto en Precalificado?",
    "support.faq1A": "Completa tres elementos: completa tu W-9, sube un Certificado de Seguro (COI) activo y firma el Acuerdo de Subcontratista. Una vez que los tres estén completos, obtendrás el estatus de Precalificado.",
    "support.faq2Q": "¿Cómo registro los pagos de nómina?",
    "support.faq2A": "Usa el Rastreador de Nómina para registrar cada pago con el nombre del empleado, fecha de pago, monto y método de pago. Puedes buscar y filtrar tu historial de pagos, y exportarlo como archivo CSV.",
    "support.faq3Q": "¿Qué documentos necesito para una auditoría de seguro?",
    "support.faq3A": "Los documentos comunes incluyen Schedule C, estados de cuenta bancarios, resúmenes de nómina e facturas. Usa la Herramienta de Ayuda de Auditoría para subir documentos y generar un paquete PDF listo para imprimir para tu auditoría.",
    "support.faq4Q": "¿Puedo actualizar mi COI después de subirlo?",
    "support.faq4A": "¡Sí! Puedes subir un COI nuevo en cualquier momento. La última carga se convierte en tu COI activo. Asegúrate de establecer la fecha de vencimiento correcta al subirlo.",
    "support.faq5Q": "¿Cómo funciona el Escáner de Contratos?",
    "support.faq5A": "Sube un documento de contrato (PDF, HEIC, JPG o PNG). La herramienta usa Google OCR para extraer texto y lo traduce al español. Ve tanto el texto original en inglés como la traducción al español lado a lado."
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
    if (dict[key]) {
      // Use innerHTML if translation contains HTML tags, otherwise textContent
      const translation = dict[key];
      if (translation.includes("<") && translation.includes(">")) {
        el.innerHTML = translation;
      } else {
        el.textContent = translation;
      }
    }
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
let app, auth, db, storage, analytics;

async function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("Missing Firebase config. Paste it into config.js");
    return false;
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Analytics only works in supported environments (typically HTTPS, non-blocked cookies, etc.)
  try {
    if (await isSupported()) {
      analytics = getAnalytics(app);
    }
  } catch (e) {
    // If analytics isn't supported (local file://, blocked, etc.), safely ignore.
    analytics = undefined;
  }

  return true;
}

function getNextUrl() {
  const url = new URL(window.location.href);
  const next = url.searchParams.get("next");
  // next parameter is absolute path (with leading slash)
  // From login page at /login/login.html, prepend relative path
  if (next) {
    if (next.startsWith("/")) {
      // Absolute path: go up one level from /login/ to root
      return `..${next}`;
    }
    // Legacy: handle relative paths for backward compatibility
    if (!next.startsWith("../") && !next.startsWith("./")) {
      return `../${next}`;
    }
    return next;
  }
  // Default: go to index.html
  return "../index.html";
}

function requireAuthGuard(user) {
  const body = document.body;
  const requiresAuth = body?.hasAttribute("data-requires-auth");
  const page = body?.getAttribute("data-page");

  if (requiresAuth && !user) {
    // Store absolute path (with leading slash) for next parameter
    const pathname = window.location.pathname;
    const next = pathname.startsWith("/") ? pathname : `/${pathname}`;
    // Calculate relative path to login page from current location
    const pathSegments = pathname.split("/").filter(p => p && !p.endsWith(".html"));
    const depth = pathSegments.length;
    const loginPath = depth > 0 ? "../".repeat(depth) + "login/login.html" : "login/login.html";
    window.location.href = `${loginPath}?next=${encodeURIComponent(next || "/index.html")}`;
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
        // Calculate relative path to login page from current location
        const pathSegments = window.location.pathname.split("/").filter(p => p && !p.endsWith(".html"));
        const depth = pathSegments.length;
        const loginPath = depth > 0 ? "../".repeat(depth) + "login/login.html" : "login/login.html";
        window.location.href = loginPath;
      } catch (e) {
        console.error(e);
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm && auth) {
    const err = document.getElementById("loginMsg");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.textContent = "";
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value;
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
        await createUserWithEmailAndPassword(auth, email, password);
        // Calculate relative path to index.html from current location
        const pathSegments = window.location.pathname.split("/").filter(p => p && !p.endsWith(".html"));
        const depth = pathSegments.length;
        const indexPath = depth > 0 ? "../".repeat(depth) + "index.html" : "index.html";
        window.location.href = indexPath;
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

/* ========= Prequal + COI data model =========
   Firestore doc: users/{uid}/private/prequal
   Fields:
   - w9Completed: boolean
   - coiCompleted: boolean
   - agreementCompleted: boolean
   - coi: { fileName, filePath, expiresOn: "YYYY-MM-DD", uploadedAtMs: number }
   - updatedAt: serverTimestamp()
*/
function getPrequalDocRef(uid) {
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
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffMs = target - now;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function loadPrequalStatus(uid) {
  const refDoc = getPrequalDocRef(uid);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
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

  list.querySelectorAll(".status-item").forEach(li => {
    const key = li.getAttribute("data-key");
    const dot = li.querySelector(".dot");
    const isOn =
      (key === "w9Completed" && w9) ||
      (key === "coiCompleted" && coi) ||
      (key === "agreementCompleted" && agr);

    dot?.classList.toggle("dot-on", isOn);
    dot?.classList.toggle("dot-off", !isOn);
  });

  const expiresOn = data?.coi?.expiresOn;
  if (coiMetaText && expiresOn) {
    const lang = document.documentElement.lang || "en";
    const label = (I18N[lang]?.["prequal.coiExpires"] || "Expires");
    coiMetaText.textContent = `${label}: ${formatDate(expiresOn)}`;
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
  const snap = await getDoc(getPrequalDocRef(user.uid));
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

  if (link && coi.filePath) {
    try {
      const url = await getDownloadURL(ref(storage, coi.filePath));
      link.href = url;
      link.hidden = false;
    } catch {
      link.hidden = true;
    }
  }

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

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `users/${user.uid}/coi/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Uploading…";

      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });

      await setDoc(getPrequalDocRef(user.uid), {
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

async function getAgreementDocRef(uid) {
  return doc(db, "users", uid, "private", "agreement");
}

function collectAgreementData() {
  return {
    subcontractorName: (document.getElementById("agreementSubName")?.value || "").trim(),
    initials: (document.getElementById("agreementInitials")?.value || "").trim().toUpperCase(),
    title: (document.getElementById("agreementTitle")?.value || "").trim(),
    signature: (document.getElementById("agreementSignature")?.value || "").trim(),
    date: (document.getElementById("agreementDate")?.value || "").trim(),
    accepted: !!document.getElementById("agreementAccept")?.checked,

    // Helps you prove which doc version was signed:
    agreementFile: "subagreement.pdf",
    agreementVersion: "v1"
  };
}

async function loadAgreement(user) {
  const refDoc = await getAgreementDocRef(user.uid);
  const snap = await getDoc(refDoc);
  return snap.exists() ? snap.data() : null;
}

async function saveAgreement(user, data) {
  const refDoc = await getAgreementDocRef(user.uid);
  await setDoc(refDoc, {
    ...data,
    signedAt: serverTimestamp()
  }, { merge: true });

  // mark prequal complete
  const prequalRef = await getPrequalDocRef(user.uid);
  await setDoc(prequalRef, {
    agreementCompleted: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function initAgreementPage(user) {
  const form = document.getElementById("agreementForm");
  if (!form) return;

  const msg = document.getElementById("agreementMsg");
  const err = document.getElementById("agreementErr");
  const btn = document.getElementById("agreementSignBtn");

  // preload if previously signed
  const existing = await loadAgreement(user);
  if (existing) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    setVal("agreementSubName", existing.subcontractorName);
    setVal("agreementInitials", existing.initials);
    setVal("agreementTitle", existing.title);
    setVal("agreementSignature", existing.signature);
    setVal("agreementDate", existing.date);
    const accept = document.getElementById("agreementAccept");
    if (accept) accept.checked = !!existing.accepted;
    if (msg && existing.signedAt?.toDate) msg.textContent = `Loaded prior signature: ${existing.signedAt.toDate().toLocaleString()}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const data = collectAgreementData();
    if (!data.subcontractorName) { if (err) err.textContent = "Subcontractor name is required."; return; }
    if (!data.initials) { if (err) err.textContent = "Initials are required."; return; }
    if (!data.signature) { if (err) err.textContent = "Signature is required."; return; }
    if (!data.date) { if (err) err.textContent = "Date is required."; return; }
    if (!data.accepted) { if (err) err.textContent = "Please check the agreement box to proceed."; return; }

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Saving…";
      await saveAgreement(user, data);
      if (msg) msg.textContent = "Saved. Your agreement is now signed and stored in your account.";
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Save failed. Please try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}


/* ========= W-9 data model =========
   Firestore doc: users/{uid}/private/w9
   Also updates users/{uid}/private/prequal { w9Completed: true }
*/
function getW9DocRef(uid) {
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

  if (data.taxClass) {
    const r = document.querySelector(`input[name="taxClass"][value="${data.taxClass}"]`);
    if (r) r.checked = true;
  }
  if (data.tinType) {
    const t = document.querySelector(`input[name="tinType"][value="${data.tinType}"]`);
    if (t) t.checked = true;
  }
}

function updateW9Preview(data) {
  document.querySelectorAll(".w9-txt[data-bind]").forEach(el => {
    const key = el.getAttribute("data-bind");
    el.textContent = data?.[key] ?? "";
  });

  const selected = data.taxClass || "";
  document.querySelectorAll(".w9-check[data-check]").forEach(box => {
    const key = box.getAttribute("data-check");
    box.classList.toggle("on", key === selected);
  });

  const llcWrap = document.getElementById("llcTypeWrap");
  const otherWrap = document.getElementById("otherTypeWrap");
  if (llcWrap) llcWrap.style.display = (selected === "llc") ? "block" : "none";
  if (otherWrap) otherWrap.style.display = (selected === "other") ? "block" : "none";
}

async function loadW9(user) {
  const snap = await getDoc(getW9DocRef(user.uid));
  return snap.exists() ? (snap.data() || null) : null;
}

async function saveW9(user, w9Data) {
  await setDoc(getW9DocRef(user.uid), {
    ...w9Data,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(getPrequalDocRef(user.uid), {
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

  document.getElementById("w9RefreshBtn")?.addEventListener("click", handler);
  handler();
}

async function initW9Page(user) {
  const msg = document.getElementById("w9Msg");
  const err = document.getElementById("w9Err");
  const btn = document.getElementById("w9SaveBtn");
  const meta = document.getElementById("w9LoadedMeta");

  const llcWrap = document.getElementById("llcTypeWrap");
  const otherWrap = document.getElementById("otherTypeWrap");
  if (llcWrap) llcWrap.style.display = "none";
  if (otherWrap) otherWrap.style.display = "none";

  const existing = await loadW9(user);
  if (existing) {
    fillW9Form(existing);
    updateW9Preview(existing);
    if (meta && existing.updatedAt?.toDate) {
      meta.textContent = `Loaded: ${existing.updatedAt.toDate().toLocaleString()}`;
    }
  }

  attachW9LivePreview();

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

/* ========= Existing UI bits ========= */

/* ========== Sidebar (Mobile Toggle + Active Link) ========= */
function initSidebarNav() {
  const toggle = document.querySelector(".sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  const sideNav = document.querySelector("#sideNav");
  if (!sidebar || !sideNav) return;

  const setOpen = (open) => {
    sidebar.classList.toggle("open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  // Toggle sidebar on mobile
  if (toggle) {
    toggle.addEventListener("click", () => setOpen(!sidebar.classList.contains("open")));
  }

  // Close after clicking a link (mobile)
  sideNav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target) || (toggle && toggle.contains(e.target))) return;
    setOpen(false);
  });

  // Mark active link
  const path = window.location.pathname.split("/").pop() || "index.html";
  sideNav.querySelectorAll("a").forEach(a => {
    const href = (a.getAttribute("href") || "").split("/").pop();
    if (href === path) a.classList.add("active");
  });
}


function initYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", async () => {
  initLanguage();
  initSidebarNav();
  initYear();

  const ok = await initFirebase();
  if (!ok) return;

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
      if (page === "w9") await initW9Page(user);
      if (page === "agreement") await initAgreementPage(user);
    } catch (e) {
      console.error(e);
    }

    (() => {
  const splash = document.getElementById("listo-splash");
  const loginRoot = document.getElementById("login-root");

  const LGroup = document.getElementById("LGroup");
  const CheckGroup = document.getElementById("CheckGroup");

  // Timing controls (tweak to taste)
  const startDelay = 150;     // wait a beat before animating
  const flipDuration = 720;   // should match CSS keyframes length
  const holdAfter = 350;      // time to hold final ✓isto before fading splash

  // Kick off
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      // Flip L out
      LGroup.classList.add("flip-out");

      // Flip check in slightly after L starts flipping
      setTimeout(() => {
        CheckGroup.style.opacity = "1";
        CheckGroup.classList.add("flip-in");
      }, Math.floor(flipDuration * 0.35));

      // Fade splash, reveal login
      setTimeout(() => {
        splash.style.opacity = "0";

        // reveal login
        loginRoot.classList.remove("login-hidden");
        loginRoot.classList.add("login-visible");

        // remove splash from layout after fade
        setTimeout(() => splash.remove(), 420);
      }, flipDuration + holdAfter);
    }, startDelay);
  });
})();

    
  });
});
