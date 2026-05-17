$ErrorActionPreference = "Continue"
$projectPath = "C:\Users\User\Downloads\jarvis.html"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   A.L.M.A. OMNI-BRAIN - SISTEMA COMPLETO" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$hermesRunning = $true
$jarvisRunning = $true

function Test-Service {
    param($Port, $Path)
    try {
        $test = Invoke-WebRequest -Uri "http://localhost:$Port$Path" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        return $true
    } catch { return $false }
}

while ($true) {
    if ($hermesRunning) {
        Write-Host "[HERMES] Starting..."
        $hProc = Start-Process -FilePath "python" -ArgumentList "jarvis\automation\hermes_server.py" -WorkingDirectory $projectPath -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 4

        if (Test-Service -Port 3001 -Path "/api/hermes/status") {
            Write-Host "[HERMES] ONLINE on port 3001" -ForegroundColor Green
            $hermesRunning = $true
        } else {
            Write-Host "[HERMES] Failed to start, retrying..." -ForegroundColor Yellow
            $hermesRunning = $false
        }
    }

    if ($jarvisRunning) {
        Write-Host "[ALMA] Starting..."
        $jProc = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $projectPath -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 5

        if (Test-Service -Port 3000 -Path "/") {
            Write-Host "[ALMA] ONLINE on port 3000" -ForegroundColor Green
            $jarvisRunning = $true
        } else {
            Write-Host "[ALMA] Failed to start, retrying..." -ForegroundColor Yellow
            $jarvisRunning = $false
        }
    }

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "   SISTEMA ONLINE - CONTROLE VIA TELEGRAM" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "Hermes: http://localhost:3001"
    Write-Host "Alma: http://localhost:3000"
    Write-Host "Telegram: Send commands to your bot!"
    Write-Host ""

    $loop = 0
    while ($loop -lt 20) {
        Start-Sleep -Seconds 15
        $loop++

        if ($hProc.HasExited) { $hermesRunning = $false }
        if ($jProc.HasExited) { $jarvisRunning = $false }

        if (-not $hermesRunning -or -not $jarvisRunning) { break }
    }

    if (-not $hermesRunning) { Write-Host "[RESTART] Hermes restarting..." -ForegroundColor Red }
    if (-not $jarvisRunning) { Write-Host "[RESTART] Alma restarting..." -ForegroundColor Red }
}