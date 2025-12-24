# Document Translator Setup Guide

This guide explains how to configure the Document Translator tool that uses OCR.Space API for OCR and Google Cloud Translation API for translation.

## Overview

The Document Translator tool:
1. Accepts document uploads (PDF, JPG, PNG) or camera capture on mobile
2. Extracts text using OCR.Space API
3. Translates the text to Spanish using Google Cloud Translation API
4. Displays results side-by-side (original text and Spanish translation)

## Prerequisites

1. Firebase project with Cloud Functions enabled
2. OCR.Space API key (free tier available)
3. Google Cloud Translation API enabled (if not already set up)

## Setup Instructions

### 1. Get OCR.Space API Key

1. Visit https://ocr.space/ocrapi/freekey
2. Sign up for a free account (25,000 requests/month free)
3. Copy your API key

### 2. Set Environment Variable

Set the OCR.Space API key as a Firebase Functions environment variable:

```bash
firebase functions:config:set ocr_space.api_key="YOUR_OCR_SPACE_API_KEY"
```

Or if using the newer environment variable approach:

```bash
firebase functions:secrets:set OCR_SPACE_API_KEY
```

Then update `functions/index.js` to use:
```javascript
const ocrSpaceApiKey = functions.config().ocr_space?.api_key || process.env.OCR_SPACE_API_KEY;
```

### 3. Deploy Cloud Functions

Deploy the updated function:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:scanContract
```

### 4. Verify Setup

1. Go to the Document Translator page in your app
2. Upload a test document (PDF or image)
3. Check that OCR and translation work correctly

## API Limits

- **OCR.Space Free Tier**: 25,000 requests/month
- **Google Translation API**: Check your quota in Google Cloud Console

## Troubleshooting

### OCR Fails

- Check that `OCR_SPACE_API_KEY` environment variable is set correctly
- Verify the API key is valid at https://ocr.space/ocrapi
- Check Firebase Functions logs: `firebase functions:log --only scanContract`

### Translation Fails

- Ensure Google Cloud Translation API is enabled
- Check IAM roles and permissions
- Verify project ID is set correctly

### File Upload Issues

- Check file size limits (20 MB max)
- Verify file types are supported (PDF, JPG, PNG)
- Ensure Firebase Storage rules allow uploads

## Code Structure

- **Frontend**: `contract-scanner/contract-scanner.html` and `contract-scanner/contract-scanner.js`
- **Backend**: `functions/index.js` (scanContract function)
- **OCR Implementation**: Uses OCR.Space API with base64 image encoding
- **Translation**: Uses Google Cloud Translation API (existing implementation)

## Notes

- The tool was renamed from "Contract Scanner" to "Document Translator"
- OCR now uses OCR.Space instead of Google Cloud Vision
- Mobile camera capture is supported via `accept="image/*" capture` attribute
- Side-by-side layout on desktop, tabbed view on mobile

