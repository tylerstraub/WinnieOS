# WinnieOS Initial Setup Script
# This script sets up WinnieOS for first-time installation

param(
    [switch]$SkipServiceInstall
)

$ErrorActionPreference = "Stop"

Write-Host "=== WinnieOS Setup ===" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js before continuing:" -ForegroundColor Yellow
    Write-Host "  1. Download Node.js from: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "  2. Install the LTS (Long Term Support) version" -ForegroundColor Cyan
    Write-Host "  3. Restart PowerShell after installation" -ForegroundColor Cyan
    Write-Host "  4. Run this setup script again" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "  [OK] npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: npm is not available" -ForegroundColor Red
    Write-Host ""
    Write-Host "npm should come with Node.js. Please reinstall Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check Git
try {
    $gitVersion = git --version
    Write-Host "  [OK] Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git before continuing:" -ForegroundColor Yellow
    Write-Host "  1. Download Git from: https://git-scm.com/" -ForegroundColor Cyan
    Write-Host "  2. Or install via: winget install Git.Git (Windows 11)" -ForegroundColor Cyan
    Write-Host "  3. Restart PowerShell after installation" -ForegroundColor Cyan
    Write-Host "  4. Run this setup script again" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""

# Install npm dependencies
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install npm dependencies"
    exit 1
}
Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# Create local config if it doesn't exist
$localConfigPath = Join-Path $projectRoot "config\local.json"
if (-not (Test-Path $localConfigPath)) {
    Write-Host "Creating local configuration..." -ForegroundColor Yellow
    $exampleConfigPath = Join-Path $projectRoot "config\local.json.example"
    if (Test-Path $exampleConfigPath) {
        Copy-Item $exampleConfigPath $localConfigPath
        Write-Host "  [OK] Local config created from template" -ForegroundColor Green
        Write-Host "  Note: You can edit config\local.json to customize settings" -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] Example config not found, creating minimal config" -ForegroundColor Yellow
        $defaultConfig = @{
            server = @{
                port = 3000
                host = "localhost"
            }
        } | ConvertTo-Json -Depth 10
        $defaultConfig | Out-File -FilePath $localConfigPath -Encoding UTF8
    }
    Write-Host ""
}

# Install Windows Service (if not skipped)
if (-not $SkipServiceInstall) {
    Write-Host "Installing Windows Service..." -ForegroundColor Yellow
    Write-Host "  Note: This requires Administrator privileges" -ForegroundColor Gray
    
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Host "  [WARN] Not running as Administrator. Service installation skipped." -ForegroundColor Yellow
        Write-Host "  To install the service, run: .\scripts\install-service.ps1 install" -ForegroundColor Gray
    } else {
        # Ensure dist directory exists before installing service (service requires it)
        $distPath = Join-Path $projectRoot "dist"
        if (-not (Test-Path $distPath) -or -not (Test-Path (Join-Path $distPath "index.html"))) {
            Write-Host "  Building production bundle (required for service)..." -ForegroundColor Yellow
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  [WARN] Failed to build production bundle. Service installation skipped." -ForegroundColor Yellow
                Write-Host "  Build the project first: npm run build" -ForegroundColor Gray
                Write-Host "  Then install service: .\scripts\install-service.ps1 install" -ForegroundColor Gray
            } else {
                Write-Host "  [OK] Production bundle built" -ForegroundColor Green
            }
        }
        
        if ((Test-Path $distPath) -and (Test-Path (Join-Path $distPath "index.html"))) {
            & "$scriptDir\install-service.ps1" install
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Windows Service installed and started" -ForegroundColor Green
            } else {
                Write-Host "  [WARN] Service installation had issues. You can install it later with: .\scripts\install-service.ps1 install" -ForegroundColor Yellow
            }
        }
    }
    Write-Host ""
}

Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit config\local.json to customize settings (kiosk user, startup options, etc.)" -ForegroundColor Gray
Write-Host "  2. Test the server: npm start" -ForegroundColor Gray
Write-Host "  3. The Windows Service will automatically start on system boot and handle updates" -ForegroundColor Gray
Write-Host ""
