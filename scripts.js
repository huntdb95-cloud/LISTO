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
    "nav.dashboard": "Home",
    "nav.prequal": "Pre-Qualification",
    "nav.payroll": "Payroll",
    "nav.employees": "Employees",
    "nav.bookkeeping": "Bookkeeping",
    "nav.tools": "Tools",
    "nav.audit": "Audit Help",
    "nav.contractScanner": "Contract Scanner",
    "nav.invoiceBuilder": "Invoice Builder",
    "nav.account": "My Account",
    "nav.support": "Support",

    "hero.title": "Focus on your work. We'll handle the paperwork.",
    "hero.subtitle": "Stop wasting time on business tasks. Listo automates payroll tracking, document management, invoicing, and compliance—so you can get back to what you do best.",
    "hero.ctaPrimary": "Log In",
    "hero.ctaSecondary": "Sign Up",
    "landing.login": "Log In",

    "card.prequalTitle": "Pre-Qualification Checklist",
    "card.prequalDesc": "Complete these to earn a “Pre-Qualified” status.",
    "card.itemW9": "Fill out a W-9",
    "card.itemCOI": "Upload Certificate of Insurance (COI)",
    "card.itemAgreement": "Sign Subcontractor Agreement",
    "card.open": "Open",
    "card.goPrequal": "Go to Pre-Qualification",

    "value.speedTitle": "Save Hours Every Week",
    "value.speedDesc": "Automated tools handle repetitive paperwork, so you spend less time on admin and more time on projects.",
    "value.organizeTitle": "Stay Organized",
    "value.organizeDesc": "All your business documents, payroll records, and invoices in one secure place. No more hunting through folders.",
    "value.complianceTitle": "Stay Compliant",
    "value.complianceDesc": "Never miss a deadline. Automated reminders and audit-ready document packages keep you compliant year-round.",

    "tools.title": "Everything you need to run your business",
    "tools.subtitle": "Six powerful tools designed to automate the business side of contracting.",
    "tools.t1Title": "Payroll Tracker",
    "tools.t1Badge": "Time Saver",
    "tools.t1Desc": "Track employee payments with searchable history. Export to CSV for accounting. No more spreadsheets.",
    "tools.t1F1": "Quick entry",
    "tools.t1F2": "Search & filter",
    "tools.t1F3": "CSV export",
    "tools.t2Title": "Invoice Builder",
    "tools.t2Badge": "Professional",
    "tools.t2Desc": "Create professional invoices in minutes. Save templates, export PDFs, and email directly to clients.",
    "tools.t2F1": "PDF export",
    "tools.t2F2": "Email delivery",
    "tools.t2F3": "Save templates",
    "tools.t3Title": "Pre-Qualification Packet",
    "tools.t3Badge": "Get Work",
    "tools.t3Desc": "Complete W-9, upload COI, sign agreements, and upload additional documents. Build a complete pre-qualification packet to submit to contractors when applying for work.",
    "tools.t3F1": "W-9 form",
    "tools.t3F2": "COI upload",
    "tools.t3F3": "Agreements",
    "tools.t4Title": "Contract Scanner",
    "tools.t4Badge": "Translation",
    "tools.t4Desc": "Upload contracts and get instant Spanish translations. OCR technology extracts text from PDFs and images.",
    "tools.t4F1": "OCR scanning",
    "tools.t4F2": "Auto translate",
    "tools.t4F3": "Side-by-side view",
    "tools.t5Title": "Audit Help",
    "tools.t5Badge": "Compliance",
    "tools.t5Desc": "Prepare for audits with organized document packages. Upload files, answer questions, and generate PDF reports.",
    "tools.t5F1": "Document upload",
    "tools.t5F2": "PDF generation",
    "tools.t5F3": "Email package",
    "tools.t6Title": "Support & Resources",
    "tools.t6Badge": "Help",
    "tools.t6Desc": "Get help when you need it. FAQs, guides, and direct support to answer your questions.",
    "tools.t6F1": "FAQs",
    "tools.t6F2": "Guides",
    "tools.t6F3": "Direct support",
    "tools.openTool": "Open Tool →",

    "how.title": "How it works",
    "how.subtitle": "Get started in minutes. No complicated setup, no training required.",
    "how.s1Title": "Choose your tool",
    "how.s1Desc": "Pick the tool you need—payroll, invoicing, document management, or compliance.",
    "how.s2Title": "Get it done fast",
    "how.s2Desc": "Simple, intuitive interfaces let you complete tasks in minutes, not hours.",
    "how.s3Title": "Get back to work",
    "how.s3Desc": "With business tasks automated, you can focus on what you do best—your actual work.",

    "footer.note": "Built to help contractors focus on their work by automating the business side of things.",

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
    "prequal.dashboardTitle": "Completion Status",
    "prequal.completeBtn": "Complete",
    "prequal.completeW9": "Complete W-9",
    "prequal.completeCOI": "Complete COI",
    "prequal.completeAgreement": "Complete Agreement",
    "prequal.optional": "(Optional)",
    "prequal.itemW9": "W-9 Completed",
    "prequal.itemW9Card": "Fill out Your W9",
    "prequal.itemW9Desc": "Fill and submit your W-9.",
    "prequal.itemCOI": "Certificate of Insurance (COI)",
    "prequal.itemCOIShort": "Certificate of Insurance",
    "prequal.itemCOICard": "Upload your Certificate of Insurance",
    "prequal.itemCOIDesc": "Upload an active COI and set the expiration date.",
    "prequal.itemAgreement": "Subcontractor Agreement",
    "prequal.itemAgreementCard": "Sign a Subcontractors Agreement",
    "prequal.itemAgreementDesc": "Review and sign your agreement.",
    "prequal.itemBusinessLicense": "Business License",
    "prequal.itemBusinessLicenseDesc": "Upload your business license if applicable.",
    "prequal.itemWorkersComp": "Workers Compensation Exemption",
    "prequal.itemWorkersCompDesc": "Upload your workers compensation exemption certificate if applicable.",
    "prequal.uploadFile": "Upload File",
    "prequal.uploadBtn": "Upload",
    "prequal.currentFile": "Current File:",
    "prequal.uploaded": "Uploaded:",
    "prequal.viewDocument": "View",
    "prequal.download": "Download",
    "prequal.fileHint": "Accepted: PDF, PNG, JPG",
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

    "audit.title": "Audit Help",
    "audit.subtitle": "Printer-friendly package • PDF 8.5×11 • SendGrid email",
    "audit.description": "Learn about insurance audits and prepare your audit package with our step-by-step tool.",
    "audit.explanationTitle": "Audit Explanation",
    "audit.whyTitle": "Why do insurance audits exist?",
    "audit.whyDesc": "Insurance audits are a standard practice where your insurance carrier verifies the information you provided when you purchased your policy. Since workers' compensation premiums are based on your actual payroll, the carrier needs to confirm the amounts you paid during the policy period to calculate your final premium accurately.",
    "audit.expectationsTitle": "What to expect",
    "audit.expectationsDesc": "Your insurance carrier is verifying <b>payroll paid during your previous policy period</b> so your premium can be calculated correctly.",
    "audit.expectationsSubDesc": "During the audit, you'll typically need to provide:",
    "audit.expectations1": "Payroll amounts actually paid (by employee and totals)",
    "audit.expectations2": "Payment methods (check, cash, electronic)",
    "audit.expectations3": "Independent contractor payments (1099s) if applicable",
    "audit.expectations4": "Supporting bank statements and tax forms",
    "audit.processTitle": "The audit process",
    "audit.processDesc": "Most audits are straightforward. The auditor will review your payroll records, payment documentation, and any supporting materials you provide. They may ask clarifying questions about your business operations, payment methods, or subcontractor relationships. Being prepared with organized documentation makes the process smooth and helps ensure accurate premium calculations.",
    "audit.processNote": "The Audit Packet tool below helps you organize all necessary documents and information before your audit, compiling everything into a printer-friendly PDF package that you can email directly to your auditor.",
    "audit.packetTitle": "Audit Packet",
    "audit.packetDesc": "Use this tool to prepare your audit package by collecting your payroll summary (for your prior policy period), supporting documents, and a short questionnaire.",
    "audit.policyStart": "Policy Start Date",
    "audit.policyEnd": "Policy End Date",
    "audit.policyNumber": "Policy Number",
    "audit.taxId": "Tax ID (EIN or SSN)",
    "audit.quickActions": "Quick actions",
    "audit.loadPayroll": "Load payroll summary",
    "audit.clear": "Clear",
    "audit.businessTitle": "1) Business information",
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
    "audit.questionnaireTitle": "2) Audit questionnaire",
    "audit.questionnaireDesc": "Answer these questions to help complete your audit package.",
    "audit.qCash": "Were any payments made in cash?",
    "audit.qCashExplain": "If yes, explain",
    "audit.qSubs": "Did you pay any subcontractors (1099)?",
    "audit.qCOI": "Did you collect COIs from subcontractors?",
    "audit.qOwnerLabor": "Did you perform any owner labor?",
    "audit.qChanges": "Any changes to your business during the period?",
    "audit.qNotes": "Additional notes for auditor (optional)",
    "audit.saveQuestionnaire": "Save questionnaire",
    "audit.generateTitle": "5) Download a Copy or Email Packet",
    "audit.downloadTitle": "5) Download a Copy or Email Packet",
    "audit.generateDesc": "This generates a printer-friendly PDF and sends it (plus uploaded documents) via SendGrid.",
    "audit.generatePdf": "Generate PDF preview",
    "audit.downloadPacket": "Download Packet",
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
    "support.resource3": "Audit Preparation",
    "support.faqTitle": "Frequently Asked Questions",

    "dashboard.title": "Welcome back!",
    "dashboard.subtitle": "Here's an overview of your account and quick access to your tools.",
    "dashboard.accountInfo": "Account Information",
    "dashboard.name": "Name:",
    "dashboard.email": "Email:",
    "dashboard.accountCreated": "Account Created:",
    "dashboard.editAccount": "Edit Account",
    "dashboard.facebookFeed": "News & Updates",
    "dashboard.quickLinks": "Quick Links",
    "dashboard.prequalDesc": "Complete your pre-qualification checklist",
    "dashboard.payrollDesc": "Track employee payments",
    "dashboard.invoiceDesc": "Create and send invoices",
    "dashboard.auditDesc": "Prepare for insurance audits",

    "employees.title": "Employee Management",
    "employees.subtitle": "Add and manage your employees and subcontractors. Upload W9s, COIs, and Workers Compensation documents.",
    "employees.addEmployee": "Add Employee",
    "employees.name": "Full Name",
    "employees.email": "Email",
    "employees.phone": "Phone",
    "employees.type": "Type",
    "employees.typeEmployee": "Employee",
    "employees.typeSubcontractor": "Subcontractor",
    "employees.subcontractorDocs": "Subcontractor Documents",
    "employees.subcontractorDocsDesc": "Upload either a Certificate of Insurance (COI) or a Workers Compensation Exemption.",
    "employees.coi": "Certificate of Insurance (COI)",
    "employees.coiHint": "PDF, PNG, or JPG (max 10MB)",
    "employees.workersComp": "Workers Compensation Exemption",
    "employees.workersCompHint": "PDF, PNG, or JPG (max 10MB)",
    "employees.w9": "W-9 Form",
    "employees.w9Hint": "PDF, PNG, or JPG (max 10MB)",
    "employees.save": "Save Employee",
    "employees.cancel": "Cancel",
    "employees.listTitle": "Employees & Subcontractors",
    "employees.loading": "Loading...",
    "employees.noEmployees": "No employees added yet. Click \"Add Employee\" to get started.",
    "employees.edit": "Edit",
    "employees.delete": "Delete",

    "bookkeeping.title": "Bookkeeping",
    "bookkeeping.subtitle": "Manage your payroll and employees in one place.",
    "bookkeeping.tabPayroll": "Payroll",
    "bookkeeping.tabEmployees": "Employees",
    "bookkeeping.addPayment": "Add Payment",
    "bookkeeping.employee": "Employee",
    "bookkeeping.employeeHint": "New names will be saved automatically.",
    "bookkeeping.paymentDate": "Payment Date",
    "bookkeeping.amount": "Amount",
    "bookkeeping.method": "Method",
    "bookkeeping.savePayment": "Save Payment",
    "bookkeeping.reset": "Reset",
    "bookkeeping.paymentsThisMonth": "Payments (This Month)",
    "bookkeeping.totalThisMonth": "Total Paid (This Month)",
    "bookkeeping.totalAllTime": "Total Paid (All Time)",
    "bookkeeping.tip": "Tip: You can search and filter the table on the right to find any payment quickly.",
    "bookkeeping.paymentHistory": "Payment History",
    "bookkeeping.allMethods": "All Methods",
    "bookkeeping.exportCsv": "Export CSV",
    "bookkeeping.clearFilters": "Clear Filters",
    "bookkeeping.date": "Date",
    "bookkeeping.actions": "Actions",

    "support.faq1Q": "How do I become Pre-Qualified?",
    "support.faq1A": "Complete three items: fill out your W-9, upload an active Certificate of Insurance (COI), and sign the Subcontractor Agreement. Once all three are complete, you'll earn Pre-Qualified status.",
    "support.faq2Q": "How do I track payroll payments?",
    "support.faq2A": "Use the Payroll Tracker to record each payment with the employee name, payment date, amount, and payment method. You can search and filter your payment history, and export it as a CSV file.",
    "support.faq3Q": "What documents do I need for an insurance audit?",
    "support.faq3A": "Common documents include Schedule C, bank statements, payroll summaries, and invoices. Use the Audit Help Tool to upload documents and generate a printer-friendly PDF package for your audit.",
    "support.faq4Q": "Can I update my COI after uploading it?",
    "support.faq4A": "Yes! You can upload a new COI anytime. The latest upload becomes your active COI. Make sure to set the correct expiration date when uploading.",
    "support.faq5Q": "How does the Contract Scanner work?",
    "support.faq5A": "Upload a contract document (PDF, HEIC, JPG, or PNG). The tool uses Google OCR to extract text and translates it into Spanish. View both the original English text and Spanish translation side-by-side.",

    "account.title": "My Account",
    "account.subtitle": "Manage your account settings and profile information.",
    "account.profileTitle": "Profile Picture",
    "account.profileDesc": "Upload your company logo. It will appear in a circular container, or your initials will be shown if no logo is uploaded.",
    "account.logoLabel": "Logo File",
    "account.logoHint": "Accepted: JPG, PNG, GIF, WebP (max 5MB)",
    "account.uploadLogo": "Upload Logo",
    "account.removeLogo": "Remove Logo",
    "account.infoTitle": "Account Information",
    "account.nameTitle": "Name",
    "account.nameDesc": "Your name as it will appear in your account.",
    "account.nameLabel": "Full Name",
    "account.updateName": "Update Name",
    "account.emailTitle": "Email Address",
    "account.currentEmail": "Current email:",
    "account.newEmailLabel": "New Email Address",
    "account.passwordConfirm": "Current Password (required)",
    "account.updateEmail": "Update Email",
    "account.passwordTitle": "Password",
    "account.passwordDesc": "Change your password to keep your account secure.",
    "account.currentPasswordLabel": "Current Password",
    "account.newPasswordLabel": "New Password",
    "account.passwordHint": "Minimum 6 characters",
    "account.confirmPasswordLabel": "Confirm New Password",
    "account.updatePassword": "Update Password",
    "account.languageTitle": "Language Preference",
    "account.languageDesc": "Choose your preferred language for the application interface.",
    "account.languageLabel": "Language"
  },

  es: {
    "nav.menu": "Menú",
    "nav.home": "Inicio",
    "nav.dashboard": "Inicio",
    "nav.prequal": "Precalificación",
    "nav.payroll": "Nómina",
    "nav.employees": "Empleados",
    "nav.bookkeeping": "Contabilidad",
    "nav.tools": "Herramientas",
    "nav.audit": "Ayuda de Auditoría",
    "nav.contractScanner": "Escáner de Contratos",
    "nav.invoiceBuilder": "Generador de Facturas",
    "nav.support": "Soporte",

    "hero.title": "Precalifícate. Cobra. Sé elegido.",
    "hero.subtitle": "Listo ayuda a subcontratistas a completar requisitos de incorporación, estar listos para auditorías y crear un perfil confiable para contratistas generales.",
    "hero.ctaPrimary": "Iniciar Sesión",
    "hero.ctaSecondary": "Registrarse",
    "landing.login": "Iniciar Sesión",
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

    "value.speedTitle": "Ahorra Horas Cada Semana",
    "value.speedDesc": "Las herramientas automatizadas manejan el papeleo repetitivo, para que pases menos tiempo en administración y más tiempo en proyectos.",
    "value.organizeTitle": "Mantente Organizado",
    "value.organizeDesc": "Todos tus documentos comerciales, registros de nómina e facturas en un lugar seguro. No más buscar en carpetas.",
    "value.complianceTitle": "Mantente Cumplido",
    "value.complianceDesc": "Nunca pierdas una fecha límite. Recordatorios automatizados y paquetes de documentos listos para auditoría te mantienen cumplido todo el año.",

    "tools.title": "Todo lo que necesitas para administrar tu negocio",
    "tools.subtitle": "Seis herramientas poderosas diseñadas para automatizar el lado comercial de la contratación.",
    "tools.t1Title": "Rastreador de Nómina",
    "tools.t1Badge": "Ahorra Tiempo",
    "tools.t1Desc": "Rastrea pagos de empleados con historial buscable. Exporta a CSV para contabilidad. No más hojas de cálculo.",
    "tools.t1F1": "Entrada rápida",
    "tools.t1F2": "Buscar y filtrar",
    "tools.t1F3": "Exportar CSV",
    "tools.t2Title": "Generador de Facturas",
    "tools.t2Badge": "Profesional",
    "tools.t2Desc": "Crea facturas profesionales en minutos. Guarda plantillas, exporta PDFs y envía por correo directamente a clientes.",
    "tools.t2F1": "Exportar PDF",
    "tools.t2F2": "Envío por correo",
    "tools.t2F3": "Guardar plantillas",
    "tools.t3Title": "Paquete de Precalificación",
    "tools.t3Badge": "Conseguir Trabajo",
    "tools.t3Desc": "Completa W-9, sube COI, firma acuerdos y sube documentos adicionales. Construye un paquete completo de precalificación para enviar a contratistas al solicitar trabajo.",
    "tools.t3F1": "Formulario W-9",
    "tools.t3F2": "Subir COI",
    "tools.t3F3": "Acuerdos",
    "tools.t4Title": "Escáner de Contratos",
    "tools.t4Badge": "Traducción",
    "tools.t4Desc": "Sube contratos y obtén traducciones instantáneas al español. La tecnología OCR extrae texto de PDFs e imágenes.",
    "tools.t4F1": "Escaneo OCR",
    "tools.t4F2": "Traducir automático",
    "tools.t4F3": "Vista lado a lado",
    "tools.t5Title": "Ayuda de Auditoría",
    "tools.t5Badge": "Cumplimiento",
    "tools.t5Desc": "Prepárate para auditorías con paquetes de documentos organizados. Sube archivos, responde preguntas y genera informes PDF.",
    "tools.t5F1": "Subir documentos",
    "tools.t5F2": "Generar PDF",
    "tools.t5F3": "Enviar paquete",
    "tools.t6Title": "Soporte y Recursos",
    "tools.t6Badge": "Ayuda",
    "tools.t6Desc": "Obtén ayuda cuando la necesites. Preguntas frecuentes, guías y soporte directo para responder tus preguntas.",
    "tools.t6F1": "Preguntas frecuentes",
    "tools.t6F2": "Guías",
    "tools.t6F3": "Soporte directo",
    "tools.openTool": "Abrir Herramienta →",

    "how.title": "Cómo funciona",
    "how.subtitle": "Comienza en minutos. Sin configuración complicada, sin capacitación requerida.",
    "how.s1Title": "Elige tu herramienta",
    "how.s1Desc": "Elige la herramienta que necesitas—nómina, facturación, gestión de documentos o cumplimiento.",
    "how.s2Title": "Hazlo rápido",
    "how.s2Desc": "Interfaces simples e intuitivas te permiten completar tareas en minutos, no horas.",
    "how.s3Title": "Vuelve al trabajo",
    "how.s3Desc": "Con las tareas comerciales automatizadas, puedes enfocarte en lo que mejor sabes hacer—tu trabajo real.",

    "footer.note": "Construido para ayudar a contratistas a enfocarse en su trabajo automatizando el lado comercial de las cosas.",

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
    "prequal.dashboardTitle": "Estado de Completitud",
    "prequal.completeBtn": "Completar",
    "prequal.completeW9": "Completar W-9",
    "prequal.completeCOI": "Completar COI",
    "prequal.completeAgreement": "Completar Acuerdo",
    "prequal.optional": "(Opcional)",
    "prequal.itemW9": "W-9 Completado",
    "prequal.itemW9Card": "Completa tu W9",
    "prequal.itemW9Desc": "Completa y envía tu W-9.",
    "prequal.itemCOI": "Certificado de Seguro (COI)",
    "prequal.itemCOIShort": "Certificado de Seguro",
    "prequal.itemCOICard": "Sube tu Certificado de Seguro",
    "prequal.itemCOIDesc": "Sube un COI vigente y define la fecha de vencimiento.",
    "prequal.itemAgreement": "Acuerdo de Subcontratista",
    "prequal.itemAgreementCard": "Firma un Acuerdo de Subcontratistas",
    "prequal.itemAgreementDesc": "Revisa y firma tu acuerdo.",
    "prequal.itemBusinessLicense": "Licencia Comercial",
    "prequal.itemBusinessLicenseDesc": "Sube tu licencia comercial si aplica.",
    "prequal.itemWorkersComp": "Exención de Compensación de Trabajadores",
    "prequal.itemWorkersCompDesc": "Sube tu certificado de exención de compensación de trabajadores si aplica.",
    "prequal.uploadFile": "Subir Archivo",
    "prequal.uploadBtn": "Subir",
    "prequal.currentFile": "Archivo Actual:",
    "prequal.uploaded": "Subido:",
    "prequal.viewDocument": "Ver",
    "prequal.download": "Descargar",
    "prequal.fileHint": "Aceptado: PDF, PNG, JPG",
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

    "audit.title": "Ayuda de Auditoría",
    "audit.subtitle": "Paquete para imprimir • PDF 8.5×11 • Email SendGrid",
    "audit.description": "Aprende sobre las auditorías de seguro y prepara tu paquete de auditoría con nuestra herramienta paso a paso.",
    "audit.explanationTitle": "Explicación de Auditoría",
    "audit.whyTitle": "¿Por qué existen las auditorías de seguro?",
    "audit.whyDesc": "Las auditorías de seguro son una práctica estándar donde tu aseguradora verifica la información que proporcionaste cuando compraste tu póliza. Dado que las primas de compensación de trabajadores se basan en tu nómina real, la aseguradora necesita confirmar las cantidades que pagaste durante el período de la póliza para calcular tu prima final con precisión.",
    "audit.expectationsTitle": "Qué esperar",
    "audit.expectationsDesc": "Tu aseguradora está verificando <b>la nómina pagada durante tu período de póliza anterior</b> para que tu prima se calcule correctamente.",
    "audit.expectationsSubDesc": "Durante la auditoría, típicamente necesitarás proporcionar:",
    "audit.expectations1": "Montos de nómina realmente pagados (por empleado y totales)",
    "audit.expectations2": "Métodos de pago (cheque, efectivo, electrónico)",
    "audit.expectations3": "Pagos a contratistas independientes (1099) si aplica",
    "audit.expectations4": "Estados bancarios y formularios fiscales de respaldo",
    "audit.processTitle": "El proceso de auditoría",
    "audit.processDesc": "La mayoría de las auditorías son sencillas. El auditor revisará tus registros de nómina, documentación de pagos y cualquier material de respaldo que proporciones. Pueden hacer preguntas aclaratorias sobre tus operaciones comerciales, métodos de pago o relaciones con subcontratistas. Estar preparado con documentación organizada hace que el proceso sea fluido y ayuda a garantizar cálculos precisos de primas.",
    "audit.processNote": "La herramienta de Paquete de Auditoría a continuación te ayuda a organizar todos los documentos e información necesarios antes de tu auditoría, compilando todo en un paquete PDF para imprimir que puedes enviar por email directamente a tu auditor.",
    "audit.packetTitle": "Paquete de Auditoría",
    "audit.packetDesc": "Usa esta herramienta para preparar tu paquete de auditoría recopilando tu resumen de nómina (para tu período de póliza anterior), documentos de respaldo y un cuestionario corto.",
    "audit.policyStart": "Fecha de Inicio de Póliza",
    "audit.policyEnd": "Fecha de Fin de Póliza",
    "audit.policyNumber": "Número de Póliza",
    "audit.taxId": "ID Fiscal (EIN o SSN)",
    "audit.quickActions": "Acciones rápidas",
    "audit.loadPayroll": "Cargar resumen de nómina",
    "audit.clear": "Limpiar",
    "audit.businessTitle": "1) Información del negocio",
    "audit.businessName": "Nombre del Negocio",
    "audit.phone": "Teléfono",
    "audit.copyEmail": "Correo de Copia (para paquete de auditoría)",
    "audit.auditorEmail": "Correo del Auditor",
    "audit.uploadTitle": "4) Subir documentos de respaldo",
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
    "audit.questionnaireTitle": "2) Cuestionario de auditoría",
    "audit.questionnaireDesc": "Responde estas preguntas para ayudar a completar tu paquete de auditoría.",
    "audit.qCash": "¿Se hicieron pagos en efectivo?",
    "audit.qCashExplain": "Si sí, explica",
    "audit.qSubs": "¿Pagaste a subcontratistas (1099)?",
    "audit.qCOI": "¿Recolectaste COIs de subcontratistas?",
    "audit.qOwnerLabor": "¿Realizaste trabajo del dueño?",
    "audit.qChanges": "¿Algún cambio en tu negocio durante el período?",
    "audit.qNotes": "Notas adicionales para el auditor (opcional)",
    "audit.saveQuestionnaire": "Guardar cuestionario",
    "audit.generateTitle": "5) Descargar una Copia o Enviar Paquete por Email",
    "audit.downloadTitle": "5) Descargar una Copia o Enviar Paquete por Email",
    "audit.generateDesc": "Esto genera un PDF para imprimir y lo envía (más documentos subidos) vía SendGrid.",
    "audit.generatePdf": "Generar vista previa PDF",
    "audit.downloadPacket": "Descargar Paquete",
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
    "support.resource3": "Preparación para Auditoría",
    "support.faqTitle": "Preguntas Frecuentes",

    "dashboard.title": "¡Bienvenido de nuevo!",
    "dashboard.subtitle": "Aquí tienes un resumen de tu cuenta y acceso rápido a tus herramientas.",
    "dashboard.accountInfo": "Información de la Cuenta",
    "dashboard.name": "Nombre:",
    "dashboard.email": "Correo:",
    "dashboard.accountCreated": "Cuenta Creada:",
    "dashboard.editAccount": "Editar Cuenta",
    "dashboard.facebookFeed": "Noticias y Actualizaciones",
    "dashboard.quickLinks": "Enlaces Rápidos",
    "dashboard.prequalDesc": "Completa tu lista de precalificación",
    "dashboard.payrollDesc": "Rastrea pagos de empleados",
    "dashboard.invoiceDesc": "Crea y envía facturas",
    "dashboard.auditDesc": "Prepárate para auditorías de seguro",

    "employees.title": "Gestión de Empleados",
    "employees.subtitle": "Agrega y gestiona tus empleados y subcontratistas. Sube W9s, COIs y documentos de Compensación de Trabajadores.",
    "employees.addEmployee": "Agregar Empleado",
    "employees.name": "Nombre Completo",
    "employees.email": "Correo",
    "employees.phone": "Teléfono",
    "employees.type": "Tipo",
    "employees.typeEmployee": "Empleado",
    "employees.typeSubcontractor": "Subcontratista",
    "employees.subcontractorDocs": "Documentos de Subcontratista",
    "employees.subcontractorDocsDesc": "Sube un Certificado de Seguro (COI) o una Exención de Compensación de Trabajadores.",
    "employees.coi": "Certificado de Seguro (COI)",
    "employees.coiHint": "PDF, PNG o JPG (máx 10MB)",
    "employees.workersComp": "Exención de Compensación de Trabajadores",
    "employees.workersCompHint": "PDF, PNG o JPG (máx 10MB)",
    "employees.w9": "Formulario W-9",
    "employees.w9Hint": "PDF, PNG o JPG (máx 10MB)",
    "employees.save": "Guardar Empleado",
    "employees.cancel": "Cancelar",
    "employees.listTitle": "Empleados y Subcontratistas",
    "employees.loading": "Cargando...",
    "employees.noEmployees": "Aún no se han agregado empleados. Haz clic en \"Agregar Empleado\" para comenzar.",
    "employees.edit": "Editar",
    "employees.delete": "Eliminar",

    "bookkeeping.title": "Contabilidad",
    "bookkeeping.subtitle": "Administra tu nómina y empleados en un solo lugar.",
    "bookkeeping.tabPayroll": "Nómina",
    "bookkeeping.tabEmployees": "Empleados",
    "bookkeeping.addPayment": "Agregar Pago",
    "bookkeeping.employee": "Empleado",
    "bookkeeping.employeeHint": "Los nombres nuevos se guardarán automáticamente.",
    "bookkeeping.paymentDate": "Fecha de Pago",
    "bookkeeping.amount": "Cantidad",
    "bookkeeping.method": "Método",
    "bookkeeping.savePayment": "Guardar Pago",
    "bookkeeping.reset": "Restablecer",
    "bookkeeping.paymentsThisMonth": "Pagos (Este Mes)",
    "bookkeeping.totalThisMonth": "Total Pagado (Este Mes)",
    "bookkeeping.totalAllTime": "Total Pagado (Todo el Tiempo)",
    "bookkeeping.tip": "Consejo: Puedes buscar y filtrar la tabla a la derecha para encontrar cualquier pago rápidamente.",
    "bookkeeping.paymentHistory": "Historial de Pagos",
    "bookkeeping.allMethods": "Todos los Métodos",
    "bookkeeping.exportCsv": "Exportar CSV",
    "bookkeeping.clearFilters": "Limpiar Filtros",
    "bookkeeping.date": "Fecha",
    "bookkeeping.actions": "Acciones",

    "support.faq1Q": "¿Cómo me convierto en Precalificado?",
    "support.faq1A": "Completa tres elementos: completa tu W-9, sube un Certificado de Seguro (COI) activo y firma el Acuerdo de Subcontratista. Una vez que los tres estén completos, obtendrás el estatus de Precalificado.",
    "support.faq2Q": "¿Cómo registro los pagos de nómina?",
    "support.faq2A": "Usa el Rastreador de Nómina para registrar cada pago con el nombre del empleado, fecha de pago, monto y método de pago. Puedes buscar y filtrar tu historial de pagos, y exportarlo como archivo CSV.",
    "support.faq3Q": "¿Qué documentos necesito para una auditoría de seguro?",
    "support.faq3A": "Los documentos comunes incluyen Schedule C, estados de cuenta bancarios, resúmenes de nómina e facturas. Usa la Herramienta de Ayuda de Auditoría para subir documentos y generar un paquete PDF listo para imprimir para tu auditoría.",
    "support.faq4Q": "¿Puedo actualizar mi COI después de subirlo?",
    "support.faq4A": "¡Sí! Puedes subir un COI nuevo en cualquier momento. La última carga se convierte en tu COI activo. Asegúrate de establecer la fecha de vencimiento correcta al subirlo.",
    "support.faq5Q": "¿Cómo funciona el Escáner de Contratos?",
    "support.faq5A": "Sube un documento de contrato (PDF, HEIC, JPG o PNG). La herramienta usa Google OCR para extraer texto y lo traduce al español. Ve tanto el texto original en inglés como la traducción al español lado a lado.",

    "account.title": "Mi Cuenta",
    "account.subtitle": "Administra la configuración de tu cuenta e información de perfil.",
    "account.profileTitle": "Foto de Perfil",
    "account.profileDesc": "Sube el logo de tu empresa. Aparecerá en un contenedor circular, o se mostrarán tus iniciales si no se sube ningún logo.",
    "account.logoLabel": "Archivo de Logo",
    "account.logoHint": "Aceptado: JPG, PNG, GIF, WebP (máx. 5MB)",
    "account.uploadLogo": "Subir Logo",
    "account.removeLogo": "Eliminar Logo",
    "account.infoTitle": "Información de la Cuenta",
    "account.nameTitle": "Nombre",
    "account.nameDesc": "Tu nombre tal como aparecerá en tu cuenta.",
    "account.nameLabel": "Nombre Completo",
    "account.updateName": "Actualizar Nombre",
    "account.emailTitle": "Dirección de Correo",
    "account.currentEmail": "Correo actual:",
    "account.newEmailLabel": "Nueva Dirección de Correo",
    "account.passwordConfirm": "Contraseña Actual (requerida)",
    "account.updateEmail": "Actualizar Correo",
    "account.passwordTitle": "Contraseña",
    "account.passwordDesc": "Cambia tu contraseña para mantener tu cuenta segura.",
    "account.currentPasswordLabel": "Contraseña Actual",
    "account.newPasswordLabel": "Nueva Contraseña",
    "account.passwordHint": "Mínimo 6 caracteres",
    "account.confirmPasswordLabel": "Confirmar Nueva Contraseña",
    "account.updatePassword": "Actualizar Contraseña",
    "account.languageTitle": "Preferencia de Idioma",
    "account.languageDesc": "Elige tu idioma preferido para la interfaz de la aplicación.",
    "account.languageLabel": "Idioma"
  }
};

