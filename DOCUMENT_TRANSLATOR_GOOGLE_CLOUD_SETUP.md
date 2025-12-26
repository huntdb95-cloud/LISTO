# Document Translator - Google Cloud Setup Guide

This guide explains how to configure the Document Translator tool that uses **Google Cloud Vision OCR** and **Google Cloud Translation API**.

## Overview

The Document Translator tool:
1. Accepts image (JPG/PNG) or PDF uploads
2. Extracts text using **Google Cloud Vision OCR**
3. Translates extracted text to Spanish using **Google Cloud Translation API**
4. Stores results in Firestore `translatorJobs` collection

## Prerequisites

1. **Firebase Project** on **Blaze Plan** (pay-as-you-go)
   - The Blaze plan is required to use Cloud Functions with external APIs
   - Free tier includes generous quotas for Vision and Translation APIs

2. **Google Cloud Billing** enabled
   - Vision API: First 1,000 units/month free, then $1.50 per 1,000 units
   - Translation API: First 500,000 characters/month free, then $20 per 1M characters

## Step 1: Enable Google Cloud Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (or the linked GCP project)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Vision API"
5. Click **Enable**
6. Wait for the API to be enabled (usually takes 1-2 minutes)

## Step 2: Enable Google Cloud Translation API

1. In the same Google Cloud Console
2. Navigate to **APIs & Services** > **Library**
3. Search for "Cloud Translation API"
4. Click **Enable**
5. Wait for the API to be enabled (usually takes 1-2 minutes)

## Step 3: Verify Billing

1. In Google Cloud Console, go to **Billing**
2. Ensure billing is enabled for your project
3. If not enabled, follow the prompts to add a payment method
4. **Note**: Free tier quotas apply even with billing enabled

## Step 4: Verify Firebase Blaze Plan

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Usage and billing**
4. Ensure you're on the **Blaze Plan**
5. If on Spark (free) plan, upgrade to Blaze (no cost until you exceed free quotas)

## Step 5: Deploy Cloud Functions

The Cloud Functions use **default runtime identity** (no service account JSON needed). Firebase Functions automatically use the App Engine default service account with the necessary permissions.

1. Open terminal in your project root
2. Navigate to functions directory:
   ```bash
   cd functions
   ```
3. Install dependencies (if not already done):
   ```bash
   npm install
   ```
4. Deploy the function:
   ```bash
   firebase deploy --only functions:processDocument
   ```
   Or deploy all functions:
   ```bash
   firebase deploy --only functions
   ```

## Step 6: Deploy Security Rules

1. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. Deploy Storage rules:
   ```bash
   firebase deploy --only storage:rules
   ```

   Or deploy both:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

## Step 7: Verify IAM Roles (Optional)

The default App Engine service account should have the necessary permissions. If you encounter permission errors:

1. Go to [Google Cloud Console IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find the service account: `PROJECT_ID@appspot.gserviceaccount.com`
3. Ensure it has these roles:
   - **Cloud Vision API User** (roles/vision.user)
   - **Cloud Translation API User** (roles/cloudtranslate.user)
   - **Storage Object Admin** (roles/storage.objectAdmin) - for reading/writing files
   - **Firestore User** (roles/datastore.user) - for reading/writing Firestore

If roles are missing, click **Edit** and add them.

## Testing

1. Go to your Document Translator page
2. Upload a test image (JPG/PNG) or PDF
3. Click "Translate Document"
4. Wait for processing (images: ~30-60 seconds, PDFs: ~2-5 minutes)
5. Verify results appear side-by-side

## Troubleshooting

### Error: "Vision API is not enabled"
- Go to Google Cloud Console > APIs & Services > Library
- Enable "Cloud Vision API"
- Wait 1-2 minutes and try again

### Error: "Translation API is not enabled"
- Go to Google Cloud Console > APIs & Services > Library
- Enable "Cloud Translation API"
- Wait 1-2 minutes and try again

### Error: "Permission denied"
- Check IAM roles (Step 7)
- Ensure the App Engine default service account has the required roles

### Error: "Billing not enabled"
- Enable billing in Google Cloud Console
- Free tier quotas still apply

### PDF OCR times out
- Large PDFs (>50 pages) may take longer than 5 minutes
- Consider splitting large PDFs or using smaller files
- Check Cloud Functions logs: `firebase functions:log`

## Cost Estimates

### Free Tier (Monthly)
- **Vision API**: 1,000 units free
  - 1 image = 1 unit
  - 1 PDF page = 1 unit
- **Translation API**: 500,000 characters free

### Beyond Free Tier
- **Vision API**: $1.50 per 1,000 units
- **Translation API**: $20 per 1M characters

**Example**: Processing 100 images/month and translating 1M characters/month:
- Vision: 100 units (free)
- Translation: 500K free + 500K at $20/1M = **$10/month**

## Storage Paths

- **User uploads**: `uploads/{uid}/contract-scanner/{timestamp}-{filename}`
- **OCR output** (PDFs only): `ocr-output/{uid}/{jobId}/`

## Firestore Collection

- **Collection**: `translatorJobs`
- **Document structure**:
  ```javascript
  {
    uid: string,
    filePath: string,
    fileType: "image" | "pdf",
    originalFileName: string,
    status: "uploaded" | "processing" | "done" | "error",
    extractedText: string, // Added after OCR
    translatedText: string, // Added after translation
    sourceLanguage: string, // Detected language (default: "en")
    targetLanguage: "es",
    createdAt: timestamp,
    updatedAt: timestamp,
    errorMessage: string // Only if status is "error"
  }
  ```

## Support

If you encounter issues:
1. Check Cloud Functions logs: `firebase functions:log`
2. Check browser console for frontend errors
3. Verify APIs are enabled in Google Cloud Console
4. Verify IAM roles are correct




