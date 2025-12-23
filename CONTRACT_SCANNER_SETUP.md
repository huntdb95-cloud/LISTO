# Contract Scanner Setup Guide

This guide explains how to configure the Contract Scanner tool that uses Google Cloud Vision OCR and Translation APIs.

## Overview

The Contract Scanner tool:
1. Accepts uploaded PDF/image files
2. Extracts text using Google Cloud Vision OCR
3. Translates the text to Spanish using Google Cloud Translation API
4. Displays results side-by-side (desktop) or with a toggle (mobile)

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Firebase Project** linked to your Google Cloud Project
3. **Firebase Functions** deployed and configured

## Step 1: Enable Required Google Cloud APIs

Enable the following APIs in your Google Cloud Console:

1. **Cloud Vision API**
   - Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com
   - Click "Enable"

2. **Cloud Translation API**
   - Go to: https://console.cloud.google.com/apis/library/translate.googleapis.com
   - Click "Enable"

## Step 2: Configure Service Account Permissions

The Firebase Functions runtime uses the default App Engine service account. Ensure it has the required IAM roles:

1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find your project's App Engine default service account (format: `PROJECT_ID@appspot.gserviceaccount.com`)
3. Click "Edit" and add these roles:
   - **Cloud Vision API User** (`roles/cloudvision.user`)
   - **Cloud Translation API User** (`roles/cloudtranslate.user`)
   - **Storage Object Viewer** (`roles/storage.objectViewer`) - for reading uploaded files

Alternatively, you can grant these permissions via gcloud CLI:

```bash
PROJECT_ID="your-project-id"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudvision.user"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtranslate.user"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectViewer"
```

## Step 3: Install Dependencies

In the `functions` directory, install the required npm packages:

```bash
cd functions
npm install
```

This will install:
- `@google-cloud/vision` - For OCR
- `@google-cloud/translate` - For translation
- `@google-cloud/storage` - For file access
- `uuid` - For request ID generation

## Step 4: Deploy Firebase Functions

Deploy the updated functions:

```bash
firebase deploy --only functions
```

Or deploy just the new functions:

```bash
firebase deploy --only functions:scanContract,functions:healthGoogle
```

## Step 5: Verify Configuration

### Option A: Use the Health Check Endpoint

After deployment, visit:
```
https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/healthGoogle
```

Or if using Firebase Hosting:
```
https://YOUR_PROJECT_ID.web.app/healthGoogle
```

This will return diagnostic information about your API configuration.

### Option B: Test via Frontend

1. Go to the Contract Scanner page in your app
2. Upload a test PDF or image
3. Check the browser console for any errors
4. If an error occurs, check the error message for the specific error code

## Step 6: Enable Debug Mode (Optional)

To enable verbose logging for debugging, set the `DEBUG_MODE` environment variable:

```bash
firebase functions:config:set debug.mode="true"
firebase deploy --only functions
```

Or via Firebase Console:
1. Go to Functions → Configuration
2. Add environment variable: `DEBUG_MODE` = `true`
3. Redeploy functions

**Note:** Debug mode logs additional context but never logs secrets or API keys.

## Error Codes Reference

The tool returns specific error codes to help diagnose issues:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `VISION_AUTH` | Vision API authentication failed | Check service account credentials |
| `VISION_PERMISSION` | Vision API permission denied | Grant `roles/cloudvision.user` to service account |
| `VISION_QUOTA` | Vision API quota exceeded | Wait or upgrade quota in Google Cloud Console |
| `TRANSLATE_AUTH` | Translation API authentication failed | Check service account credentials |
| `TRANSLATE_PERMISSION` | Translation API permission denied | Grant `roles/cloudtranslate.user` to service account |
| `TRANSLATE_QUOTA` | Translation API quota exceeded | Wait or upgrade quota |
| `TRANSLATE_API_DISABLED` | Translation API not enabled | Enable API in Google Cloud Console |
| `FILE_TOO_LARGE` | File exceeds 20 MB limit | Use a smaller file |
| `BAD_REQUEST` | Invalid file type or missing parameters | Check file format (PDF, JPG, PNG, HEIC) |
| `NO_TEXT_DETECTED` | No text found in document | Ensure document contains readable text |
| `UNKNOWN` | Unexpected error | Check server logs using requestId |

## Troubleshooting

### "Internal server error" message

If you see a generic "internal server error":
1. Check the browser console for the full error
2. Look for a `requestId` in the error message
3. Check Firebase Functions logs: `firebase functions:log`
4. Use the health check endpoint to verify API configuration

### "OCR failed: Google Vision API credentials missing"

1. Verify the Vision API is enabled
2. Check service account has `roles/cloudvision.user` role
3. Ensure Firebase Functions are using the correct project

### "Translation failed: API not enabled"

1. Enable Cloud Translation API in Google Cloud Console
2. Wait a few minutes for the API to fully activate
3. Redeploy functions if needed

### Functions timeout

If functions timeout (>60 seconds):
- Large files may take longer to process
- Consider implementing async processing for very large documents
- Check function timeout settings in `firebase.json`

## File Size Limits

- **Maximum file size:** 20 MB
- **Supported formats:** PDF, JPG, JPEG, PNG, HEIC
- **Recommended:** PDFs under 10 MB for faster processing

## API Quotas

Google Cloud APIs have default quotas:
- **Vision API:** 1,800 requests/minute (can be increased)
- **Translation API:** 500,000 characters/day (free tier)

Monitor usage in Google Cloud Console:
- https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas
- https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas

## Security Notes

- All Google API calls happen server-side (never from the browser)
- Service account credentials are automatically managed by Firebase
- No API keys or credentials are exposed to the frontend
- File uploads are stored in Firebase Storage with proper security rules

## Support

If you encounter issues:
1. Check Firebase Functions logs: `firebase functions:log --only scanContract`
2. Use the health check endpoint to verify configuration
3. Check error code in the UI and refer to the Error Codes Reference above
4. Copy debug details using the "Copy Debug Details" button in the error message