const LANG_KEY = "listo_lang";
function setPressedButtons(lang) {
  document.querySelectorAll("[data-lang]").forEach(btn => {
    const isActive = btn.getAttribute("data-lang") === lang;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}
// Simple HTML sanitizer - only allows safe formatting tags
// Whitelist approach: strip out any tags not in the allowed list
function sanitizeHTML(html) {
  // Only allow specific safe formatting tags: b, strong, i, em, u, br, p
  const allowedTags = ["b", "strong", "i", "em", "u", "br", "p"];
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  return html.replace(tagPattern, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    // Only allow whitelisted tags, strip everything else
    if (allowedTags.includes(lowerTag)) {
      // Remove any attributes from allowed tags for safety
      return match.replace(/\s+[^>]*/, "").replace(/<(\w+)[^>]*>/, "<$1>");
    }
    // Remove disallowed tags entirely
    return "";
  });
}

function applyTranslations(lang) {
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      // Sanitize HTML to prevent XSS - only allow safe formatting tags
      const translation = dict[key];
      if (translation.includes("<") && translation.includes(">")) {
        el.innerHTML = sanitizeHTML(translation);
      } else {
        el.textContent = translation;
      }
    }
  });
  setPressedButtons(lang);
  localStorage.setItem(LANG_KEY, lang);
}

