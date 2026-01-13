# emobility-staff-portal Recovery Guide

## Overview
This guide helps you quickly restore your development environment if your laptop fails or needs reinstalling.

## What's Backed Up

### ✅ Automatically Protected (in Git/GitHub)
- **Source code** – All `.tsx`, `.ts`, `.css`, `.json` files
- **Configuration** – `vite.config.ts`, `tsconfig.json`
- **Package manifest** – `package.json`, `package-lock.json`
- **Documentation** – All `.md` files including this one

### ⚠️ Requires Manual Backup (SECRETS)
- **`.env`** and **`.env.local`** – API keys, database URLs, email credentials
- **Firebase Service Account JSON** – Admin authentication for Firebase
- **SendGrid API key** – Email sending credentials

## Backup Strategy

### Automated Backup
Run the backup script regularly to save secrets:

```powershell
# One-time: Run with default settings (backs up to OneDrive)
PowerShell -ExecutionPolicy Bypass -File scripts/backup-env.ps1

# Or specify custom backup location
PowerShell -ExecutionPolicy Bypass -File scripts/backup-env.ps1 -BackupPath "D:\my-backups\emobility"
```

**Recommended**: Add to Windows Task Scheduler to run weekly

### Manual Backup Locations
1. **OneDrive / Cloud Storage** (recommended)
   - Automatic sync across devices
   - Version history if available
   - Encrypted at rest

2. **Encrypted USB Drive**
   - Physical backup
   - Keep in safe location
   - Use BitLocker or VeraCrypt for encryption

3. **Password Manager**
   - Store individual secrets in 1Password, Bitwarden, LastPass
   - Sync across devices
   - Easy retrieval after format

## Environment Variables to Backup

### Required for Local Development (.env)
```
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_API_KEY=... (production key)
FIREBASE_DATABASE_URL=...
SENDGRID_API_KEY=...
FROM_EMAIL=...
APP_URL=...
FIREBASE_SERVICE_ACCOUNT_JSON=... (optional for dev)
```

### Local Overrides (.env.local)
```
VITE_DEV_TUNNEL=false (if using tunnel)
Any dev-specific overrides
```

## Recovery Steps

### Step 1: Reinstall Node.js
```powershell
# Install Node.js 18+ from https://nodejs.org/
# Or via Chocolatey:
choco install nodejs
```

### Step 2: Clone Repository
```powershell
git clone https://github.com/your-org/emobility-staff-portal.git
cd emobility-staff-portal
```

### Step 3: Restore Environment Files
Copy backed-up `.env` and `.env.local` files to project root:
```powershell
# From OneDrive or backup location
Copy-Item "D:\Backups\emobility\.env" -Destination ".env"
Copy-Item "D:\Backups\emobility\.env.local" -Destination ".env.local"
```

### Step 4: Restore Firebase Service Account (if used)
```powershell
# Copy Firebase service account JSON to project root
Copy-Item "D:\Backups\emobility\firebase-service-account.json" -Destination "."
```

### Step 5: Install Dependencies
```powershell
npm install
# This uses package-lock.json to restore exact versions
```

### Step 6: Verify Setup
```powershell
# Build check
npm run build

# Start dev server
npm run dev

# In another terminal, start API server
npm run api
```

## Critical Files Reference

### Configuration Files (in Git)
```
├── vite.config.ts              # Build and dev config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies and scripts
├── package-lock.json           # Locked dependency versions
└── .env.example                # Template for environment vars
```

### Secret Files (DO NOT COMMIT - Back up manually)
```
├── .env                        # Local environment variables
├── .env.local                  # Local dev overrides
└── firebase-service-account.json (if using admin SDK)
```

### Git Configuration
```
.gitignore contains:
├── .env
├── .env.local
├── node_modules/
└── dist/
```

## Regenerating Secrets (if backup unavailable)

### Firebase API Key
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Settings → Service Accounts
3. Generate new private key → Download JSON
4. Extract `apiKey` and use for `VITE_FIREBASE_API_KEY`

### SendGrid API Key
1. Login to [SendGrid Dashboard](https://app.sendgrid.com/)
2. Settings → API Keys
3. Create new API Key with Mail Send permission
4. Copy and use for `SENDGRID_API_KEY`

### Firebase Service Account
1. Firebase Console → Project Settings → Service Accounts
2. Node.js tab → Generate new private key
3. Save as `firebase-service-account.json`
4. Add to `.env` as `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 encoded for Vercel)

## Post-Recovery Checklist

- [ ] Node.js installed and accessible in PATH
- [ ] `.env` and `.env.local` restored with correct values
- [ ] `npm install` completed without errors
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts Vite server on :3002
- [ ] `npm run api` starts API server on :5050
- [ ] Can create referral codes in UI
- [ ] Can send test emails
- [ ] Firebase connection working (can query data)

## Automating Backup (Windows Task Scheduler)

### Create Scheduled Backup

1. **Open Task Scheduler**
   - Windows Start → "Task Scheduler"

2. **Create Basic Task**
   - Action → Create Basic Task
   - Name: "emobility-staff-portal Backup"
   - Trigger: Weekly (e.g., Sunday 10:00 AM)

3. **Set Action**
   - Action: Start a program
   - Program: `powershell.exe`
   - Arguments:
     ```
     -ExecutionPolicy Bypass -File "D:\emobility\emobility-staff-portal\scripts\backup-env.ps1" -BackupPath "$env:OneDrive\emobility-backup"
     ```

4. **Finish**
   - Enable "Run with highest privileges"
   - Click Finish

### Verify Backups
Check your backup location regularly:
```powershell
Get-ChildItem -Path "$env:OneDrive\emobility-backup" | Format-List
```

## Troubleshooting Recovery

### "Cannot find module '@sendgrid/eventwebhook'"
```powershell
npm install
```

### Port 5050 already in use
```powershell
# Find process using port 5050
Get-NetTCPConnection -LocalPort 5050 | Select OwningProcess

# Kill process (replace PID)
Stop-Process -Id <PID> -Force

# Restart API server
npm run api
```

### Firebase connection fails
- Verify `FIREBASE_DATABASE_URL` is correct in `.env`
- Check Firebase project still exists and is accessible
- Regenerate service account JSON if needed

### SendGrid emails not working
- Verify `SENDGRID_API_KEY` is valid (regenerate if needed)
- Check `FROM_EMAIL` is verified sender in SendGrid
- Review API key permissions include "Mail Send"

## Support

For more details:
- [README.md](README.md) – Project overview
- [SECURITY_FIX_GUIDE.md](SECURITY_FIX_GUIDE.md) – Security setup
- [DEV_TUNNEL_SETUP.md](DEV_TUNNEL_SETUP.md) – Tunnel configuration

---

**Last Updated**: December 2025
**Backup Script Version**: 1.0
