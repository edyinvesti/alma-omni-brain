@echo off
cd /d %~dp0
title A.L.M.A. Omni-Brain

echo ========================================
echo    A.L.M.A. OMNI-BRAIN
echo ========================================
echo.

echo Starting Hermes (Automacao)...
start "Hermes" cmd /k "cd /d %~dp0jarvis\automation && python hermes_server.py"

timeout /t 4 /nobreak >nul

echo Starting Alma (API + Telegram)...
start "Alma" cmd /k "cd /d %~dp0 && node src\server.js"

timeout /t 6 /nobreak >nul

echo.
echo ========================================
echo    SISTEMA ONLINE!
echo ========================================
echo.
echo Acesse no navegador: http://localhost:3000
echo.
echo Telegram: Send commands to your bot
echo.
echo Keep this window open to keep system running
echo Close this window to stop the system
echo.
pause