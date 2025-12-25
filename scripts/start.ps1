# WinnieOS Startup Script
# This script runs on system startup: pulls updates, ensures service is running, launches browser

param(
    [string]$ChromiumPath = "",
    [string]$Url = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Starting WinnieOS ===" -ForegroundColor Cyan

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

# Load local config for Chromium path if not provided
if ([string]::IsNullOrEmpty($ChromiumPath)) {
    $localConfigPath = Join-Path $projectRoot "config\local.json"
    if (Test-Path $localConfigPath) {
        try {
            $localConfig = Get-Content $localConfigPath | ConvertFrom-Json
            if ($localConfig.chromium -and $localConfig.chromium.path) {
                $ChromiumPath = $localConfig.chromium.path
            }
        } catch {
            Write-Warning "Could not parse local config: $_"
        }
    }
}

# Try to find Chromium/Chrome if not configured
if ([string]::IsNullOrEmpty($ChromiumPath)) {
    $possiblePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles}\Chromium\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Chromium\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $ChromiumPath = $path
            Write-Host "Found browser at: $ChromiumPath" -ForegroundColor Green
            break
        }
    }
}

if ([string]::IsNullOrEmpty($ChromiumPath) -or -not (Test-Path $ChromiumPath)) {
    Write-Error "Chromium/Chrome not found. Please set the path in config\local.json or provide -ChromiumPath parameter"
    exit 1
}

# Pull latest updates from Git
Write-Host "Updating from repository..." -ForegroundColor Yellow
try {
    # Check if we're in a git repository
    $gitCheck = git rev-parse --git-dir 2>&1
    if ($LASTEXITCODE -eq 0) {
        # Check if remote is configured
        $remoteCheck = git remote get-url origin 2>&1
        if ($LASTEXITCODE -eq 0) {
            # Get current branch name
            $branch = git rev-parse --abbrev-ref HEAD
            if ($branch) {
                git fetch --all
                git reset --hard "origin/$branch"
                Write-Host "  [OK] Repository updated (branch: $branch)" -ForegroundColor Green
            } else {
                Write-Warning "Could not determine current branch"
                Write-Host "  Continuing with existing code..." -ForegroundColor Yellow
            }
        } else {
            Write-Warning "Git remote 'origin' not configured. Skipping update."
            Write-Host "  Continuing with existing code..." -ForegroundColor Yellow
        }
    } else {
        Write-Warning "Not a git repository. Skipping update."
        Write-Host "  Continuing with existing code..." -ForegroundColor Yellow
    }
} catch {
    Write-Warning "Git update failed: $_"
    Write-Host "  Continuing with existing code..." -ForegroundColor Yellow
}

# Install/update npm dependencies if package.json changed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Dependencies up to date" -ForegroundColor Green
}

# Ensure dist directory exists (should be committed, but rebuild if missing as safety measure)
$distPath = Join-Path $projectRoot "dist"
if (-not (Test-Path $distPath) -or -not (Test-Path (Join-Path $distPath "index.html"))) {
    Write-Host "Building production bundle..." -ForegroundColor Yellow
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Production bundle built" -ForegroundColor Green
    } else {
        Write-Error "Failed to build production bundle. Please check errors above."
        exit 1
    }
} else {
    Write-Host "  [OK] Production bundle exists" -ForegroundColor Green
}

# Ensure Windows Service is running
Write-Host "Checking service status..." -ForegroundColor Yellow
$serviceName = "WinnieOS Server"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -ne "Running") {
        Write-Host "  Starting service..." -ForegroundColor Yellow
        Start-Service -Name $serviceName
        Start-Sleep -Seconds 2
    }
    Write-Host "  [OK] Service is running" -ForegroundColor Green
} else {
    Write-Warning "Service '$serviceName' not found. The server may not be running."
    Write-Host "  Install the service with: .\scripts\install-service.ps1 install" -ForegroundColor Yellow
}

# Wait for server to be ready
Write-Host "Waiting for server to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        $serverReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
        $attempt++
    }
}

if (-not $serverReady) {
    Write-Error "Server did not become ready in time. Check logs at logs\winnieos.log"
    exit 1
}

Write-Host "  [OK] Server is ready" -ForegroundColor Green

# Launch Chromium in kiosk mode
Write-Host "Launching browser in kiosk mode..." -ForegroundColor Yellow
Start-Process -FilePath $ChromiumPath -ArgumentList @(
    "--kiosk",
    "--no-first-run",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--disable-restore-session-state",
    "--disable-translate",
    "--overscroll-history-navigation=0",
    $Url
)

Write-Host "  [OK] Browser launched" -ForegroundColor Green
Write-Host ""
Write-Host "=== WinnieOS Started ===" -ForegroundColor Green
