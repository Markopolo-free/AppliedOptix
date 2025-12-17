# Firebase API Key Rotation Script
# Run this AFTER you've obtained the new API key from Firebase Console

Write-Host "🔐 Firebase API Key Rotation Helper" -ForegroundColor Cyan
Write-Host ""

# Prompt for new API key
Write-Host "First, get your new API key:" -ForegroundColor Yellow
Write-Host "1. Go to: https://console.firebase.google.com/" -ForegroundColor Gray
Write-Host "2. Select project: emobility-service" -ForegroundColor Gray
Write-Host "3. Settings → Project Settings → Your apps (Web app)" -ForegroundColor Gray
Write-Host "4. Copy the apiKey value" -ForegroundColor Gray
Write-Host ""

$newApiKey = Read-Host "Paste your NEW Firebase API key here"

if ([string]::IsNullOrWhiteSpace($newApiKey)) {
    Write-Host "❌ No API key provided. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ New API key received: $($newApiKey.Substring(0, 10))..." -ForegroundColor Green
Write-Host ""

# Update .env file
Write-Host "📝 Updating .env file..." -ForegroundColor Cyan
$envPath = ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace 'VITE_FIREBASE_API_KEY=.*', "VITE_FIREBASE_API_KEY=$newApiKey"
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "✅ Updated .env" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found - you'll need to create it manually" -ForegroundColor Yellow
}

# Test build
Write-Host ""
Write-Host "🔨 Testing build with new key..." -ForegroundColor Cyan
node scripts/generate-firebase-config.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build configuration generated successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Build configuration failed" -ForegroundColor Red
    exit 1
}

# Update Vercel (requires manual confirmation)
Write-Host ""
Write-Host "☁️  Next: Update Vercel environment variables" -ForegroundColor Cyan
Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  vercel env rm VITE_FIREBASE_API_KEY production" -ForegroundColor White
Write-Host "  vercel env add VITE_FIREBASE_API_KEY production" -ForegroundColor White
Write-Host "  # (Paste: $newApiKey)" -ForegroundColor Gray
Write-Host ""

$updateVercel = Read-Host "Update Vercel now? (y/n)"
if ($updateVercel -eq "y" -or $updateVercel -eq "Y") {
    Write-Host "Removing old key from Vercel..." -ForegroundColor Cyan
    vercel env rm VITE_FIREBASE_API_KEY production
    
    Write-Host "Adding new key to Vercel..." -ForegroundColor Cyan
    Write-Host "(Paste the key when prompted)" -ForegroundColor Yellow
    vercel env add VITE_FIREBASE_API_KEY production
}

# Revoke old key reminder
Write-Host ""
Write-Host "⚠️  CRITICAL: Revoke the OLD key" -ForegroundColor Red
Write-Host "1. Go to: https://console.cloud.google.com/apis/credentials" -ForegroundColor Yellow
Write-Host "2. Find: AIzaSyDHYxqQD4ZoVlgTy2XUhsVpf7GOz3N4qAI" -ForegroundColor Yellow
Write-Host "3. Click DELETE" -ForegroundColor Yellow
Write-Host ""

$revokedOld = Read-Host "Have you revoked the old key? (y/n)"
if ($revokedOld -ne "y" -and $revokedOld -ne "Y") {
    Write-Host "⚠️  Don't forget to revoke it: https://console.cloud.google.com/apis/credentials" -ForegroundColor Red
}

# Deploy
Write-Host ""
Write-Host "🚀 Ready to deploy?" -ForegroundColor Cyan
$deploy = Read-Host "Deploy to production now? (y/n)"
if ($deploy -eq "y" -or $deploy -eq "Y") {
    Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
    vercel deploy --prod
}

Write-Host ""
Write-Host "✅ Key rotation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Checklist:" -ForegroundColor Cyan
Write-Host "  [✓] New key in .env" -ForegroundColor Green
Write-Host "  [?] New key in Vercel (verify above)" -ForegroundColor Yellow
Write-Host "  [?] Old key revoked in Google Cloud" -ForegroundColor Yellow
Write-Host "  [?] Production deployed" -ForegroundColor Yellow
Write-Host ""
