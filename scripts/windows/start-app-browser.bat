@echo off
setlocal
cd /d "%~dp0\..\.."
start "UAV Dispatch Launcher + Browser" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1" -OpenBrowser %*
