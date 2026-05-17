@echo off
echo ============================================
echo    INICIANDO ALMA MÓDULOS LOCAIS
echo ============================================
echo.

echo [1/2] Iniciando ALMA CORE (Voz + IA)...
start "Alma-Core" cmd /k "cd %~dp0 && python jarvis\main.py"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando HERMES (Automacao)...
start "Hermes" cmd /k "cd %~dp0 && python jarvis\automation\hermes_server.py"

echo.
echo ============================================
echo    MÓDULOS INICIADOS!
echo ============================================
echo.
echo Execute separadamente para testar:
echo   - Visão: python jarvis\vision\test_vision.py
echo   - Athena: python jarvis\web_agent\agent.py
echo.
pause