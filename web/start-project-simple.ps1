# Revamped Niche Community Platform Startup Script
Write-Host "Starting Revamped Niche Community Platform..." -ForegroundColor Green

# Set the working directory
Set-Location $PSScriptRoot

# Clean up any existing jobs
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue

# Start Socket.io server in background
Write-Host "Starting Socket.io server on port 4000..." -ForegroundColor Cyan
$socketJob = Start-Job -Name "SocketServer" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    $env:CLIENT_ORIGIN = "http://localhost:5173"
    npm run socket:dev
}

# Wait for server to start
Start-Sleep -Seconds 4

# Start React web application
Write-Host "Starting React web application..." -ForegroundColor Cyan
$webJob = Start-Job -Name "WebApp" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run dev
}

# Wait for web app to start
Start-Sleep -Seconds 6

# Display status
Write-Host ""
Write-Host "=== PROJECT STATUS ===" -ForegroundColor Green
$socketStatus = Get-Job -Name "SocketServer" | Select-Object -ExpandProperty State
$webStatus = Get-Job -Name "WebApp" | Select-Object -ExpandProperty State

Write-Host "Socket.io Server: $socketStatus" -ForegroundColor $(if ($socketStatus -eq "Running") { "Green" } else { "Red" })
Write-Host "React Web App: $webStatus" -ForegroundColor $(if ($webStatus -eq "Running") { "Green" } else { "Red" })

# Test Socket.io server
Write-Host ""
Write-Host "Testing Socket.io server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "Socket.io server is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "Socket.io server test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== USAGE INSTRUCTIONS ===" -ForegroundColor Green
Write-Host "Web Application: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Socket.io Server: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "View logs:"
Write-Host "  Socket.io: Get-Job -Name 'SocketServer' | Receive-Job"
Write-Host "  Web App:   Get-Job -Name 'WebApp' | Receive-Job"
Write-Host ""
Write-Host "Stop services: Get-Job | Stop-Job; Get-Job | Remove-Job"
Write-Host ""
Write-Host "Project is now running! Press Ctrl+C to stop monitoring." -ForegroundColor Green

# Monitor logs
try {
    while ($true) {
        Start-Sleep -Seconds 5
        
        # Check if jobs are still running
        $jobs = Get-Job
        if ($jobs.Count -eq 0) {
            Write-Host "All jobs have stopped." -ForegroundColor Red
            break
        }
        
        # Show recent logs
        $socketLogs = Receive-Job -Name "SocketServer" -ErrorAction SilentlyContinue
        $webLogs = Receive-Job -Name "WebApp" -ErrorAction SilentlyContinue
        
        if ($socketLogs) {
            Write-Host "[SOCKET] Latest activity detected" -ForegroundColor Blue
        }
        
        if ($webLogs) {
            Write-Host "[WEB] Latest activity detected" -ForegroundColor Magenta
        }
    }
} catch {
    Write-Host "Monitoring stopped." -ForegroundColor Yellow
}