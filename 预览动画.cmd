@echo off
cd /d "%~dp0"
call npm run preview
if errorlevel 1 pause
