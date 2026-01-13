# Backup script for environment variables and secrets
# Run this regularly to backup critical files to cloud storage
# Usage: PowerShell -ExecutionPolicy Bypass -File scripts/backup-env.ps1

param(
  [string]$BackupPath = "$env:OneDrive\emobility-backup",
  [switch]$Help
)

if ($Help) {
  Write-Host "Backup script for emobility-staff-portal"
  Write-Host ""
  Write-Host "Usage: PowerShell -ExecutionPolicy Bypass -File scripts/backup-env.ps1"
  Write-Host ""
  Write-Host "Parameters:"
  Write-Host "  -BackupPath     Destination path (default: `$env:OneDrive\emobility-backup)"
  Write-Host "  -Help           Show this help message"
  Write-Host ""
  Write-Host "Example:"
  Write-Host "  . scripts/backup-env.ps1 -BackupPath 'D:\my-backups\emobility'"
  exit 0
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "=== emobility-staff-portal Backup ===" -ForegroundColor Cyan
Write-Host "Backup destination: $BackupPath"
Write-Host ""

# Create backup directory if it doesn't exist
if (!(Test-Path $BackupPath)) {
  New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
  Write-Host "Created backup directory" -ForegroundColor Green
}

$FilesToBackup = @(
  ".env",
  ".env.local",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts"
)

$BackedUpFiles = @()
$FailedFiles = @()

foreach ($File in $FilesToBackup) {
  $SourcePath = Join-Path $ProjectRoot $File
  
  if (Test-Path $SourcePath) {
    $DestPath = Join-Path $BackupPath $File
    Copy-Item -Path $SourcePath -Destination $DestPath -Force
    $BackedUpFiles += $File
    Write-Host "[OK] Backed up: $File" -ForegroundColor Green
  } else {
    Write-Host "[SKIP] Not found: $File" -ForegroundColor Yellow
    $FailedFiles += $File
  }
}

Write-Host ""
Write-Host "=== Backup Complete ===" -ForegroundColor Cyan
Write-Host "Files backed up: $($BackedUpFiles.Count)" -ForegroundColor Green
if ($FailedFiles.Count -gt 0) {
  Write-Host "Files missing: $($FailedFiles.Count)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "IMPORTANT: Add Firebase Service Account JSON if needed:" -ForegroundColor Yellow
Write-Host "   Copy your Firebase service account JSON to:"
Write-Host "   $BackupPath\firebase-service-account.json"
Write-Host ""
Write-Host "REMINDER: These files contain secrets!" -ForegroundColor Cyan
Write-Host "   - Keep backup folder encrypted or restricted access"
Write-Host "   - Never commit sensitive data to Git"
Write-Host "   - Review .gitignore to verify secrets are excluded"
