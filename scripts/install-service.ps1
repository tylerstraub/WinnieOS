# Install/Uninstall WinnieOS Windows Service
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall")]
    [string]$Action
)

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator. Please right-click and select 'Run as Administrator'"
    exit 1
}

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js first."
    exit 1
}

# Change to project directory
Set-Location $projectRoot

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install npm dependencies"
        exit 1
    }
}

# For install action, ensure dist directory exists (service requires it)
if ($Action -eq "install") {
    $distPath = Join-Path $projectRoot "dist"
    if (-not (Test-Path $distPath) -or -not (Test-Path (Join-Path $distPath "index.html"))) {
        Write-Host "Building production bundle (required for service)..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build production bundle. Service requires dist/ directory to exist."
            exit 1
        }
        Write-Host "  [OK] Production bundle built" -ForegroundColor Green
    }
}

# For uninstall action, stop the service first (if running) for clean removal
if ($Action -eq "uninstall") {
    $serviceName = "WinnieOS Server"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Host "Stopping service before uninstall..." -ForegroundColor Yellow
            Stop-Service -Name $serviceName -Force
            Start-Sleep -Seconds 2
            Write-Host "  [OK] Service stopped" -ForegroundColor Green
        } else {
            Write-Host "Service is already stopped" -ForegroundColor Gray
        }
    }
}

# Run the Node.js installer script
Write-Host "Running service $Action..." -ForegroundColor Yellow
node "$scriptDir\install-service.js" $Action

if ($LASTEXITCODE -ne 0) {
    Write-Error "Service $Action failed"
    exit 1
}

Write-Host "Service $Action completed successfully" -ForegroundColor Green
