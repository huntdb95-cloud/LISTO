# Setting Up OCR.Space API Key

Your OCR.Space API key: `K81280465788957`

## Option 1: Firebase Functions Config (Recommended)

Set the API key using Firebase Functions config:

```bash
firebase functions:config:set ocr_space.api_key="K81280465788957"
```

Then deploy your functions:
```bash
firebase deploy --only functions:scanContract
```

## Option 2: Environment Variable

Set as an environment variable in your Firebase Functions:

```bash
# For local development, create a .env file in the functions folder:
echo OCR_SPACE_API_KEY=K81280465788957 > functions/.env

# For production, set via Firebase:
firebase functions:config:set ocr_space.api_key="K81280465788957"
```

## Option 3: Temporary Hardcode (NOT RECOMMENDED)

If you need to test quickly, you can temporarily hardcode it in `functions/index.js`:

```javascript
const ocrSpaceApiKey = "K81280465788957"; // TEMPORARY - Move to config!
```

**⚠️ WARNING:** Remove hardcoded keys before committing to version control!

## Verify Setup

After setting the key, test the Document Translator tool:
1. Upload a test document (PDF or image)
2. Check Firebase Functions logs: `firebase functions:log --only scanContract`
3. Verify OCR extraction works correctly

## Security Notes

- Never commit API keys to version control
- Use Firebase Functions config or environment variables
- The key is stored securely in Firebase and not exposed to the client

