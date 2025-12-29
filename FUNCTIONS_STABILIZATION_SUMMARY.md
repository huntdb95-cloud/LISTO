# Firebase Functions Stabilization Summary

## Changes Made

### 1. ✅ Updated Node.js Runtime to 20
- **File**: `functions/package.json`
- **Change**: Updated `engines.node` from `18` to `20`
- **Action Required**: Run `cd functions && npm install`

### 2. ✅ Made `ping` Function Crash-Proof
- **File**: `functions/index.js`
- **Changes**:
  - Removed optional field access (`context.rawRequest?.headers?.origin`)
  - Wrapped entire function in try/catch
  - Returns simple object: `{ ok: true, serverTime, uidPresent, projectId }`
  - Throws `HttpsError` with real error message on failure
  - Logs structured JSON error details

### 3. ✅ Simplified `processDocumentForTranslation` to Echo Test
- **File**: `functions/index.js`
- **Changes**:
  - Temporarily removed all Vision OCR and Translation API calls
  - Now only validates auth, validates storage path, and returns Storage metadata
  - Returns: `{ ok: true, storagePath, contentType, size, uid }`
  - Comprehensive error logging with structured JSON
  - Throws `HttpsError` with real error messages (not just "internal")

### 4. ✅ Enhanced Error Logging
- **File**: `functions/index.js`
- **Changes**:
  - All errors log structured JSON with:
    - `requestId`
    - `operation`
    - `error.message`
    - `error.stack`
    - `uid`
    - `storagePath` (if present)
    - `timestamp`
  - Error messages are passed through to browser (not hidden as "internal")

## Verification Commands

### Step 1: Install Dependencies
```bash
cd functions
npm install
```

### Step 2: Deploy Functions
```bash
firebase deploy --only functions:ping,functions:processDocumentForTranslation
```

### Step 3: Verify Function Deployment
```bash
firebase functions:list
```

**Expected Output:**
- `ping` - us-central1
- `processDocumentForTranslation` - us-central1

### Step 4: Test Ping Function
```bash
firebase functions:log --only ping
```

**Expected Logs:**
```json
{
  "requestId": "...",
  "timestamp": "...",
  "operation": "ping",
  "uid": "..." or null
}
```

### Step 5: Test processDocumentForTranslation
```bash
firebase functions:log --only processDocumentForTranslation
```

**Expected Logs (on success):**
```json
{
  "requestId": "...",
  "operation": "processDocumentForTranslation_success",
  "duration": ...,
  "storagePath": "users/{uid}/translator/...",
  "contentType": "...",
  "size": ...,
  "uid": "..."
}
```

**Expected Logs (on error):**
```json
{
  "requestId": "...",
  "operation": "processDocumentForTranslation_error",
  "error": "...",
  "stack": "...",
  "uid": "...",
  "storagePath": "...",
  "timestamp": "..."
}
```

## Testing Checklist

### ✅ Ping Test
1. Open https://listonow.com/contract-scanner/contract-scanner.html
2. Sign in
3. Click "Show" in Diagnostics section
4. Click "Run Ping"
5. **Expected**: Shows `ok: true`, `uidPresent: true`, `projectId: "listo-c6a60"`
6. **No CORS errors** in browser console

### ✅ Echo Test (processDocumentForTranslation)
1. Select a file (PDF or image)
2. Click "Run OCR + Translate (Smoke Test)"
3. **Expected**: Returns `{ ok: true, storagePath, contentType, size, uid }`
4. **No "internal" errors** - should show real error messages if any
5. Check browser console for detailed error info if it fails

## Next Steps (After Echo Test Succeeds)

Once the echo test works (ping + Storage metadata retrieval), you can re-enable OCR + Translation:

1. **Re-enable Vision OCR** in `processDocumentForTranslation`:
   - Add back `getVisionClient()` and Vision API calls
   - Keep the same error logging structure

2. **Re-enable Translation API**:
   - Add back `getTranslateClient()` and Translation API calls
   - Keep the same error logging structure

3. **Keep the enhanced error logging** - it will help diagnose any issues

## Troubleshooting

### If `ping` still returns "internal":
- Check Cloud Function logs: `firebase functions:log --only ping`
- Verify function deployed: `firebase functions:list`
- Check for syntax errors in `functions/index.js`

### If `processDocumentForTranslation` returns "internal":
- Check logs: `firebase functions:log --only processDocumentForTranslation`
- Verify Storage path matches: `users/{uid}/translator/...`
- Verify user is authenticated
- Check Storage rules allow read access

### If npm install fails:
- Ensure Node.js 20 is installed: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then reinstall

## Files Modified

1. `functions/package.json` - Node version updated to 20
2. `functions/index.js` - Ping function simplified, processDocumentForTranslation converted to echo test

