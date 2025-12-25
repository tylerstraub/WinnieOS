# WinnieOS Development Kiosk Launcher
# Simple script to launch Chrome in windowed kiosk mode at 1280x800 for development testing

param(
    [string]$ChromiumPath = "",
    [string]$Url = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Launching Development Kiosk ===" -ForegroundColor Cyan

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

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

# Create temporary user data directory for clean launch
$tempProfile = Join-Path $env:TEMP "chrome-winnieos-dev"
if (-not (Test-Path $tempProfile)) {
    New-Item -ItemType Directory -Path $tempProfile | Out-Null
    Write-Host "Created temporary profile: $tempProfile" -ForegroundColor Gray
}

# Launch Chromium in windowed kiosk mode (1280x830 to account for title bar)
Write-Host "Launching browser in windowed kiosk mode (1280x800 content area)..." -ForegroundColor Yellow
Write-Host "  URL: $Url" -ForegroundColor Gray

Start-Process -FilePath $ChromiumPath -ArgumentList @(
    "--user-data-dir=$tempProfile",
    "--window-size=1280,830",
    "--window-position=0,0",
    "--app=$Url",
    "--no-first-run",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--disable-restore-session-state",
    "--disable-translate",
    "--overscroll-history-navigation=0",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process"
)

Write-Host "  [OK] Browser launched" -ForegroundColor Green
Write-Host ""
Write-Host "=== Development Kiosk Launched ===" -ForegroundColor Green

