# 🚨 Security Fix: Rotate Exposed Firebase API Key

## What Happened
The Firebase API key was hardcoded in `public/token-getter.html` and committed to GitHub. GitHub's security scanning detected this and flagged it as a security risk.

## What Has Been Fixed
✅ Removed hardcoded credentials from `public/token-getter.html`
✅ Created `scripts/generate-firebase-config.js` to inject config at build time
✅ Added `public/firebase-config.js` to `.gitignore`
✅ Updated build script to auto-generate config before building

## What You Must Do Now

### 1. Rotate the Exposed API Key (CRITICAL)

The exposed key was: `AIzaSyDHYxqQD4ZoVlgTy2XUhsVpf7GOz3N4qAI`

**Steps to rotate:**

1. **Create a new Firebase Web API Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `emobility-service`
   - Go to **Project Settings** (gear icon) → **General** tab
   - Scroll to **Your apps** section
   - Click on your web app (or add a new one if needed)
   - Copy the new `apiKey` from the config

2. **Update Google Cloud API Key restrictions:**
   - Go to [Google Cloud Console - API Keys](https://console.cloud.google.com/apis/credentials)
   - Find the **old key** (`AIzaSyDHYxqQD4ZoVlgTy2XUhsVpf7GOz3N4qAI`)
   - Click **Delete** to revoke it (or rename to "REVOKED - Do Not Use")
   
3. **Update your `.env` file:**
   ```bash
   VITE_FIREBASE_API_KEY=your_new_api_key_here
   ```

4. **Update Vercel environment variables:**
   ```bash
   vercel env add VITE_FIREBASE_API_KEY production
   # Paste your new API key when prompted
   ```

5. **Redeploy:**
   ```bash
   git add -A
   git commit -m "Security: Remove hardcoded Firebase credentials"
   git push
   vercel deploy --prod
   ```

### 2. Restrict the New API Key (IMPORTANT)

Set proper restrictions to prevent abuse:

1. Go to [Google Cloud Console - API Keys](https://console.cloud.google.com/apis/credentials)
2. Click your **new** API key
3. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add these referrers:
     ```
     https://your-vercel-domain.vercel.app/*
     https://your-custom-domain.com/*
     http://localhost:3002/*
     http://127.0.0.1:3002/*
     ```
4. Under **API restrictions**:
   - Select **Restrict key**
   - Enable only these APIs:
     - Firebase Realtime Database API
     - Firebase Authentication API
     - Cloud Messaging API
     - Identity Toolkit API
5. Click **Save**

### 3. Verify the Fix

1. **Test local build:**
   ```bash
   npm run build
   # Should see: ✅ Generated public/firebase-config.js from environment variables
   ```

2. **Verify token-getter.html works:**
   ```bash
   npm run preview
   # Navigate to http://localhost:4173/token-getter.html
   ```

3. **Check that credentials are NOT in git:**
   ```bash
   git status
   # public/firebase-config.js should NOT appear (it's gitignored)
   ```

### 4. Review Firebase Security Rules

Double-check your Firebase Realtime Database security rules are properly configured:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "fcmTokens": {
      "$tokenId": {
        ".write": "auth != null"
      }
    }
  }
}
```

## How This Works Now

1. **Development:**
   - Config loaded from `.env` via `import.meta.env.VITE_*`
   - `.env` is gitignored and never committed

2. **Build time:**
   - `npm run build` automatically runs `prebuild` script
   - `generate-firebase-config.js` reads env vars and creates `public/firebase-config.js`
   - Generated file is gitignored

3. **Production (Vercel):**
   - Env vars set in Vercel dashboard
   - Build generates `firebase-config.js` from Vercel env
   - `token-getter.html` loads config via `<script src="/firebase-config.js">`

## Prevent Future Leaks

✅ **Never commit:**
- `.env` files
- API keys, passwords, tokens
- `firebase-config.js` (auto-generated)
- Private keys or certificates

✅ **Always use:**
- Environment variables for secrets
- `.gitignore` for sensitive files
- Build-time injection for public HTML files

✅ **Enable GitHub security:**
- GitHub secret scanning (already enabled - it caught this!)
- Dependabot alerts
- Branch protection rules

## Need Help?

If you see any issues after rotating the key:
1. Check browser console for errors
2. Verify env vars are set: `echo $VITE_FIREBASE_API_KEY` (local) or check Vercel dashboard
3. Hard refresh browser: Ctrl+Shift+R
4. Check that old API key is fully disabled in Google Cloud Console

---

**Status:** 🔴 Action Required - API key must be rotated immediately
**Priority:** CRITICAL - Exposed credentials can allow unauthorized access
**Timeline:** Complete within 24 hours to minimize security risk
