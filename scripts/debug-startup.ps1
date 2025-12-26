# Debug script for WinnieOS startup issues
# This script helps diagnose why the service startup might not be working

Write-Host "=== WinnieOS Service Debug ===" -ForegroundColor Cyan
Write-Host ""

# Get project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

# 1. Check Windows Service
Write-Host "1. Checking Windows Service..." -ForegroundColor Yellow
$serviceName = "WinnieOS Server"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "   [OK] Service exists" -ForegroundColor Green
    Write-Host "   Status: $($service.Status)" -ForegroundColor Gray
    Write-Host "   StartType: $($service.StartType)" -ForegroundColor Gray
    
    if ($service.StartType -ne "Automatic") {
        Write-Host "   [WARN] Service StartType is not Automatic. Service may not start on boot." -ForegroundColor Yellow
    }
    
    # Get service details
    $serviceDetails = Get-WmiObject Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($serviceDetails) {
        Write-Host "   Account: $($serviceDetails.StartName)" -ForegroundColor Gray
        Write-Host "   Path: $($serviceDetails.PathName)" -ForegroundColor Gray
    }
} else {
    Write-Host "   [ERROR] Service not found!" -ForegroundColor Red
    Write-Host "   Install the service with: .\scripts\install-service.ps1 install" -ForegroundColor Yellow
}

Write-Host ""

# 2. Check if server is responding
Write-Host "2. Checking server response..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "   [OK] Server is responding (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Server not responding: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Check recent logs
Write-Host "3. Checking recent logs..." -ForegroundColor Yellow
$logPath = Join-Path $projectRoot "logs\winnieos.log"
if (Test-Path $logPath) {
    Write-Host "   [OK] Log file exists" -ForegroundColor Green
    $logLines = Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue
    if ($logLines) {
        Write-Host "   Last 20 log entries:" -ForegroundColor Gray
        $logLines | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    } else {
        Write-Host "   [WARN] Log file is empty" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARN] Log file not found" -ForegroundColor Yellow
}

Write-Host ""

# 4. Check service startup sequence in logs
Write-Host "4. Checking service startup sequence..." -ForegroundColor Yellow
if (Test-Path $logPath) {
    $startupLogs = Get-Content $logPath -ErrorAction SilentlyContinue | Select-String -Pattern "Service Startup|git pull|npm install|Building production|Express server started" -Context 0,2
    if ($startupLogs) {
        Write-Host "   Found startup sequence entries:" -ForegroundColor Gray
        $startupLogs | Select-Object -First 10 | ForEach-Object {
            Write-Host "     $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [INFO] No startup sequence entries found in logs" -ForegroundColor Gray
    }
} else {
    Write-Host "   [WARN] Log file not found, cannot check startup sequence" -ForegroundColor Yellow
}

Write-Host ""

# 5. Check build hash file
Write-Host "5. Checking build status..." -ForegroundColor Yellow
$buildHashPath = Join-Path $projectRoot "logs\last-build-hash.txt"
if (Test-Path $buildHashPath) {
    $lastBuildHash = Get-Content $buildHashPath -ErrorAction SilentlyContinue
    Write-Host "   [OK] Last build hash: $($lastBuildHash.Substring(0, [Math]::Min(8, $lastBuildHash.Length)))..." -ForegroundColor Green
} else {
    Write-Host "   [INFO] No build hash file found (service will build on next startup)" -ForegroundColor Gray
}

# Check current git hash
try {
    $currentHash = git rev-parse HEAD 2>&1
    if ($LASTEXITCODE -eq 0) {
        $currentHashShort = $currentHash.Substring(0, [Math]::Min(8, $currentHash.Length))
        Write-Host "   Current git hash: $currentHashShort..." -ForegroundColor Gray
        if ($lastBuildHash -and $lastBuildHash -ne $currentHash) {
            Write-Host "   [INFO] Git hash changed - build will be triggered on next service start" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   [WARN] Could not determine git hash: $_" -ForegroundColor Yellow
}

Write-Host ""

# 6. Check dist directory
Write-Host "6. Checking dist directory..." -ForegroundColor Yellow
$distPath = Join-Path $projectRoot "dist"
$indexPath = Join-Path $distPath "index.html"
if (Test-Path $distPath) {
    if (Test-Path $indexPath) {
        Write-Host "   [OK] dist/ directory exists with index.html" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] dist/ directory exists but index.html is missing!" -ForegroundColor Red
    }
} else {
    Write-Host "   [ERROR] dist/ directory is missing!" -ForegroundColor Red
    Write-Host "   Service will attempt to build on next startup" -ForegroundColor Yellow
}

Write-Host ""

# 7. Check if browser processes are running
Write-Host "7. Checking browser processes..." -ForegroundColor Yellow
$browserProcesses = Get-Process -Name "chrome","msedge","chromium" -ErrorAction SilentlyContinue
if ($browserProcesses) {
    Write-Host "   [INFO] Found browser processes:" -ForegroundColor Gray
    $browserProcesses | Select-Object -First 5 | ForEach-Object {
        Write-Host "     $($_.ProcessName) (PID: $($_.Id), Started: $($_.StartTime))" -ForegroundColor Gray
    }
} else {
    Write-Host "   [INFO] No browser processes found" -ForegroundColor Gray
}

Write-Host ""

# 8. Check configuration
Write-Host "8. Checking configuration..." -ForegroundColor Yellow
$localConfigPath = Join-Path $projectRoot "config\local.json"
$defaultConfigPath = Join-Path $projectRoot "config\default.json"
if (Test-Path $defaultConfigPath) {
    Write-Host "   [OK] Default config exists" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] Default config missing!" -ForegroundColor Red
}

if (Test-Path $localConfigPath) {
    Write-Host "   [OK] Local config exists" -ForegroundColor Green
    try {
        $config = Get-Content $localConfigPath | ConvertFrom-Json
        if ($config.kiosk -and $config.kiosk.user) {
            Write-Host "   Kiosk user: $($config.kiosk.user)" -ForegroundColor Gray
        }
        if ($config.startup) {
            Write-Host "   Startup config: gitPull=$($config.startup.gitPull), buildOnChanges=$($config.startup.buildOnChanges), buildOnMissing=$($config.startup.buildOnMissing)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   [WARN] Could not parse local config: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [INFO] Local config not found (using defaults)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Debug Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  - Review logs: Get-Content logs\winnieos.log -Tail 50" -ForegroundColor Gray
Write-Host "  - Restart service: .\scripts\restart-service.ps1" -ForegroundColor Gray
Write-Host "  - Check service status: Get-Service -Name `"$serviceName`"" -ForegroundColor Gray
Write-Host ""
