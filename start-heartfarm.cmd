@echo off
cd /d "%~dp0"
start "" powershell -ExecutionPolicy Bypass -File "%~dp0start-heartfarm.ps1"
