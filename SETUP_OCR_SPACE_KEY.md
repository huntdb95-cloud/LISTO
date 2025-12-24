# Setting Up OCR.Space API Key

## Get Your API Key

1. Visit https://ocr.space/ocrapi/freekey to get a free API key
2. Free tier: 25,000 requests/month

## Option 1: Firebase Functions Config (Recommended)

Set the API key using Firebase Functions config:

```bash
firebase functions:config:set ocr_space.api_key="YOUR_OCR_SPACE_API_KEY"
```

Then deploy your functions:
```bash
firebase deploy --only functions:scanContract
```

## Option 2: Environment Variable

Set as an environment variable in your Firebase Functions:

```bash
# For local development, create a .env file in the functions folder:
echo OCR_SPACE_API_KEY=YOUR_OCR_SPACE_API_KEY > functions/.env

# For production, set via Firebase:
firebase functions:config:set ocr_space.api_key="YOUR_OCR_SPACE_API_KEY"
```

**⚠️ WARNING:** Never commit API keys to version control! Always use environment variables or Firebase Functions config.

## Verify Setup

After setting the key, test the Document Translator tool:
1. Upload a test document (PDF or image)
2. Check Firebase Functions logs: `firebase functions:log --only scanContract`
3. Verify OCR extraction works correctly

## Security Notes

- Never commit API keys to version control
- Use Firebase Functions config or environment variables
- The key is stored securely in Firebase and not exposed to the client

