@echo off
setlocal
cd /d "%~dp0\..\.."
start "UAV Dispatch Launcher" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1" %*
