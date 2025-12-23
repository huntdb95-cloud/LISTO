# W-9 OCR Auto-Fill Setup Guide

This guide explains how to set up automatic W-9 OCR processing for laborers in the Listo application.

## Overview

When a W-9 form is uploaded for a laborer, the system automatically:
1. Triggers a Firebase Cloud Function
2. Uses Google Cloud Vision OCR to extract text from the W-9
3. Parses key fields (name, address, EIN/SSN, etc.)
4. Updates the laborer record in Firestore with extracted data
5. Shows OCR status in the Labor Management UI

## Prerequisites

1. **Firebase CLI** installed and configured
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Node.js 18+** installed

3. **Google Cloud Project** with the following APIs enabled:
   - Cloud Vision API
   - Cloud Functions API
   - Cloud Storage API

## Setup Steps

### 1. Enable Required Google Cloud APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (`listo-c6a60`)
3. Navigate to **APIs & Services** > **Library**
4. Enable the following APIs:
   - **Cloud Vision API**
   - **Cloud Functions API**
   - **Cloud Storage API**

### 2. Set Up Service Account Permissions

The Cloud Function needs permission to:
- Read files from Firebase Storage
- Write to Firestore
- Call Cloud Vision API

1. Go to **IAM & Admin** > **Service Accounts** in Google Cloud Console
2. Find the default App Engine service account (usually `PROJECT_ID@appspot.gserviceaccount.com`)
3. Ensure it has the following roles:
   - **Cloud Functions Invoker**
   - **Storage Object Viewer**
   - **Firestore User** (or **Cloud Datastore User**)
   - **Cloud Vision API User**

Alternatively, the default App Engine service account should already have these permissions. If you encounter permission errors, you may need to grant additional roles.

### 3. Install Function Dependencies

```bash
cd functions
npm install
```

This will install:
- `firebase-admin` - Firebase Admin SDK
- `firebase-functions` - Firebase Functions SDK
- `@google-cloud/vision` - Google Cloud Vision API client
- `@google-cloud/storage` - Google Cloud Storage client

### 4. Deploy Cloud Functions

```bash
# From the project root directory
firebase deploy --only functions
```

This will deploy the `processW9Upload` function that triggers on W-9 file uploads.

### 5. Verify Deployment

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Functions**
4. Verify that `processW9Upload` is listed and shows "Active" status

### 6. Test the Function

1. Upload a W-9 form for a laborer in the Bookkeeping/Employee Management page
2. The function should automatically trigger
3. Check the Functions logs:
   ```bash
   firebase functions:log --only processW9Upload
   ```
4. Verify that the laborer record is updated with extracted fields

## How It Works

### Storage Trigger

The function `processW9Upload` is triggered when a file is uploaded to:
```
users/{uid}/laborers/{laborerId}/documents/w9/{fileName}
```

### OCR Processing

1. **File Download**: The function downloads the uploaded file from Storage
2. **OCR Extraction**: Uses Google Cloud Vision Document Text Detection API
3. **Text Parsing**: Extracts W-9 fields using pattern matching:
   - Legal name (from "Name (as shown on your income tax return)")
   - Business name (if present)
   - Address (street, city, state, ZIP)
   - EIN or SSN (last 4 digits only for privacy)
4. **Data Update**: Updates Firestore with extracted fields

### Field Extraction

The parser looks for:
- **Name**: Near "Name (as shown on your income tax return)"
- **Business Name**: Near "Business name" or "Disregarded entity name"
- **Address**: Near "Address (number, street, and apt. or suite no.)"
- **City/State/ZIP**: Near "City, state, and ZIP code"
- **EIN**: Format `XX-XXXXXXX` (2 digits, dash, 7 digits)
- **SSN**: Format `XXX-XX-XXXX` (only last 4 digits stored)

### Confidence Levels

- **High**: All required fields found (name, address, city, state, zip)
- **Medium**: Most fields found (3-4 required fields)
- **Low**: Few fields found (< 3 required fields)

### OCR Status Values

- `processing` - OCR is currently running
- `complete` - OCR completed successfully (high/medium confidence)
- `needs_review` - OCR completed but low confidence (user should review)
- `failed` - OCR failed (error message stored in `w9OcrError`)

## Firestore Schema Updates

The laborer document now includes:

```javascript
{
  // ... existing fields ...
  w9OcrStatus: "complete" | "processing" | "needs_review" | "failed",
  w9OcrUpdatedAt: Timestamp,
  w9SourceFilePath: "users/{uid}/laborers/{laborerId}/documents/w9/{fileName}",
  w9OcrError: "Error message" (only if failed),
  w9Info: {
    legalName: "John Doe",
    businessName: "Business Name" (optional),
    addressLine1: "123 Main St",
    addressLine2: "Apt 4B" (optional),
    city: "City",
    state: "CA",
    zip: "12345",
    taxClassification: "C-Corporation" (optional),
    tinType: "SSN" | "EIN",
    tinLast4: "1234" (last 4 of SSN or EIN),
    ein: "12-3456789" (only if EIN found),
    ocrConfidence: "high" | "medium" | "low",
    updatedAt: Number (timestamp)
  }
}
```

## Frontend Updates

### Labor Management (Bookkeeping)

- Shows OCR status badge when W-9 is uploaded
- Displays extracted fields when available
- Shows "Scanning W-9..." during processing
- Shows error message if OCR fails

### Employee Management

- Shows OCR status message when editing a laborer
- Pre-fills W-9 form fields with extracted data
- Allows manual override of any field
- Shows confidence level and review notice for low-confidence extractions

## Troubleshooting

### Function Not Triggering

1. Check that the file path matches: `users/{uid}/laborers/{laborerId}/documents/w9/{fileName}`
2. Verify the function is deployed: `firebase functions:list`
3. Check function logs: `firebase functions:log`

### OCR Errors

1. **"No text detected"**: The W-9 image may be too low quality or corrupted
2. **"Invalid file type"**: Only PDF, JPG, and PNG are supported
3. **Permission errors**: Check service account permissions (see Step 2)

### Low Confidence Extractions

- The W-9 form may be scanned at low resolution
- The form may be handwritten (OCR works best with typed text)
- The form layout may be non-standard
- Users can manually correct fields in Employee Management

### Function Timeout

- Large PDF files may take longer to process
- Default timeout is 60 seconds (can be increased in `functions/index.js`)

## Security & Privacy

- **SSN Privacy**: Only the last 4 digits of SSN are stored
- **EIN Storage**: Full EIN is stored (business identifier, less sensitive)
- **User Isolation**: Each user can only access their own laborer data
- **Firestore Rules**: Updated to allow OCR fields while maintaining security

## Cost Considerations

- **Cloud Vision API**: 
  - First 1,000 units/month: Free
  - $1.50 per 1,000 units after that
  - 1 unit = 1 page (PDF) or 1 image
- **Cloud Functions**: 
  - 2 million invocations/month: Free
  - $0.40 per million invocations after that
- **Storage**: Standard Firebase Storage pricing

## Maintenance

### Updating the Function

```bash
# Make changes to functions/index.js
cd functions
npm install  # if dependencies changed
cd ..
firebase deploy --only functions:processW9Upload
```

### Viewing Logs

```bash
firebase functions:log --only processW9Upload
```

### Monitoring

- Check function execution count and errors in Firebase Console
- Monitor Cloud Vision API usage in Google Cloud Console
- Set up alerts for function errors if needed

## Support

For issues or questions:
1. Check function logs: `firebase functions:log`
2. Review Cloud Vision API quotas in Google Cloud Console
3. Verify service account permissions
4. Check Firestore rules allow updates to laborer documents

