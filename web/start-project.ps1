# Revamped Niche Community Platform Startup Script
Write-Host "Starting Revamped Niche Community Platform..." -ForegroundColor Green

# Set the working directory
Set-Location $PSScriptRoot

# Kill any existing processes on ports 4000 and 5173-5175
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
$processesToKill = Get-NetTCPConnection -LocalPort 4000,5173,5174,5175 -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
$processesToKill | ForEach-Object { 
    Write-Host "Stopping process $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Wait a moment for ports to be released
Start-Sleep -Seconds 2

# Start Socket.io server in background
Write-Host "Starting Socket.io server on port 4000..." -ForegroundColor Cyan
$socketJob = Start-Job -Name "SocketServer" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    $env:CLIENT_ORIGIN = "http://localhost:5173"
    npm run socket:dev 2>&1
}

# Wait for server to start
Start-Sleep -Seconds 3

# Start React web application
Write-Host "Starting React web application..." -ForegroundColor Cyan
$webJob = Start-Job -Name "WebApp" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run dev 2>&1
}

# Wait for web app to start
Start-Sleep -Seconds 5

# Display status
Write-Host "`n=== PROJECT STATUS ===" -ForegroundColor Green
Write-Host "Socket.io Server: " -NoNewline -ForegroundColor White
if (Get-Job -Name "SocketServer" | Where-Object { $_.State -eq "Running" }) {
    Write-Host "RUNNING" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
}

Write-Host "React Web App: " -NoNewline -ForegroundColor White
if (Get-Job -Name "WebApp" | Where-Object { $_.State -eq "Running" }) {
    Write-Host "RUNNING" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
}

# Test Socket.io server
Write-Host "`nTesting Socket.io server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Socket.io server is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Socket.io server test failed" -ForegroundColor Red
}

Write-Host "`n=== USAGE INSTRUCTIONS ===" -ForegroundColor Green
Write-Host "🌐 Web Application: " -NoNewline -ForegroundColor White
Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔌 Socket.io Server: " -NoNewline -ForegroundColor White  
Write-Host "http://localhost:4000" -ForegroundColor Cyan
Write-Host "`n📋 View logs:" -ForegroundColor White
Write-Host "   Socket.io: Get-Job -Name 'SocketServer' | Receive-Job" -ForegroundColor Gray
Write-Host "   Web App:   Get-Job -Name 'WebApp' | Receive-Job" -ForegroundColor Gray
Write-Host "`n🛑 Stop services:" -ForegroundColor White
Write-Host "   Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Gray

# Keep script running and show logs
Write-Host "`n=== LIVE LOGS (Press Ctrl+C to stop) ===" -ForegroundColor Green
try {
    while ($true) {
        $socketLogs = Receive-Job -Name "SocketServer" -Keep
        $webLogs = Receive-Job -Name "WebApp" -Keep
        
        if ($socketLogs) {
            Write-Host "[SOCKET] " -NoNewline -ForegroundColor Blue
            Write-Host $socketLogs[-1] -ForegroundColor White
        }
        
        if ($webLogs) {
            Write-Host "[WEB] " -NoNewline -ForegroundColor Magenta
            Write-Host $webLogs[-1] -ForegroundColor White
        }
        
        Start-Sleep -Seconds 2
    }
} catch {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
} finally {
    Write-Host "Stopping all services..." -ForegroundColor Red
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "All services stopped." -ForegroundColor Green
}