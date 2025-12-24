# WinnieOS Remote Restart Script
# This script stops everything, updates, and restarts (useful for remote SSH access)

param(
    [string]$ChromiumPath = "",
    [string]$Url = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Restarting WinnieOS ===" -ForegroundColor Cyan

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

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
& "$scriptDir\start.ps1" -ChromiumPath $ChromiumPath -Url $Url
