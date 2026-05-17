@echo off
cd /d %~dp0
:loop
start /b node src/server.js > nul 2>&1
timeout /t 5 /nobreak >nul
goto loop