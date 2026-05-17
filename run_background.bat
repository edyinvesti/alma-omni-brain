@echo off
cd /d %~dp0

echo ========================================
echo    A.L.M.A. OMNI-BRAIN - INICIANDO
echo ========================================

echo [1/3] Starting Hermes automation daemon...
start "Hermes" cmd /k "cd %~dp0jarvis\automation && python hermes_server.py"

timeout /t 5 /nobreak >nul

echo [2/3] Starting Alma API server...
start "Alma" cmd /k "cd %~dp0 && node src\server.js"

timeout /t 5 /nobreak >nul

echo [3/3] Verifying services...
powershell -command "Start-Sleep -Seconds 3; try { Invoke-WebRequest -Uri 'http://localhost:3001/api/hermes/status' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Hermes: OK' -ForegroundColor Green } catch { Write-Host 'Hermes: FAIL' -ForegroundColor Red }"
powershell -command "Start-Sleep -Seconds 3; try { Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Alma: OK' -ForegroundColor Green } catch { Write-Host 'Alma: FAIL' -ForegroundColor Red }"

echo.
echo ========================================
echo    SISTEMA ONLINE!
echo ========================================
echo.
echo Services:
echo   - Hermes: http://localhost:3001
echo   - Alma: http://localhost:3000
echo.
echo CONTROLE VIA TELEGRAM ATIVO!
echo Envie comandos para o seu bot.
echo.
echo Pressione qualquer tecla para sair (servicos continuaram rodando)
pause >nul