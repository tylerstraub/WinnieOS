# WinnieOS Dev Server Stop Script
# Gracefully stops the Vite dev server

$ErrorActionPreference = "Continue"

Write-Host "=== Stopping WinnieOS Dev Server ===" -ForegroundColor Cyan

# Find Vite dev server process
$viteProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    $cmdLine -like '*vite*' -and $cmdLine -like '*bin\vite.js*'
} | Select-Object -First 1

if (-not $viteProcess) {
    Write-Host "  [INFO] No Vite dev server process found" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found Vite process (PID: $($viteProcess.Id))" -ForegroundColor Yellow

# Try graceful shutdown first (send SIGINT equivalent)
Write-Host "Attempting graceful shutdown..." -ForegroundColor Yellow
try {
    # On Windows, we can use Stop-Process without -Force to send a close signal
    # This allows the process to handle cleanup
    Stop-Process -Id $viteProcess.Id -ErrorAction Stop
    Start-Sleep -Milliseconds 500
    
    # Check if process is still running
    $stillRunning = Get-Process -Id $viteProcess.Id -ErrorAction SilentlyContinue
    if ($stillRunning) {
        Write-Host "  [WARN] Process did not exit gracefully, forcing termination..." -ForegroundColor Yellow
        Stop-Process -Id $viteProcess.Id -Force
    } else {
        Write-Host "  [OK] Dev server stopped gracefully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Failed to stop process: $_" -ForegroundColor Red
    exit 1
}

