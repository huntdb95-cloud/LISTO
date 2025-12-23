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
    "nav.contracts": "Contracts",
    "nav.payroll": "Payroll",
    "nav.employees": "Employees",
    "nav.bookkeeping": "Bookkeeping",
    "nav.tools": "Tools",
    "nav.audit": "Audit Help",
    "nav.contractScanner": "Contract Scanner",
    "nav.invoiceBuilder": "Invoice Builder",
    "nav.jobEstimator": "Job Cost Estimator",
    "nav.1099": "1099-NEC Generator",
    "nav.account": "My Account",
    "nav.support": "Support",
    "nav.settings": "Settings",
    "tools.pageTitle": "Tools",
    "tools.pageSubtitle": "Access all available tools to help manage your business.",
    "settings.title": "Settings",
    "settings.subtitle": "Manage your account settings and get support.",

    "hero.title": "Focus on your work. We'll handle the paperwork.",
    "hero.subtitle": "Stop wasting time on business tasks. Listo automates payroll tracking, document management, invoicing, and compliance—so you can get back to what you do best.",
    "hero.ctaPrimary": "Log In",
    "hero.ctaSecondary": "Get Started with Listo",
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
    "tools.t7Desc": "Create detailed job cost estimates with labor, materials, subcontractors, and markups. Link estimates to your saved jobs.",
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
    "signup.acceptTerms": "I agree to the",
    "signup.termsLink": "Terms and Conditions",
    "signup.and": " and ",
    "signup.privacyLink": "Privacy Policy",
    "auth.noAccount": "No account?",
    "auth.goSignup": "Create one",
    "auth.haveAccount": "Already have an account?",
    "auth.goLogin": "Log in",
    "auth.forgotTitle": "Reset password",
    "auth.forgotSubtitle": "Enter your email and we'll send you a reset link.",
    "auth.sendReset": "Send reset link",
    "auth.backToLogin": "Back to login",
    "auth.backToHome": "Back to Home",
    "auth.forgotPassword": "Forgot password",
    "auth.displayName": "Company / Display name",
    "auth.displayNamePlaceholder": "ABC Construction",
    "auth.emailPlaceholder": "you@company.com",
    "auth.passwordPlaceholder": "At least 6 characters",
    "auth.passwordPlaceholderLogin": "••••••••",
    "auth.confirmPassword": "Confirm Password",
    "auth.confirmPasswordPlaceholder": "Re-enter your password",
    "auth.createAccountLink": "Create account",
    "auth.sideTitle": "Private. Secure. Built for onboarding.",
    "auth.sideBody": "Your documents and uploads are protected behind your login.",
    "auth.logout": "Log out",
    "logout.confirmTitle": "Are you sure you want to log out?",
    "logout.confirmMessage": "You will need to log in again to access your account.",
    "logout.cancel": "Cancel",
    "logout.confirm": "Log Out",

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
    "support.termsTitle": "Terms and Conditions",
    "support.termsDesc": "Review our Terms and Conditions to understand the terms of service for using Listo.",
    "support.viewTerms": "View Terms and Conditions",
    "support.viewPrivacy": "View Privacy Policy",
    "support.faqTitle": "Frequently Asked Questions",

    "terms.title": "Terms and Conditions",
    "terms.lastUpdated": "Last updated:",
    "terms.section1Title": "1. Acceptance of Terms",
    "terms.section1Content": "By accessing and using Listo (\"the Service\"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.",
    "terms.section2Title": "2. Use License",
    "terms.section2Content": "Permission is granted to temporarily use Listo for personal or business purposes. This is the grant of a license, not a transfer of title, and under this license you may not:",
    "terms.section2Item1": "Modify or copy the materials",
    "terms.section2Item2": "Use the materials for any commercial purpose or for any public display",
    "terms.section2Item3": "Attempt to reverse engineer any software contained in the Service",
    "terms.section2Item4": "Remove any copyright or other proprietary notations from the materials",
    "terms.section3Title": "3. User Account",
    "terms.section3Content": "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account or password.",
    "terms.section4Title": "4. Data and Privacy",
    "terms.section4Content": "You retain ownership of all data you upload to Listo. We will not share your data with third parties except as necessary to provide the Service or as required by law. Please review our Privacy Policy for more information.",
    "terms.section5Title": "5. Service Availability",
    "terms.section5Content": "We strive to provide continuous access to the Service, but we do not guarantee uninterrupted access. The Service may be unavailable due to maintenance, updates, or circumstances beyond our control.",
    "terms.section6Title": "6. Limitation of Liability",
    "terms.section6Content": "In no event shall Listo or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the Service.",
    "terms.section7Title": "7. Modifications",
    "terms.section7Content": "Listo may revise these terms of service at any time without notice. By using this Service you are agreeing to be bound by the then current version of these terms of service.",
    "terms.section8Title": "8. Contact Information",
    "terms.section8Content": "If you have any questions about these Terms and Conditions, please contact us at support@listo.com.",
    "terms.backHome": "Back to Home",

    "privacy.title": "Privacy Policy",
    "privacy.lastUpdated": "Last updated:",
    "privacy.backHome": "Back to Home",
    "privacy.section1Title": "1. Information We Collect",
    "privacy.section1Content": "We collect information that you provide directly to us when you create an account, use our services, or contact us. This includes:",
    "privacy.section1Item1": "Account information (name, email address, password)",
    "privacy.section1Item2": "Business information and documents you upload (W-9 forms, COI, contracts, invoices, payroll records)",
    "privacy.section1Item3": "Usage information (how you interact with our services)",
    "privacy.section1Item4": "Device and log information (IP address, browser type, access times)",
    "privacy.section2Title": "2. How We Use Your Information",
    "privacy.section2Content": "We use the information we collect to:",
    "privacy.section2Item1": "Provide, maintain, and improve our services",
    "privacy.section2Item2": "Process transactions and send related information",
    "privacy.section2Item3": "Send technical notices, updates, and support messages",
    "privacy.section2Item4": "Respond to your comments, questions, and requests",
    "privacy.section2Item5": "Monitor and analyze trends, usage, and activities",
    "privacy.section3Title": "3. Information Sharing and Disclosure",
    "privacy.section3Content": "We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:",
    "privacy.section3Item1": "With service providers who assist us in operating our platform (e.g., Firebase for authentication and data storage, SendGrid for email delivery)",
    "privacy.section3Item2": "When required by law or to protect our rights and safety",
    "privacy.section3Item3": "In connection with a business transfer (merger, acquisition, etc.)",
    "privacy.section3Item4": "With your explicit consent",
    "privacy.section4Title": "4. Data Security",
    "privacy.section4Content": "We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:",
    "privacy.section4Item1": "Encryption of data in transit and at rest",
    "privacy.section4Item2": "Secure authentication and access controls",
    "privacy.section4Item3": "Regular security assessments and updates",
    "privacy.section4Item4": "Limited access to personal information on a need-to-know basis",
    "privacy.section5Title": "5. Your Rights and Choices",
    "privacy.section5Content": "You have the right to:",
    "privacy.section5Item1": "Access and update your personal information through your account settings",
    "privacy.section5Item2": "Delete your account and associated data at any time",
    "privacy.section5Item3": "Opt out of certain communications (though we may still send important service-related messages)",
    "privacy.section5Item4": "Request a copy of your data",
    "privacy.section6Title": "6. Data Retention",
    "privacy.section6Content": "We retain your personal information for as long as your account is active or as needed to provide you services. If you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or regulatory purposes.",
    "privacy.section7Title": "7. Children's Privacy",
    "privacy.section7Content": "Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.",
    "privacy.section8Title": "8. Changes to This Privacy Policy",
    "privacy.section8Content": "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the \"Last updated\" date. You are advised to review this Privacy Policy periodically for any changes.",
    "privacy.section9Title": "9. Contact Us",
    "privacy.section9Content": "If you have any questions about this Privacy Policy, please contact us at support@listo.com.",

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

    "employees.title": "Labor Management",
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
    
    "1099.title": "1099-NEC Generator",
    "1099.subtitle": "Generate IRS Form 1099-NEC for your laborers and subcontractors based on payment history.",
    "1099.taxYear": "Tax Year",
    "1099.selectTaxYear": "Select tax year",
    "1099.payerInfo": "Payer Information",
    "1099.payerInfoDesc": "Your business information will appear on the 1099-NEC form as the payer. This information is stored securely and can be updated anytime.",
    "1099.businessName": "Business Name",
    "1099.tin": "Taxpayer Identification Number (EIN/SSN)",
    "1099.tinFormat": "Format: XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)",
    "1099.streetAddress": "Street Address",
    "1099.city": "City",
    "1099.state": "State",
    "1099.zip": "ZIP Code",
    "1099.phone": "Phone (Optional)",
    "1099.savePayerInfo": "Save Payer Information",
    "1099.selectLaborer": "Select Laborer",
    "1099.searchLaborers": "Search laborers by name...",
    "1099.payeeInfo": "Payee Information (from W-9)",
    "1099.w9Missing": "W-9 Information Missing:",
    "1099.w9MissingDesc": "This laborer does not have complete W-9 information. Please update the W-9 information in Labor Management before generating the 1099-NEC.",
    "1099.paymentSummary": "Payment Summary for",
    "1099.totalCompensation": "Total Nonemployee Compensation (Box 1)",
    "1099.paymentBreakdown": "Payment Breakdown",
    "1099.noPayments": "No payments found for this laborer in the selected tax year.",
    "1099.generate": "Generate 1099-NEC PDF",
    "1099.changeLaborer": "Change Laborer",
    "1099.history": "Generated Forms History",
    "1099.noForms": "No forms generated yet for this tax year.",
    "1099.download": "Download PDF",
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
    "bookkeeping.memo": "Memo",
    "bookkeeping.actions": "Actions",
    "bookkeeping.editLaborer": "Edit Laborer",
    "bookkeeping.laborManagement": "Labor Management",

    "contracts.title": "Contracts",
    "contracts.subtitle": "Manage your pre-qualification documents and active builder contracts.",
    "contracts.tabPrequal": "Pre-Qualification",
    "contracts.tabBuilders": "Builder Contracts",
    "contracts.addContract": "Add Builder Contract",
    "contracts.builderName": "Builder Name",
    "contracts.builderCoi": "Builder-Specific COI",
    "contracts.subAgreement": "Signed Subcontractor Agreement",
    "contracts.subAgreementType": "Subcontractor Agreement",
    "contracts.signStandard": "Sign Standard Agreement",
    "contracts.uploadSigned": "Upload Signed Agreement",
    "contracts.signStandardDesc": "You will be redirected to sign the standard subcontractor agreement.",
    "contracts.goToSign": "Go to Sign Agreement",
    "contracts.uploadSignedAgreement": "Upload Signed Agreement",
    "contracts.fileHint": "PDF, PNG, or JPG (max 10MB)",
    "contracts.saveContract": "Save Contract",
    "contracts.cancel": "Cancel",
    "contracts.edit": "Edit",
    "contracts.delete": "Delete",
    "contracts.activate": "Activate",
    "contracts.deactivate": "Deactivate",
    "contracts.activeContracts": "Active Contracts",
    "contracts.inactiveContracts": "Inactive Contracts",
    "contracts.noActiveContracts": "No active contracts. Click \"Add Builder Contract\" to get started.",
    "contracts.noInactiveContracts": "No inactive contracts.",
    "contracts.loading": "Loading...",
    "contracts.jobs": "Jobs",
    "contracts.showJobs": "Show Jobs",
    "contracts.hideJobs": "Hide Jobs",
    "contracts.addJob": "Add Job",
    "contracts.noJobs": "No jobs added yet.",
    "contracts.jobName": "Job Name",
    "contracts.jobAddress": "Address",
    "contracts.jobDescription": "Description of Work",
    "contracts.projectCoi": "Project COI",
    "contracts.saveJob": "Save Job",
    "contracts.paid": "Paid",
    "contracts.unpaid": "Unpaid",
    
    "invoice.selectBuilder": "Select Builder (Optional)",

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
    "nav.contracts": "Contratos",
    "nav.payroll": "Nómina",
    "nav.employees": "Empleados",
    "nav.bookkeeping": "Contabilidad",
    "nav.tools": "Herramientas",
    "nav.audit": "Ayuda de Auditoría",
    "nav.account": "Mi Cuenta",
    "nav.contractScanner": "Escáner de Contratos",
    "nav.invoiceBuilder": "Generador de Facturas",
    "nav.jobEstimator": "Estimador de Costos de Trabajo",
    "nav.support": "Soporte",
    "nav.settings": "Configuración",
    "tools.pageTitle": "Herramientas",
    "tools.pageSubtitle": "Accede a todas las herramientas disponibles para ayudar a administrar tu negocio.",
    "settings.title": "Configuración",
    "settings.subtitle": "Administra la configuración de tu cuenta y obtén soporte.",

    "hero.title": "Precalifícate. Cobra. Sé elegido.",
    "hero.subtitle": "Listo ayuda a subcontratistas a completar requisitos de incorporación, estar listos para auditorías y crear un perfil confiable para contratistas generales.",
    "hero.ctaPrimary": "Iniciar Sesión",
    "hero.ctaSecondary": "Comenzar con Listo",
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
    "tools.t7Desc": "Crea estimaciones detalladas de costos de trabajo con mano de obra, materiales, subcontratistas y márgenes. Vincula estimaciones a tus trabajos guardados.",
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
    "signup.acceptTerms": "Acepto los",
    "signup.termsLink": "Términos y Condiciones",
    "signup.and": " y la ",
    "signup.privacyLink": "Política de Privacidad",
    "auth.goSignup": "Crear una",
    "auth.haveAccount": "¿Ya tienes cuenta?",
    "auth.goLogin": "Inicia sesión",
    "auth.forgotTitle": "Restablecer contraseña",
    "auth.forgotSubtitle": "Ingresa tu correo y te enviaremos un enlace para restablecer.",
    "auth.sendReset": "Enviar enlace de restablecimiento",
    "auth.backToLogin": "Volver al inicio de sesión",
    "auth.backToHome": "Volver al inicio",
    "auth.forgotPassword": "¿Olvidaste tu contraseña?",
    "auth.displayName": "Empresa / Nombre para mostrar",
    "auth.displayNamePlaceholder": "ABC Construction",
    "auth.emailPlaceholder": "tu@empresa.com",
    "auth.passwordPlaceholder": "Al menos 6 caracteres",
    "auth.passwordPlaceholderLogin": "••••••••",
    "auth.confirmPassword": "Confirmar Contraseña",
    "auth.confirmPasswordPlaceholder": "Vuelve a ingresar tu contraseña",
    "auth.createAccountLink": "Crear cuenta",
    "auth.sideTitle": "Privado. Seguro. Hecho para incorporación.",
    "auth.sideBody": "Tus documentos y cargas están protegidos con tu inicio de sesión.",
    "auth.logout": "Cerrar sesión",
    "logout.confirmTitle": "¿Estás seguro de que quieres cerrar sesión?",
    "logout.confirmMessage": "Necesitarás iniciar sesión nuevamente para acceder a tu cuenta.",
    "logout.cancel": "Cancelar",
    "logout.confirm": "Cerrar sesión",

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

    "employees.title": "Gestión de Trabajadores",
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
    "bookkeeping.memo": "Nota",
    "bookkeeping.actions": "Acciones",
    "bookkeeping.editLaborer": "Editar Trabajador",
    "bookkeeping.laborManagement": "Gestión de Trabajadores",

    "contracts.title": "Contratos",
    "contracts.subtitle": "Administra tus documentos de precalificación y contratos activos con constructores.",
    "contracts.tabPrequal": "Precalificación",
    "contracts.tabBuilders": "Contratos con Constructores",
    "contracts.addContract": "Agregar Contrato con Constructor",
    "contracts.builderName": "Nombre del Constructor",
    "contracts.builderCoi": "COI Específico del Constructor",
    "contracts.subAgreement": "Acuerdo de Subcontratista Firmado",
    "contracts.subAgreementType": "Acuerdo de Subcontratista",
    "contracts.signStandard": "Firmar Acuerdo Estándar",
    "contracts.uploadSigned": "Subir Acuerdo Firmado",
    "contracts.signStandardDesc": "Serás redirigido para firmar el acuerdo estándar de subcontratista.",
    "contracts.goToSign": "Ir a Firmar Acuerdo",
    "contracts.uploadSignedAgreement": "Subir Acuerdo Firmado",
    "contracts.fileHint": "PDF, PNG o JPG (máx 10MB)",
    "contracts.saveContract": "Guardar Contrato",
    "contracts.cancel": "Cancelar",
    "contracts.edit": "Editar",
    "contracts.delete": "Eliminar",
    "contracts.activate": "Activar",
    "contracts.deactivate": "Desactivar",
    "contracts.activeContracts": "Contratos Activos",
    "contracts.inactiveContracts": "Contratos Inactivos",
    "contracts.noActiveContracts": "No hay contratos activos. Haz clic en \"Agregar Contrato con Constructor\" para comenzar.",
    "contracts.noInactiveContracts": "No hay contratos inactivos.",
    "contracts.loading": "Cargando...",
    "contracts.jobs": "Trabajos",
    "contracts.showJobs": "Mostrar Trabajos",
    "contracts.hideJobs": "Ocultar Trabajos",
    "contracts.addJob": "Agregar Trabajo",
    "contracts.noJobs": "Aún no se han agregado trabajos.",
    "contracts.jobName": "Nombre del Trabajo",
    "contracts.jobAddress": "Dirección",
    "contracts.jobDescription": "Descripción del Trabajo",
    "contracts.projectCoi": "COI del Proyecto",
    "contracts.saveJob": "Guardar Trabajo",
    "contracts.paid": "Pagado",
    "contracts.unpaid": "No Pagado",
    
    "invoice.selectBuilder": "Seleccionar Constructor (Opcional)",

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
    "support.termsTitle": "Términos y Condiciones",
    "support.termsDesc": "Revisa nuestros Términos y Condiciones para entender los términos de servicio para usar Listo.",
    "support.viewTerms": "Ver Términos y Condiciones",
    "support.viewPrivacy": "Ver Política de Privacidad",

    "terms.title": "Términos y Condiciones",
    "terms.lastUpdated": "Última actualización:",
    "terms.section1Title": "1. Aceptación de Términos",
    "terms.section1Content": "Al acceder y usar Listo (\"el Servicio\"), acepta y se compromete a cumplir con los términos y disposiciones de este acuerdo. Si no está de acuerdo con lo anterior, no use este servicio.",
    "terms.section2Title": "2. Licencia de Uso",
    "terms.section2Content": "Se otorga permiso para usar Listo temporalmente para fines personales o comerciales. Esta es la concesión de una licencia, no una transferencia de título, y bajo esta licencia no puede:",
    "terms.section2Item1": "Modificar o copiar los materiales",
    "terms.section2Item2": "Usar los materiales para cualquier propósito comercial o para cualquier exhibición pública",
    "terms.section2Item3": "Intentar hacer ingeniería inversa de cualquier software contenido en el Servicio",
    "terms.section2Item4": "Eliminar cualquier notación de derechos de autor u otra propiedad de los materiales",
    "terms.section3Title": "3. Cuenta de Usuario",
    "terms.section3Content": "Usted es responsable de mantener la confidencialidad de su cuenta y contraseña. Acepta aceptar la responsabilidad de todas las actividades que ocurran bajo su cuenta o contraseña.",
    "terms.section4Title": "4. Datos y Privacidad",
    "terms.section4Content": "Usted conserva la propiedad de todos los datos que carga en Listo. No compartiremos sus datos con terceros excepto según sea necesario para proporcionar el Servicio o según lo requiera la ley. Por favor revise nuestra Política de Privacidad para más información.",
    "terms.section5Title": "5. Disponibilidad del Servicio",
    "terms.section5Content": "Nos esforzamos por proporcionar acceso continuo al Servicio, pero no garantizamos acceso ininterrumpido. El Servicio puede no estar disponible debido a mantenimiento, actualizaciones o circunstancias fuera de nuestro control.",
    "terms.section6Title": "6. Limitación de Responsabilidad",
    "terms.section6Content": "En ningún caso Listo o sus proveedores serán responsables de ningún daño (incluyendo, sin limitación, daños por pérdida de datos o ganancias, o debido a interrupción del negocio) que surja del uso o la incapacidad de usar el Servicio.",
    "terms.section7Title": "7. Modificaciones",
    "terms.section7Content": "Listo puede revisar estos términos de servicio en cualquier momento sin previo aviso. Al usar este Servicio, acepta estar sujeto a la versión actual de estos términos de servicio.",
    "terms.section8Title": "8. Información de Contacto",
    "terms.section8Content": "Si tiene alguna pregunta sobre estos Términos y Condiciones, contáctenos en support@listo.com.",
    "terms.backHome": "Volver al Inicio",

    "privacy.title": "Política de Privacidad",
    "privacy.lastUpdated": "Última actualización:",
    "privacy.backHome": "Volver al Inicio",
    "privacy.section1Title": "1. Información que Recopilamos",
    "privacy.section1Content": "Recopilamos información que usted nos proporciona directamente cuando crea una cuenta, usa nuestros servicios o nos contacta. Esto incluye:",
    "privacy.section1Item1": "Información de la cuenta (nombre, dirección de correo electrónico, contraseña)",
    "privacy.section1Item2": "Información comercial y documentos que sube (formularios W-9, COI, contratos, facturas, registros de nómina)",
    "privacy.section1Item3": "Información de uso (cómo interactúa con nuestros servicios)",
    "privacy.section1Item4": "Información del dispositivo y registros (dirección IP, tipo de navegador, horas de acceso)",
    "privacy.section2Title": "2. Cómo Usamos Su Información",
    "privacy.section2Content": "Usamos la información que recopilamos para:",
    "privacy.section2Item1": "Proporcionar, mantener y mejorar nuestros servicios",
    "privacy.section2Item2": "Procesar transacciones y enviar información relacionada",
    "privacy.section2Item3": "Enviar avisos técnicos, actualizaciones y mensajes de soporte",
    "privacy.section2Item4": "Responder a sus comentarios, preguntas y solicitudes",
    "privacy.section2Item5": "Monitorear y analizar tendencias, uso y actividades",
    "privacy.section3Title": "3. Compartir y Divulgar Información",
    "privacy.section3Content": "No vendemos, intercambiamos ni alquilamos su información personal a terceros. Podemos compartir su información solo en las siguientes circunstancias:",
    "privacy.section3Item1": "Con proveedores de servicios que nos ayudan a operar nuestra plataforma (por ejemplo, Firebase para autenticación y almacenamiento de datos, SendGrid para entrega de correo electrónico)",
    "privacy.section3Item2": "Cuando sea requerido por ley o para proteger nuestros derechos y seguridad",
    "privacy.section3Item3": "En relación con una transferencia comercial (fusión, adquisición, etc.)",
    "privacy.section3Item4": "Con su consentimiento explícito",
    "privacy.section4Title": "4. Seguridad de Datos",
    "privacy.section4Content": "Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información personal contra acceso no autorizado, alteración, divulgación o destrucción. Esto incluye:",
    "privacy.section4Item1": "Cifrado de datos en tránsito y en reposo",
    "privacy.section4Item2": "Autenticación segura y controles de acceso",
    "privacy.section4Item3": "Evaluaciones y actualizaciones de seguridad regulares",
    "privacy.section4Item4": "Acceso limitado a información personal según necesidad",
    "privacy.section5Title": "5. Sus Derechos y Opciones",
    "privacy.section5Content": "Usted tiene derecho a:",
    "privacy.section5Item1": "Acceder y actualizar su información personal a través de la configuración de su cuenta",
    "privacy.section5Item2": "Eliminar su cuenta y datos asociados en cualquier momento",
    "privacy.section5Item3": "Optar por no recibir ciertas comunicaciones (aunque aún podemos enviar mensajes importantes relacionados con el servicio)",
    "privacy.section5Item4": "Solicitar una copia de sus datos",
    "privacy.section6Title": "6. Retención de Datos",
    "privacy.section6Content": "Retenemos su información personal mientras su cuenta esté activa o según sea necesario para brindarle servicios. Si elimina su cuenta, eliminaremos o anonimizaremos su información personal, excepto cuando se nos requiera retenerla para fines legales o regulatorios.",
    "privacy.section7Title": "7. Privacidad de Menores",
    "privacy.section7Content": "Nuestros servicios no están destinados a personas menores de 18 años. No recopilamos conscientemente información personal de niños. Si cree que hemos recopilado información de un niño, contáctenos inmediatamente.",
    "privacy.section8Title": "8. Cambios a Esta Política de Privacidad",
    "privacy.section8Content": "Podemos actualizar esta Política de Privacidad de vez en cuando. Le notificaremos de cualquier cambio publicando la nueva Política de Privacidad en esta página y actualizando la fecha de \"Última actualización\". Se le recomienda revisar esta Política de Privacidad periódicamente para cualquier cambio.",
    "privacy.section9Title": "9. Contáctenos",
    "privacy.section9Content": "Si tiene alguna pregunta sobre esta Política de Privacidad, contáctenos en support@listo.com.",

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
  // Handle placeholder translations
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) {
      el.placeholder = dict[key];
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
  
  // Set up language toggle buttons
  document.querySelectorAll("[data-lang]").forEach(btn => {
    // Remove any existing listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selectedLang = newBtn.getAttribute("data-lang");
      localStorage.setItem(LANG_KEY, selectedLang);
      applyTranslations(selectedLang);
    });
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
    // Remove any existing listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selectedLang = newBtn.getAttribute("data-lang");
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
    // Prevent redirect loops: don't redirect if already on login/signup/forgot pages
    if (page === "login" || page === "signup" || page === "forgot" || 
        window.location.pathname.includes("/login/") || 
        window.location.pathname.includes("/signup/") || 
        window.location.pathname.includes("/forgot/")) {
      return; // Already on auth page, don't redirect
    }
    
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
let loginFormHandlerAttached = false;
let signupFormHandlerAttached = false;

function initAuthUI() {
  // Logout handler is now set up in onAuthStateChanged to ensure auth is initialized
  // Form handlers are also set up here with deduplication to prevent multiple listeners

  const loginForm = document.getElementById("loginForm");
  if (loginForm && auth && !loginFormHandlerAttached) {
    loginFormHandlerAttached = true;
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
  if (signupForm && auth && !signupFormHandlerAttached) {
    signupFormHandlerAttached = true;
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

// Make prequal functions available globally for contracts.js and account.js
if (typeof window !== 'undefined') {
  window.loadPrequalStatus = loadPrequalStatus;
  window.updatePrequalUI = updatePrequalUI;
  window.initBusinessLicenseUpload = initBusinessLicenseUpload;
  window.initWorkersCompUpload = initWorkersCompUpload;
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
    builderName: (document.getElementById("agreementBuilderName")?.value || "").trim(),
    subcontractorName: (document.getElementById("agreementSubName")?.value || "").trim(),
    title: (document.getElementById("agreementTitle")?.value || "").trim(),
    signature: (document.getElementById("agreementSignature")?.value || "").trim(), // Base64 signature image
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

// Initialize signature canvas
function initSignatureCanvas() {
  const canvas = document.getElementById("signatureCanvas");
  const clearBtn = document.getElementById("clearSignatureBtn");
  const hiddenInput = document.getElementById("agreementSignature");
  if (!canvas || !hiddenInput) return;

  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#000000"; // Black ink
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Set canvas size based on container width (responsive)
  function resizeCanvas() {
    const container = canvas.parentElement;
    if (container) {
      const containerWidth = container.clientWidth - 24; // Account for padding
      const aspectRatio = 600 / 200; // Original aspect ratio
      const newWidth = Math.min(600, containerWidth);
      const newHeight = newWidth / aspectRatio;
      
      // Save current signature if exists
      const currentSignature = hiddenInput.value;
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Restore drawing context settings after resize
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Redraw if there's existing signature data
      if (currentSignature) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = currentSignature;
      }
    }
  }

  // Initial resize
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Get coordinates relative to canvas
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    const coords = getCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    lastX = coords.x;
    lastY = coords.y;
    updateSignatureData();
  }

  function stopDrawing(e) {
    e.preventDefault();
    if (isDrawing) {
      isDrawing = false;
      updateSignatureData();
    }
  }

  function updateSignatureData() {
    hiddenInput.value = canvas.toDataURL("image/png");
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hiddenInput.value = "";
  }

  // Mouse events
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);

  // Touch events
  canvas.addEventListener("touchstart", startDrawing);
  canvas.addEventListener("touchmove", draw);
  canvas.addEventListener("touchend", stopDrawing);
  canvas.addEventListener("touchcancel", stopDrawing);

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearCanvas();
    });
  }

  // Load existing signature if available
  return { clearCanvas, updateSignatureData };
}

