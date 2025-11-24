# Security Fix Guide - Simple Steps

## ✅ What I've Done For You

1. **Created `.env` file** with your current Firebase credentials
2. **Updated `firebaseConfig.ts`** to read from environment variables
3. **Created `.env.example`** as a template for future reference
4. **Added TypeScript definitions** so the code works properly
5. **Committed and pushed** the changes to GitHub

## 🔒 What You Need to Do (Simple 3 Steps)

### Step 1: Rotate Your Firebase API Key
1. Go to: https://console.firebase.google.com/
2. Select project: **emobility-service**
3. Click the ⚙️ gear icon → **Project settings**
4. Scroll down to "Your apps" section
5. Find your Web app and click **"Rotate API Key"** or regenerate
6. Copy the new API key

### Step 2: Update Your .env File
1. Open `.env` file in your project
2. Replace the old API key with the new one:
   ```
   VITE_FIREBASE_API_KEY=YOUR_NEW_API_KEY_HERE
   ```
3. Save the file

### Step 3: Test Your App
1. Run: `npm run dev`
2. Open the app and make sure it connects to Firebase
3. Try logging in and accessing data

## 📝 Important Notes

- The `.env` file is **already in .gitignore** - it won't be pushed to GitHub
- The `.env.example` file is a template (no real credentials) - safe to share
- You only need to rotate the API key - other values stay the same
- Your app will automatically use the new key from `.env`

## ⚠️ Vercel Deployment

When you deploy to Vercel, you'll need to add these environment variables there too:
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each `VITE_FIREBASE_*` variable with the new key

That's it! Much simpler than it sounds. Let me know if you need help with any step.
