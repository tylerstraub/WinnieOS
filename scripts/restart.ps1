# WinnieOS Remote Restart Script
# This script stops everything, updates, and restarts (useful for remote SSH access)
#
# Note: Helper functions (Test-IsAdmin, Relaunch-Elevated) are duplicated from start.ps1
# to avoid shared module dependencies. This is intentional for standalone script execution.

param(
    [string]$ChromiumPath = "",
    [string]$Url = "http://localhost:3000",
    [switch]$NoElevate = $false,
    [switch]$ContinueWithoutServiceRestart = $false,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=== Restarting WinnieOS ===" -ForegroundColor Cyan

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

    $args = @("-ExecutionPolicy", "Bypass", "-File", $ScriptPath)
    foreach ($key in $BoundParams.Keys) {
        $val = $BoundParams[$key]
        if ($val -is [System.Management.Automation.SwitchParameter]) {
            if ($val.IsPresent) { $args += "-$key" }
        } elseif ($null -ne $val -and "$val" -ne "") {
            $args += "-$key"
            $args += "$val"
        }
    }

    Write-Host "Re-launching with Administrator privileges (UAC prompt)..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $args | Out-Null
    exit 0
}

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

# Restarting the Windows service requires admin by default.
# Auto-elevate so we don't appear to "restart" but keep running the old service.
if (-not $NoElevate -and -not (Test-IsAdmin)) {
    Relaunch-Elevated -ScriptPath (Join-Path $scriptDir "restart.ps1") -BoundParams $PSBoundParameters
}

# Stop Chromium processes
Write-Host "Stopping browser processes..." -ForegroundColor Yellow
$chromiumProcesses = Get-Process -Name "chrome","msedge","chromium" -ErrorAction SilentlyContinue
if ($chromiumProcesses) {
    $chromiumProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  [OK] Browser processes stopped" -ForegroundColor Green
} else {
    Write-Host "  [OK] No browser processes found" -ForegroundColor Green
}

# Stop Windows Service
$serviceName = "WinnieOS Server"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName
    Start-Sleep -Seconds 2
    Write-Host "  [OK] Service stopped" -ForegroundColor Green
}

# Now delegate to start.ps1 which will do git pull, restart service, and launch browser
Write-Host ""
& "$scriptDir\start.ps1" -ChromiumPath $ChromiumPath -Url $Url -SkipBuild:$SkipBuild -NoElevate:$NoElevate -ContinueWithoutServiceRestart:$ContinueWithoutServiceRestart