async function initAgreementPage(user) {
  const form = document.getElementById("agreementForm");
  if (!form) return;

  const msg = document.getElementById("agreementMsg");
  const err = document.getElementById("agreementErr");
  const btn = document.getElementById("agreementSignBtn");
  const builderNameInput = document.getElementById("agreementBuilderName");
  const builderNameDisplay = document.getElementById("builderNameDisplay");

  // Initialize signature canvas
  const signatureCanvas = initSignatureCanvas();

  // Check for pending builder name from contracts page
  const pendingBuilderName = sessionStorage.getItem("pendingBuilderName");
  if (pendingBuilderName && builderNameInput) {
    builderNameInput.value = pendingBuilderName;
    if (builderNameDisplay) builderNameDisplay.textContent = pendingBuilderName;
    sessionStorage.removeItem("pendingBuilderName");
  }

  // Set default date to today
  const dateInput = document.getElementById("agreementDate");
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  // Update builder name display when input changes
  if (builderNameInput && builderNameDisplay) {
    builderNameInput.addEventListener("input", (e) => {
      const name = e.target.value.trim();
      builderNameDisplay.textContent = name || "[Builder Name]";
    });
  }

  // preload if previously signed
  const existing = await loadAgreement(user);
  if (existing) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    setVal("agreementBuilderName", existing.builderName);
    setVal("agreementSubName", existing.subcontractorName);
    setVal("agreementTitle", existing.title);
    setVal("agreementDate", existing.date);
    
    // Load signature image if it exists
    if (existing.signature && existing.signature.startsWith("data:image")) {
      const canvas = document.getElementById("signatureCanvas");
      const hiddenInput = document.getElementById("agreementSignature");
      if (canvas && hiddenInput) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          hiddenInput.value = existing.signature;
        };
        img.src = existing.signature;
      }
    }
    
    // Update builder name display
    if (builderNameDisplay && existing.builderName) {
      builderNameDisplay.textContent = existing.builderName;
    }
    
    const accept = document.getElementById("agreementAccept");
    if (accept) accept.checked = !!existing.accepted;
    if (msg && existing.signedAt?.toDate) msg.textContent = `Loaded prior signature: ${existing.signedAt.toDate().toLocaleString()}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    const data = collectAgreementData();
    if (!data.builderName) { if (err) err.textContent = "Builder name is required."; return; }
    if (!data.subcontractorName) { if (err) err.textContent = "Name of signer is required."; return; }
    if (!data.title) { if (err) err.textContent = "Title at company is required."; return; }
    if (!data.signature) { if (err) err.textContent = "Signature is required. Please sign the canvas."; return; }
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

/* ========== Sidebar (New Permanent Design - Desktop Only) ========= */
function initSidebarNav() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  
  // Align sidebar top with header bottom
  const updateSidebarPosition = () => {
    const header = document.querySelector(".site-header");
    if (header && sidebar) {
      const headerHeight = header.offsetHeight;
      document.documentElement.style.setProperty("--header-height", `${headerHeight}px`);
      sidebar.style.top = `${headerHeight}px`;
      sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
    }
  };
  
  // Update on init
  updateSidebarPosition();
  
  // Update on window resize (in case header height changes)
  if (typeof window !== 'undefined') {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateSidebarPosition, 100);
    });
  }

  // Initialize submenu toggles (new structure)
  const submenuItems = document.querySelectorAll(".submenu_item");
  submenuItems.forEach((item, index) => {
    if (item.dataset.listenerAttached === "true") return;
    
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.toggle("show_submenu");
      // Close other submenus
      submenuItems.forEach((item2, index2) => {
        if (index !== index2) {
          item2.classList.remove("show_submenu");
        }
      });
    });
    
    item.dataset.listenerAttached = "true";
  });

  // Handle old sidebar submenu toggles (for backward compatibility)
  const oldSubmenuToggles = sidebar.querySelectorAll(".sidebar-submenu-toggle");
  oldSubmenuToggles.forEach(btn => {
    if (btn.dataset.listenerAttached === "true") return;
    
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const submenu = btn.closest(".sidebar-submenu");
      if (submenu) {
        submenu.classList.toggle("open");
      }
    });
    
    btn.dataset.listenerAttached = "true";
  });

  // Mark active link - improved path matching for both old and new structures
  const currentPath = window.location.pathname;
  const currentUrl = window.location.href;
  
  // Get all links from both old and new structures
  const newLinks = sidebar.querySelectorAll("a.nav_link");
  const oldLinks = sidebar.querySelectorAll("a.sidebar-link");
  const allLinks = [...newLinks, ...oldLinks];
  
  // Remove all active classes first
  allLinks.forEach(a => a.classList.remove("active"));
  
  allLinks.forEach(a => {
    const href = a.getAttribute("href") || "";
    if (!href) return;
    
    // Resolve relative href to absolute for comparison
    let absoluteHref = href;
    try {
      absoluteHref = new URL(href, window.location.origin).pathname;
    } catch {
      // If href is relative, construct absolute path
      const basePath = currentPath.substring(0, currentPath.lastIndexOf("/") + 1);
      if (href.startsWith("../")) {
        const levels = (href.match(/\.\.\//g) || []).length;
        const pathParts = currentPath.split("/").filter(p => p);
        const resolvedPath = "/" + pathParts.slice(0, -levels).join("/") + "/" + href.replace(/\.\.\//g, "");
        absoluteHref = resolvedPath.replace(/\/+/g, "/");
      } else if (href.startsWith("./")) {
        absoluteHref = basePath + href.substring(2);
      } else if (!href.startsWith("/")) {
        absoluteHref = basePath + href;
      }
    }
    
    // Normalize paths
    const currentPathNormalized = currentPath.replace(/\/$/, "").toLowerCase();
    const hrefNormalized = absoluteHref.replace(/\/$/, "").toLowerCase();
    
    // Get filenames
    const currentFile = currentPath.split("/").pop() || "";
    const hrefFile = href.split("/").pop() || "";
    
    // Match conditions - improved matching logic
    let isMatch = false;
    
    // Exact path match
    if (currentPathNormalized === hrefNormalized) {
      isMatch = true;
    }
    // Filename match (most common case)
    else if (currentFile && hrefFile && currentFile.toLowerCase() === hrefFile.toLowerCase()) {
      isMatch = true;
    }
    // Path ends with href (for nested paths)
    else if (currentPathNormalized.endsWith(hrefNormalized) && hrefNormalized !== "") {
      isMatch = true;
    }
    // Dashboard special case
    else if ((currentPathNormalized === "" || currentPathNormalized.endsWith("/dashboard") || currentPathNormalized.endsWith("/dashboard.html")) && 
             (hrefFile === "dashboard.html" || hrefNormalized.includes("dashboard"))) {
      isMatch = true;
    }
    // Check if current URL contains the href (for relative paths)
    else if (currentUrl.includes(href.replace(/^\.\.\//g, "").replace(/^\.\//g, ""))) {
      isMatch = true;
    }
    
    if (isMatch) {
      a.classList.add("active");
      
      // Handle new structure submenu
      const submenuItem = a.closest("li.item");
      if (submenuItem) {
        const submenuParent = submenuItem.querySelector(".submenu_item");
        if (submenuParent) {
          submenuParent.classList.add("show_submenu");
        }
      }
      
      // Handle old structure submenu
      const oldSubmenu = a.closest(".sidebar-submenu");
      if (oldSubmenu) {
        oldSubmenu.classList.add("open");
      }
    }
  });

  // No mobile behavior needed - sidebar is completely hidden on mobile
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
  
  if (!avatarEl || !avatarImage || !avatarInitials) {
    console.warn("Avatar elements not found");
    return;
  }
  
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
      
      // Generate initials - prioritize profile name, then displayName, then email
      let initials = "";
      const nameToUse = profile?.name || user.displayName || "";
      
      if (nameToUse) {
        const parts = nameToUse.trim().split(/\s+/);
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
    // Fallback to initials from email or displayName
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
      initials = user.email.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "") || "??";
    }
    if (!initials) {
      initials = "??";
    }
    avatarInitials.textContent = initials;
    avatarInitials.style.display = "flex";
    avatarImage.style.display = "none";
  }
}

// Make function available globally for account.js to call
if (typeof window !== 'undefined') {
  window.updateHeaderAvatar = updateHeaderAvatar;
}

/* ========== Mobile Logout Button Initialization ========== */
function initMobileLogoutButton(user, authInstance) {
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.hidden = !user;
    
    // Set up mobile logout handler only once, but only if Firebase auth is initialized
    if (!mobileLogoutBtn.dataset.handlerAttached && authInstance) {
      mobileLogoutBtn.dataset.handlerAttached = "true";
      mobileLogoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLogoutConfirmation();
      });
    }
  }
}

/* ========== Logout Confirmation Modal ========== */
function showLogoutConfirmation() {
  // Create modal if it doesn't exist
  let modal = document.getElementById("logoutConfirmationModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "logoutConfirmationModal";
    modal.className = "logout-modal-overlay";
    modal.innerHTML = `
      <div class="logout-modal-content">
        <div class="logout-modal-header">
          <h3 data-i18n="logout.confirmTitle">Are you sure you want to log out?</h3>
        </div>
        <div class="logout-modal-body">
          <p data-i18n="logout.confirmMessage">You will need to log in again to access your account.</p>
        </div>
        <div class="logout-modal-footer">
          <button type="button" class="btn ghost" id="logoutCancelBtn" data-i18n="logout.cancel">Cancel</button>
          <button type="button" class="btn primary" id="logoutConfirmBtn" data-i18n="logout.confirm">Log Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Set up event listeners
    const cancelBtn = document.getElementById("logoutCancelBtn");
    const confirmBtn = document.getElementById("logoutConfirmBtn");
    
    cancelBtn.addEventListener("click", hideLogoutConfirmation);
    confirmBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        // Calculate relative path to login page from current location
        const pathSegments = window.location.pathname.split("/").filter(p => p && !p.endsWith(".html"));
        const depth = pathSegments.length;
        const loginPath = depth > 0 ? "../".repeat(depth) + "login/login.html" : (window.location.pathname.includes("/settings/") ? "../login/login.html" : "login/login.html");
        window.location.href = loginPath;
      } catch (e) {
        console.error("Logout error:", e);
        hideLogoutConfirmation();
      }
    });
    
    // Close on overlay click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideLogoutConfirmation();
      }
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === "Escape" && modal.classList.contains("show")) {
        hideLogoutConfirmation();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);
  }
  
  // Show modal
  modal.classList.add("show");
  // Apply translations
  if (typeof applyTranslations === "function") {
    const currentLang = window.currentLang || localStorage.getItem("listo_lang") || "en";
    applyTranslations(currentLang);
  }
}

