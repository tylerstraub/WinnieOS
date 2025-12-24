# Debug script for WinnieOS startup issues
# This script helps diagnose why the startup sequence might not be working

Write-Host "=== WinnieOS Startup Debug ===" -ForegroundColor Cyan
Write-Host ""

# Get project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

# 1. Check Task Scheduler task
Write-Host "1. Checking Task Scheduler task..." -ForegroundColor Yellow
$taskName = "WinnieOS Startup"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($task) {
    Write-Host "   [OK] Task exists" -ForegroundColor Green
    Write-Host "   State: $($task.State)" -ForegroundColor Gray
    Write-Host "   Enabled: $($task.Settings.Enabled)" -ForegroundColor Gray
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "   Last Run: $($taskInfo.LastRunTime)" -ForegroundColor Gray
    Write-Host "   Last Result: $($taskInfo.LastTaskResult)" -ForegroundColor Gray
    Write-Host "   Missed Runs: $($taskInfo.NumberOfMissedRuns)" -ForegroundColor Gray
    
    if ($taskInfo.LastTaskResult -ne 0 -and $taskInfo.LastTaskResult -ne $null) {
        Write-Host "   [WARN] Last run had error code: $($taskInfo.LastTaskResult)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ERROR] Task not found!" -ForegroundColor Red
}

Write-Host ""

# 2. Check Windows Service
Write-Host "2. Checking Windows Service..." -ForegroundColor Yellow
$serviceName = "WinnieOS Server"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "   [OK] Service exists" -ForegroundColor Green
    Write-Host "   Status: $($service.Status)" -ForegroundColor Gray
    Write-Host "   StartType: $($service.StartType)" -ForegroundColor Gray
} else {
    Write-Host "   [ERROR] Service not found!" -ForegroundColor Red
}

Write-Host ""

# 3. Check if server is responding
Write-Host "3. Checking server response..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "   [OK] Server is responding (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Server not responding: $_" -ForegroundColor Red
}

Write-Host ""

# 4. Check recent logs
Write-Host "4. Checking recent logs..." -ForegroundColor Yellow
$logPath = Join-Path $projectRoot "logs\winnieos.log"
if (Test-Path $logPath) {
    Write-Host "   [OK] Log file exists" -ForegroundColor Green
    $logLines = Get-Content $logPath -Tail 10 -ErrorAction SilentlyContinue
    if ($logLines) {
        Write-Host "   Last 10 log entries:" -ForegroundColor Gray
        $logLines | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    } else {
        Write-Host "   [WARN] Log file is empty" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARN] Log file not found" -ForegroundColor Yellow
}

Write-Host ""

# 5. Check Task Scheduler event logs
Write-Host "5. Checking Task Scheduler event logs..." -ForegroundColor Yellow
try {
    $events = Get-WinEvent -FilterHashtable @{
        LogName = 'Microsoft-Windows-TaskScheduler/Operational'
        ID = 200, 201, 202, 203, 204, 400, 401, 402
    } -MaxEvents 20 -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*WinnieOS*" }
    
    if ($events) {
        Write-Host "   Found recent Task Scheduler events:" -ForegroundColor Gray
        $events | Select-Object -First 5 | ForEach-Object {
            $message = $_.Message -replace "`r`n", " " -replace "`r", " " -replace "`n", " "
            Write-Host "     [$($_.TimeCreated)] $($_.Id): $message" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [INFO] No recent Task Scheduler events found for WinnieOS" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [WARN] Could not read Task Scheduler events: $_" -ForegroundColor Yellow
}

Write-Host ""

# 6. Check if browser processes are running
Write-Host "6. Checking browser processes..." -ForegroundColor Yellow
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

# 7. Check Chromium path configuration
Write-Host "7. Checking Chromium configuration..." -ForegroundColor Yellow
$localConfigPath = Join-Path $projectRoot "config\local.json"
if (Test-Path $localConfigPath) {
    try {
        $config = Get-Content $localConfigPath | ConvertFrom-Json
        if ($config.chromium -and $config.chromium.path) {
            $chromiumPath = $config.chromium.path
            Write-Host "   Configured path: $chromiumPath" -ForegroundColor Gray
            if (Test-Path $chromiumPath) {
                Write-Host "   [OK] Path exists" -ForegroundColor Green
            } else {
                Write-Host "   [ERROR] Path does not exist!" -ForegroundColor Red
            }
        } else {
            Write-Host "   [INFO] No Chromium path configured (will auto-detect)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   [WARN] Could not parse config: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARN] Local config not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Debug Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  - Check Task Scheduler History tab for detailed error messages" -ForegroundColor Gray
Write-Host "  - Review logs: Get-Content logs\winnieos.log -Tail 50" -ForegroundColor Gray
Write-Host "  - Test task manually: Start-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor Gray
Write-Host ""

