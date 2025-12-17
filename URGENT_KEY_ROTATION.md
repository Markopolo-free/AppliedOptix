## 🚨 IMMEDIATE ACTION REQUIRED - API Key Rotation

### Exposed Credential
**Old API Key (EXPOSED):** `AIzaSyDHYxqQD4ZoVlgTy2XUhsVpf7GOz3N4qAI`

---

## Quick Fix Steps (15 minutes)

### Step 1: Delete/Disable Old Key ⚠️ CRITICAL
```
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find: AIzaSyDHYxqQD4ZoVlgTy2XUhsVpf7GOz3N4qAI
3. Click DELETE or rename to "REVOKED - GitHub Leaked"
```

### Step 2: Get New API Key from Firebase
```
1. Go to: https://console.firebase.google.com/
2. Select project: emobility-service
3. Click ⚙️ (Settings) → Project Settings
4. Under "Your apps" → Web app
5. Copy the NEW apiKey from config
```

### Step 3: Update Local .env
```bash
# Edit .env file - replace with NEW key:
VITE_FIREBASE_API_KEY=YOUR_NEW_KEY_HERE
```

### Step 4: Update Vercel
```bash
vercel env rm VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_API_KEY production
# Paste NEW key when prompted
```

### Step 5: Redeploy
```bash
vercel deploy --prod
```

### Step 6: Test
```bash
# Local test
npm run build
npm run preview
# Visit: http://localhost:4173/token-getter.html
```

---

## What Was Fixed (Already Committed)

✅ Removed hardcoded credentials from `token-getter.html`  
✅ Created build-time config injection script  
✅ Added `firebase-config.js` to `.gitignore`  
✅ Fixed mobile browser compatibility  
✅ Pushed security fix to GitHub  

---

## Security Verification Checklist

- [ ] Old API key deleted/disabled in Google Cloud Console
- [ ] New API key created in Firebase Console
- [ ] `.env` updated with new key (never commit this file!)
- [ ] Vercel env vars updated with new key
- [ ] Production deployed with new key
- [ ] `token-getter.html` tested and working
- [ ] Confirmed `firebase-config.js` is NOT in git: `git status`
- [ ] GitHub security alert dismissed (it will auto-resolve after key rotation)

---

## Need More Details?

See **SECURITY_KEY_ROTATION.md** for:
- Complete walkthrough with screenshots
- How to restrict the new API key
- Firebase security rules recommendations
- Troubleshooting guide

---

**Timeline:** Complete within 24 hours  
**Status:** Code fixed ✅ | Key rotation pending ⚠️
