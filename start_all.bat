@echo off
echo ============================================
echo    INICIANDO EDYINVESTI ECOSYSTEM
echo ============================================
echo.

echo [1/2] Iniciando Hermes (Automacao)...
start "Hermes" cmd /k "cd %~dp0jarvis\automation && python hermes_server.py"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Alma (API)...
start "Alma" cmd /k "cd %~dp0 && npm start"

echo.
echo ============================================
echo    SISTEMA INICIADO!
echo ============================================
echo.
echo Acesse: http://localhost:3000/edyinvesti.html
echo.
pause