function hideLogoutConfirmation() {
  const modal = document.getElementById("logoutConfirmationModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

/* ========== Mobile Bottom Navigation ========== */
function initMobileBottomNav() {
  const bottomNav = document.querySelector(".mobile-bottom-nav");
  if (!bottomNav) return;

  // Set active state based on current page
  const path = window.location.pathname;
  const navItems = bottomNav.querySelectorAll(".mobile-bottom-nav-item");
  
  navItems.forEach(item => {
    item.classList.remove("active");
    const navType = item.getAttribute("data-nav");
    
    // Determine active state based on path and nav type
    let isActive = false;
    if (navType === "home" && (path.includes("dashboard.html") || path.endsWith("/") || path.endsWith("/index.html"))) {
      isActive = true;
    } else if (navType === "contracts" && path.includes("contracts")) {
      isActive = true;
    } else if (navType === "bookkeeping" && path.includes("bookkeeping")) {
      isActive = true;
    } else if (navType === "tools" && (path.includes("tools") || path.includes("audit") || path.includes("invoice") || path.includes("contract-scanner"))) {
      isActive = true;
    } else if (navType === "settings" && (path.includes("settings") || path.includes("account") || path.includes("support"))) {
      isActive = true;
    } else if (navType === "bookkeeping" && path.includes("employees")) {
      // Employee Management is part of bookkeeping workflow
      isActive = true;
    }
    
    if (isActive) {
      item.classList.add("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initSidebarNav();
  initYear();
  initMobileBottomNav();
  
  // Re-initialize sidebar nav after a short delay to ensure all elements are ready
  setTimeout(() => {
    initSidebarNav();
  }, 100);

  // Initialize language immediately for auth pages (login, signup, forgot)
  const page = document.body?.getAttribute("data-page");
  const isAuthPage = page === "login" || page === "signup" || page === "forgot" || window.location.pathname.includes("/forgot/");
  if (isAuthPage) {
    initLanguage();
  }

  const ok = await initFirebase();
  if (!ok) return;

  onAuthStateChanged(auth, async (user) => {
    // Handle sidebar logout button (desktop)
    const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
    if (sidebarLogoutBtn) {
      sidebarLogoutBtn.hidden = !user;
      
      // Set up logout handler only once per button instance
      if (!sidebarLogoutBtn.dataset.handlerAttached && auth) {
        sidebarLogoutBtn.dataset.handlerAttached = "true";
        sidebarLogoutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showLogoutConfirmation();
        });
      }
    }
    
    // Handle mobile logout button (mobile only)
    initMobileLogoutButton(user, auth);
    
    const headerAvatar = document.getElementById("headerAvatar");
    if (headerAvatar) headerAvatar.hidden = !user;
    
    // Initialize language based on auth state
    // Skip for auth pages since initLanguage() was already called
    if (!isAuthPage) {
      await initLanguageForUser(user);
    }
    
    if (user) {
      await updateHeaderAvatar(user);
    }

    requireAuthGuard(user);
    initAuthUI();
    
    // Update mobile bottom nav active state after language is set
    initMobileBottomNav();

    if (!user) return;

    const page = document.body?.getAttribute("data-page");
    try {
      if (page === "prequal") await initPrequalPage(user);
      if (page === "account") {
        // Account page handles prequal initialization in account.js
        // But we still need to update dashboard status dots
        const prequalData = await loadPrequalStatus(user.uid);
        updatePrequalUI(prequalData);
      }
      if (page === "dashboard") {
        // Dashboard needs prequal status for the account info box
        const prequalData = await loadPrequalStatus(user.uid);
        updatePrequalUI(prequalData);
      }
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
