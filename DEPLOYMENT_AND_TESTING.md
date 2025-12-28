# Document Translator: Deployment & Testing Guide

## Quick Deployment Commands

### Deploy All Functions (Recommended)
```bash
firebase deploy --only functions
```

### Deploy Specific Functions Only
```bash
firebase deploy --only functions:ping,functions:debugStorageRead,functions:processDocumentForTranslation
```

### View Function Logs
```bash
# View all function logs
firebase functions:log

# View logs for specific function
firebase functions:log --only ping
firebase functions:log --only debugStorageRead
firebase functions:log --only processDocumentForTranslation

# Follow logs in real-time
firebase functions:log --follow
```

### Verify Function Region
```bash
# List all deployed functions and their regions
firebase functions:list
```

Expected output should show:
- `ping` - us-central1
- `debugStorageRead` - us-central1
- `processDocumentForTranslation` - us-central1

## Verification Checklist

### ✅ 1. Authentication Test
**Test:** Click "Run Ping" button in Diagnostics section

**Expected Results:**
- ✅ Shows `ok: true`
- ✅ Shows `uidPresent: true` when logged in
- ✅ Shows `uidPresent: false` when logged out
- ✅ Shows `projectId: "listo-c6a60"`
- ✅ No CORS errors in browser console
- ✅ Function logs show request with uid and origin

**If Fails:**
- Check browser console for CORS errors
- Verify function is deployed to us-central1
- Check Firebase Auth is working

---

### ✅ 2. Storage Upload + Read Test
**Test:** 
1. Select a file (PDF or image)
2. Click "Verify Upload + Read" button

**Expected Results:**
- ✅ File uploads successfully to `users/{uid}/translator/{timestamp}_{filename}`
- ✅ Shows `ok: true` from debugStorageRead
- ✅ Shows `bytes > 0`
- ✅ Shows correct `contentType`
- ✅ No permission errors

**If Fails:**
- Check Storage rules allow `users/{uid}/translator/*`
- Verify user is authenticated
- Check file size < 20MB
- Check file type is PDF or image

---

### ✅ 3. OCR + Translation Smoke Test
**Test:**
1. Select a file with visible text (PDF or image)
2. Click "Run OCR + Translate (Smoke Test)" button

**Expected Results:**
- ✅ File uploads successfully
- ✅ `extractedText` is non-empty
- ✅ `translatedText` is non-empty (Spanish)
- ✅ Results displayed in UI
- ✅ No "internal" errors
- ✅ Function logs show successful OCR and translation

**If Fails:**
- Check Cloud Function logs for specific error
- Verify Vision API is enabled in Google Cloud Console
- Verify Translation API is enabled
- Check service account has required IAM roles

---

### ✅ 4. Cross-User Access Blocked
**Test:** (Manual - requires two accounts)
1. As User A, upload a file
2. Note the storage path: `users/USER_A_UID/translator/...`
3. As User B, try to access User A's file path
4. Should be denied

**Expected Results:**
- ✅ Permission denied error
- ✅ Storage rules prevent access

---

### ✅ 5. Signed-Out Upload Fails
**Test:**
1. Sign out
2. Try to upload a file
3. Should fail with authentication error

**Expected Results:**
- ✅ Error: "Please sign in first" or "Unauthenticated"
- ✅ No file uploaded to Storage

---

### ✅ 6. Cloud Function Can Read File
**Test:** (Automatic - part of "Verify Upload + Read")
- When "Verify Upload + Read" succeeds, this is confirmed

**Expected Results:**
- ✅ Function successfully reads file from Storage
- ✅ Returns file metadata (bytes, contentType)
- ✅ No IAM permission errors

**If Fails:**
- Check Cloud Function service account has "Storage Object Viewer" role
- Verify service account: `[PROJECT-ID]@appspot.gserviceaccount.com`

---

## Cloud Function IAM Requirements

The default App Engine service account needs these roles:

1. **Storage Object Viewer** - Read uploaded files
2. **Storage Object Creator** - Write OCR output files (if needed)
3. **Cloud Vision API User** - Call Vision API
4. **Cloud Translation API User** - Call Translation API

### Verify IAM Roles
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: IAM & Admin → IAM
3. Find: `listo-c6a60@appspot.gserviceaccount.com`
4. Verify roles include:
   - Storage Object Viewer
   - Storage Object Creator
   - Cloud Vision API User
   - Cloud Translation API User

### Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Enabled APIs
3. Verify these APIs are enabled:
   - Cloud Vision API
   - Cloud Translation API
   - Cloud Storage API

---

## Troubleshooting Common Errors

### Error: "Missing or insufficient permissions"
**Possible Causes:**
- Storage rules not deployed
- Firestore rules blocking (if using Firestore)
- User not authenticated
- Storage path doesn't match rules pattern

**Fix:**
1. Deploy rules: `firebase deploy --only storage,firestore:rules`
2. Verify user is signed in
3. Check storage path matches `users/{uid}/translator/*`

---

### Error: "CORS preflight blocked"
**Possible Causes:**
- Function not using callable (using fetch instead)
- Function region mismatch
- Hosting domain not whitelisted

**Fix:**
1. Ensure using `httpsCallable()` not `fetch()`
2. Verify function region is `us-central1`
3. Callable functions handle CORS automatically

---

### Error: "functions/internal"
**Possible Causes:**
- Unhandled exception in Cloud Function
- Missing try/catch wrapper
- Service account permissions

**Fix:**
1. Check Cloud Function logs: `firebase functions:log --only processDocumentForTranslation`
2. Verify function has try/catch wrapper
3. Check service account IAM roles

---

### Error: "File not found in storage"
**Possible Causes:**
- File upload failed silently
- Storage path mismatch
- File deleted before function runs

**Fix:**
1. Check Storage upload succeeded
2. Verify storage path in function matches upload path
3. Check Storage rules allow read

---

## Testing on Different Devices

### Desktop Edge
1. Open https://listonow.com/contract-scanner/contract-scanner.html
2. Sign in
3. Run all diagnostics tests
4. Check browser console for errors

### iPhone Safari/Edge
1. Open https://listonow.com/contract-scanner/contract-scanner.html
2. Sign in
3. Run all diagnostics tests
4. Check for mobile-specific issues (file upload, camera capture)

---

## Success Criteria

All tests pass when:
- ✅ Ping returns `ok: true` with `uidPresent: true`
- ✅ Upload + Read returns file metadata
- ✅ OCR + Translation returns non-empty text in both languages
- ✅ No CORS errors in console
- ✅ No "internal" errors
- ✅ Function logs show detailed request/response info
- ✅ Works on both Edge desktop and iPhone Safari/Edge

