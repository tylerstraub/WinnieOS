# WinnieOS Service Restart Script
# Simple script to restart the Windows Service (useful for manual restarts)

param(
    [switch]$NoElevate = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=== Restarting WinnieOS Service ===" -ForegroundColor Cyan

function Test-IsAdmin {
    try {
        $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

function Relaunch-Elevated {
    param(
        [string]$ScriptPath,
        [hashtable]$BoundParams
    )

    $argList = @("-ExecutionPolicy", "Bypass", "-File", $ScriptPath)
    foreach ($key in $BoundParams.Keys) {
        $val = $BoundParams[$key]
        if ($val -is [System.Management.Automation.SwitchParameter]) {
            if ($val.IsPresent) { $argList += "-$key" }
        } elseif ($null -ne $val -and "$val" -ne "") {
            $argList += "-$key"
            $argList += "$val"
        }
    }

    Write-Host "Re-launching with Administrator privileges (UAC prompt)..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argList | Out-Null
    exit 0
}

# Restarting the Windows service requires admin privileges
# Auto-elevate if not running as admin
if (-not $NoElevate -and -not (Test-IsAdmin)) {
    Relaunch-Elevated -ScriptPath (Join-Path $PSScriptRoot "restart-service.ps1") -BoundParams $PSBoundParameters
}

# Service name
$serviceName = "WinnieOS Server"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if (-not $service) {
    Write-Error "Service '$serviceName' not found. Install the service with: .\scripts\install-service.ps1 install"
    exit 1
}

# Stop service if running
if ($service.Status -eq "Running") {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Host "  [OK] Service stopped" -ForegroundColor Green
    } catch {
        Write-Error "Failed to stop service: $_"
        exit 1
    }
} else {
    Write-Host "Service is not running" -ForegroundColor Gray
}

# Start service
Write-Host "Starting service..." -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    # Verify service is running
    try {
        $service.Refresh()
        if ($service.Status -eq "Running") {
            Write-Host "  [OK] Service started successfully" -ForegroundColor Green
        } else {
            Write-Warning "Service started but status is: $($service.Status)"
        }
    } catch {
        Write-Warning "Could not verify service status: $_"
    }
} catch {
    Write-Error "Failed to start service: $_"
    exit 1
}

Write-Host ""
Write-Host "=== Service Restarted ===" -ForegroundColor Green
Write-Host ""
Write-Host "Note: The service will automatically perform git pull, build (if needed), and start the server." -ForegroundColor Gray
Write-Host "Check logs at logs\winnieos.log for details." -ForegroundColor Gray