// Make applyTranslations available globally for account.js
if (typeof window !== 'undefined') {
  window.applyTranslations = applyTranslations;
}

async function loadUserLanguage(user) {
  if (!user || !db) return null;
  
  try {
    const profileRef = doc(db, "users", user.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      return profileData.language || null;
    }
  } catch (err) {
    console.warn("Error loading user language:", err);
  }
  return null;
}

function initLanguage() {
  // For non-authenticated pages (login, signup, forgot password, landing), use localStorage
  const saved = localStorage.getItem(LANG_KEY);
  const lang = (saved && I18N[saved]) ? saved : "en";
  applyTranslations(lang);
  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => applyTranslations(btn.getAttribute("data-lang")));
  });
}

async function initLanguageForUser(user) {
  if (!user) {
    initLanguage();
    return;
  }
  
  // Load language from Firestore profile
  const userLang = await loadUserLanguage(user);
  const lang = (userLang && I18N[userLang]) ? userLang : (localStorage.getItem(LANG_KEY) || "en");
  
  applyTranslations(lang);
  
  // Set up language toggle buttons if they exist (for login/signup/forgot pages)
  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const selectedLang = btn.getAttribute("data-lang");
      applyTranslations(selectedLang);
      // For authenticated users, save to Firestore
      if (user) {
        try {
          const profileRef = doc(db, "users", user.uid, "private", "profile");
          await setDoc(profileRef, {
            language: selectedLang,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Error saving language preference:", err);
        }
      }
    });
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
  // Default: go to dashboard.html
  return "../dashboard.html";
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
    window.location.href = `${loginPath}?next=${encodeURIComponent(next || "/dashboard.html")}`;
    return;
  }

  if (user && (page === "login" || page === "signup")) {
    window.location.href = getNextUrl();
  }

  // Redirect authenticated users away from landing page to dashboard
  if (user && page === "landing") {
    window.location.href = "dashboard.html";
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
        // Calculate relative path to dashboard.html from current location
        const pathSegments = window.location.pathname.split("/").filter(p => p && !p.endsWith(".html"));
        const depth = pathSegments.length;
        const dashboardPath = depth > 0 ? "../".repeat(depth) + "dashboard.html" : "dashboard.html";
        window.location.href = dashboardPath;
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
  const coiMetaText = document.getElementById("coiMetaText");

  const w9 = !!data.w9Completed;
  const coi = !!data.coiCompleted;
  const agr = !!data.agreementCompleted;
  const hasBusinessLicense = !!data.businessLicense;
  const hasWorkersComp = !!data.workersComp;

  // Update status dots (both dashboard and card dots)
  const w9Dot = document.getElementById("w9Dot");
  const coiDot = document.getElementById("coiDot");
  const agreementDot = document.getElementById("agreementDot");
  const businessLicenseDot = document.getElementById("businessLicenseDot");
  const workersCompDot = document.getElementById("workersCompDot");
  
  // Dashboard dots
  const dashboardW9Dot = document.getElementById("dashboardW9Dot");
  const dashboardCoiDot = document.getElementById("dashboardCoiDot");
  const dashboardAgreementDot = document.getElementById("dashboardAgreementDot");
  const dashboardBusinessLicenseDot = document.getElementById("dashboardBusinessLicenseDot");
  const dashboardWorkersCompDot = document.getElementById("dashboardWorkersCompDot");

  if (w9Dot) {
    w9Dot.classList.toggle("dot-on", w9);
    w9Dot.classList.toggle("dot-off", !w9);
  }
  if (dashboardW9Dot) {
    dashboardW9Dot.classList.toggle("dot-on", w9);
    dashboardW9Dot.classList.toggle("dot-off", !w9);
  }
  if (coiDot) {
    coiDot.classList.toggle("dot-on", coi);
    coiDot.classList.toggle("dot-off", !coi);
  }
  if (dashboardCoiDot) {
    dashboardCoiDot.classList.toggle("dot-on", coi);
    dashboardCoiDot.classList.toggle("dot-off", !coi);
  }
  if (agreementDot) {
    agreementDot.classList.toggle("dot-on", agr);
    agreementDot.classList.toggle("dot-off", !agr);
  }
  if (dashboardAgreementDot) {
    dashboardAgreementDot.classList.toggle("dot-on", agr);
    dashboardAgreementDot.classList.toggle("dot-off", !agr);
  }
  if (businessLicenseDot) {
    businessLicenseDot.classList.toggle("dot-on", hasBusinessLicense);
    businessLicenseDot.classList.toggle("dot-off", !hasBusinessLicense);
  }
  if (dashboardBusinessLicenseDot) {
    dashboardBusinessLicenseDot.classList.toggle("dot-on", hasBusinessLicense);
    dashboardBusinessLicenseDot.classList.toggle("dot-off", !hasBusinessLicense);
  }
  if (workersCompDot) {
    workersCompDot.classList.toggle("dot-on", hasWorkersComp);
    workersCompDot.classList.toggle("dot-off", !hasWorkersComp);
  }
  if (dashboardWorkersCompDot) {
    dashboardWorkersCompDot.classList.toggle("dot-on", hasWorkersComp);
    dashboardWorkersCompDot.classList.toggle("dot-off", !hasWorkersComp);
  }

  const expiresOn = data?.coi?.expiresOn;
  if (coiMetaText && expiresOn) {
    const lang = document.documentElement.lang || "en";
    const label = (I18N[lang]?.["prequal.coiExpires"] || "Expires");
    coiMetaText.textContent = `${label}: ${formatDate(expiresOn)}`;
  }

  // Show/hide view buttons based on completion status
  const w9ViewBtn = document.getElementById("w9ViewBtn");
  if (w9ViewBtn) {
    w9ViewBtn.style.display = w9 ? "inline-block" : "none";
  }

  const coiViewBtn = document.getElementById("coiViewBtn");
  if (coiViewBtn && coi && data?.coi?.filePath) {
    coiViewBtn.style.display = "inline-block";
    // Set the COI view link URL
    getDownloadURL(ref(storage, data.coi.filePath)).then(url => {
      coiViewBtn.href = url;
    }).catch(err => {
      console.error("Error getting COI URL:", err);
    });
  } else if (coiViewBtn) {
    coiViewBtn.style.display = "none";
  }

  const agreementViewBtn = document.getElementById("agreementViewBtn");
  if (agreementViewBtn) {
    agreementViewBtn.style.display = agr ? "inline-block" : "none";
  }
}

