# Setup Task Scheduler to run WinnieOS on startup
# This script creates a Windows Task Scheduler task that runs start.ps1 on system boot

param(
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator. Please right-click and select 'Run as Administrator'"
    exit 1
}

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$startScriptPath = Join-Path $projectRoot "scripts\start.ps1"

# Task details
$taskName = "WinnieOS Startup"
$taskDescription = "Starts WinnieOS on system boot: pulls updates, starts service, launches browser"

if ($Remove) {
    Write-Host "Removing Task Scheduler task..." -ForegroundColor Yellow
    
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "  [OK] Task removed successfully" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Task not found, nothing to remove" -ForegroundColor Yellow
    }
    exit 0
}

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove and recreate it? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "  [OK] Existing task removed" -ForegroundColor Green
    } else {
        Write-Host "Exiting. Use -Remove parameter to remove the task." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Creating Task Scheduler task..." -ForegroundColor Yellow
Write-Host "  Task Name: $taskName" -ForegroundColor Gray
Write-Host "  Script: $startScriptPath" -ForegroundColor Gray
Write-Host ""

# Create the action (run PowerShell script)
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$startScriptPath`"" `
    -WorkingDirectory $projectRoot

# Create the trigger (on system startup)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Create the principal (run with highest privileges)
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description $taskDescription `
        -Force | Out-Null
    
    Write-Host "  [OK] Task created successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Configuration:" -ForegroundColor Cyan
    Write-Host "  - Name: $taskName" -ForegroundColor Gray
    Write-Host "  - Trigger: At system startup" -ForegroundColor Gray
    Write-Host "  - Runs: $startScriptPath" -ForegroundColor Gray
    Write-Host "  - User: $env:USERDOMAIN\$env:USERNAME" -ForegroundColor Gray
    Write-Host "  - Run Level: Highest (Administrator)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To verify the task:" -ForegroundColor Cyan
    Write-Host "  Get-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To test the task manually:" -ForegroundColor Cyan
    Write-Host "  Start-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To remove the task:" -ForegroundColor Cyan
    Write-Host "  .\scripts\setup-task-scheduler.ps1 -Remove" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Error "Failed to create task: $_"
    exit 1
}