async function initPrequalPage(user) {
  const data = await loadPrequalStatus(user.uid);
  updatePrequalUI(data);

  // Initialize Business License upload
  initBusinessLicenseUpload(user);

  // Initialize Workers Comp upload
  initWorkersCompUpload(user);
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
  const coiCurrent = document.getElementById("coiCurrent");

  if (!coi) {
    if (fileEl) fileEl.textContent = "—";
    if (expEl) expEl.textContent = "—";
    if (upEl) upEl.textContent = "—";
    if (link) link.hidden = true;
    if (note) note.hidden = true;
    if (coiCurrent) coiCurrent.hidden = true;
    return;
  }

  if (coiCurrent) coiCurrent.hidden = false;
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
      
      // Update prequal UI if on prequal page
      const prequalData = await loadPrequalStatus(user.uid);
      updatePrequalUI(prequalData);
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
      
      // Update prequal UI if on prequal page
      const prequalData = await loadPrequalStatus(user.uid);
      updatePrequalUI(prequalData);
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Save failed. Please try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

/* ========= Business License Upload ========= */
async function renderBusinessLicenseCurrent(user) {
  const snap = await getDoc(getPrequalDocRef(user.uid));
  const data = snap.exists() ? (snap.data() || {}) : {};
  const businessLicense = data.businessLicense || null;
  const currentDiv = document.getElementById("businessLicenseCurrent");
  const fileNameEl = document.getElementById("businessLicenseFileName");
  const uploadedEl = document.getElementById("businessLicenseUploaded");
  const downloadLink = document.getElementById("businessLicenseDownloadLink");

  if (!businessLicense) {
    if (currentDiv) currentDiv.hidden = true;
    return;
  }

  if (currentDiv) currentDiv.hidden = false;
  if (fileNameEl) fileNameEl.textContent = businessLicense.fileName || "—";
  if (uploadedEl) uploadedEl.textContent = businessLicense.uploadedAtMs ? new Date(businessLicense.uploadedAtMs).toLocaleString() : "—";

  const viewLink = document.getElementById("businessLicenseViewLink");
  
  if (downloadLink && businessLicense.filePath) {
    try {
      const url = await getDownloadURL(ref(storage, businessLicense.filePath));
      downloadLink.href = url;
      downloadLink.hidden = false;
      if (viewLink) {
        viewLink.href = url;
        viewLink.hidden = false;
      }
    } catch {
      downloadLink.hidden = true;
      if (viewLink) viewLink.hidden = true;
    }
  } else {
    if (viewLink) viewLink.hidden = true;
  }
}

function initBusinessLicenseUpload(user) {
  const form = document.getElementById("businessLicenseForm");
  if (!form) return;

  renderBusinessLicenseCurrent(user);

  const fileInput = document.getElementById("businessLicenseFile");
  const msg = document.getElementById("businessLicenseMsg");
  const err = document.getElementById("businessLicenseErr");
  const btn = document.getElementById("businessLicenseUploadBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const file = fileInput?.files?.[0];
    if (!file) { if (err) err.textContent = "Please choose a file."; return; }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `users/${user.uid}/businessLicense/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Uploading…";

      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });

      await setDoc(getPrequalDocRef(user.uid), {
        businessLicense: {
          fileName: file.name,
          filePath: path,
          uploadedAtMs: Date.now()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (msg) msg.textContent = "Saved. Your business license is now on file.";
      form.reset();
      await renderBusinessLicenseCurrent(user);
      
      // Update prequal UI
      const data = await loadPrequalStatus(user.uid);
      updatePrequalUI(data);
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Upload failed. Please try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

/* ========= Workers Comp Exemption Upload ========= */
async function renderWorkersCompCurrent(user) {
  const snap = await getDoc(getPrequalDocRef(user.uid));
  const data = snap.exists() ? (snap.data() || {}) : {};
  const workersComp = data.workersComp || null;
  const currentDiv = document.getElementById("workersCompCurrent");
  const fileNameEl = document.getElementById("workersCompFileName");
  const uploadedEl = document.getElementById("workersCompUploaded");
  const downloadLink = document.getElementById("workersCompDownloadLink");

  if (!workersComp) {
    if (currentDiv) currentDiv.hidden = true;
    return;
  }

  if (currentDiv) currentDiv.hidden = false;
  if (fileNameEl) fileNameEl.textContent = workersComp.fileName || "—";
  if (uploadedEl) uploadedEl.textContent = workersComp.uploadedAtMs ? new Date(workersComp.uploadedAtMs).toLocaleString() : "—";

  const viewLink = document.getElementById("workersCompViewLink");
  
  if (downloadLink && workersComp.filePath) {
    try {
      const url = await getDownloadURL(ref(storage, workersComp.filePath));
      downloadLink.href = url;
      downloadLink.hidden = false;
      if (viewLink) {
        viewLink.href = url;
        viewLink.hidden = false;
      }
    } catch {
      downloadLink.hidden = true;
      if (viewLink) viewLink.hidden = true;
    }
  } else {
    if (viewLink) viewLink.hidden = true;
  }
}

function initWorkersCompUpload(user) {
  const form = document.getElementById("workersCompForm");
  if (!form) return;

  renderWorkersCompCurrent(user);

  const fileInput = document.getElementById("workersCompFile");
  const msg = document.getElementById("workersCompMsg");
  const err = document.getElementById("workersCompErr");
  const btn = document.getElementById("workersCompUploadBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const file = fileInput?.files?.[0];
    if (!file) { if (err) err.textContent = "Please choose a file."; return; }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `users/${user.uid}/workersComp/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "Uploading…";

      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });

      await setDoc(getPrequalDocRef(user.uid), {
        workersComp: {
          fileName: file.name,
          filePath: path,
          uploadedAtMs: Date.now()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (msg) msg.textContent = "Saved. Your workers compensation exemption is now on file.";
      form.reset();
      await renderWorkersCompCurrent(user);
      
      // Update prequal UI
      const data = await loadPrequalStatus(user.uid);
      updatePrequalUI(data);
    } catch (e2) {
      console.error(e2);
      if (err) err.textContent = "Upload failed. Please try again.";
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

  // Initialize submenu toggles
  const submenuToggles = document.querySelectorAll(".sidebar-submenu-toggle");
  submenuToggles.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const submenu = btn.closest(".sidebar-submenu");
      if (submenu) {
        submenu.classList.toggle("open");
      }
    });
  });

  // Mark active link
  const path = window.location.pathname.split("/").pop() || "index.html";
  sideNav.querySelectorAll("a").forEach(a => {
    const href = (a.getAttribute("href") || "").split("/").pop();
    if (href === path) {
      a.classList.add("active");
      // If it's a submenu link, open the parent submenu
      const submenu = a.closest(".sidebar-submenu");
      if (submenu) {
        submenu.classList.add("open");
      }
    }
  });
}


function initYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}

/* ========== Header Avatar ========== */
async function updateHeaderAvatar(user) {
  const avatarEl = document.getElementById("headerAvatar");
  const avatarImage = document.getElementById("headerAvatarImage");
  const avatarInitials = document.getElementById("headerAvatarInitials");
  
  if (!avatarEl || !avatarImage || !avatarInitials) return;
  
  try {
    // Try to load profile from Firestore
    const profileRef = doc(db, "users", user.uid, "private", "profile");
    const profileSnap = await getDoc(profileRef);
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    
    // Get logo URL from profile or auth user photoURL
    const logoUrl = profile?.logoUrl || user.photoURL;
    
    if (logoUrl) {
      avatarImage.src = logoUrl;
      avatarImage.style.display = "block";
      avatarInitials.style.display = "none";
    } else {
      avatarImage.style.display = "none";
      avatarInitials.style.display = "flex";
      
      // Generate initials
      let initials = "";
      if (user.displayName) {
        const parts = user.displayName.trim().split(/\s+/);
        if (parts.length >= 2) {
          initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts[0]) {
          initials = parts[0].substring(0, 2).toUpperCase();
        }
      }
      
      if (!initials && user.email) {
        initials = user.email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "");
      }
      
      if (!initials) {
        initials = "??";
      }
      
      avatarInitials.textContent = initials;
    }
    
    // Calculate relative path to account page
    const pathSegments = window.location.pathname.split("/").filter(p => p && !p.endsWith(".html"));
    const depth = pathSegments.length;
    const accountPath = depth > 0 ? "../".repeat(depth) + "account/account.html" : "account/account.html";
    avatarEl.href = accountPath;
    
  } catch (err) {
    console.error("Error loading avatar:", err);
    // Fallback to initials from email
    if (user.email) {
      avatarInitials.textContent = user.email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "") || "??";
      avatarInitials.style.display = "flex";
      avatarImage.style.display = "none";
    }
  }
}

// Make function available globally for account.js to call
if (typeof window !== 'undefined') {
  window.updateHeaderAvatar = updateHeaderAvatar;
}

document.addEventListener("DOMContentLoaded", async () => {
  initSidebarNav();
  initYear();

  const ok = await initFirebase();
  if (!ok) return;

  onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.hidden = !user;
    
    const headerAvatar = document.getElementById("headerAvatar");
    if (headerAvatar) headerAvatar.hidden = !user;
    
    // Initialize language based on auth state
    await initLanguageForUser(user);
    
    if (user) {
      await updateHeaderAvatar(user);
    }

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
