@echo off
title LitSeeker - Capstone Literature Review Studio
cd /d "%~dp0"
echo ========================================================
echo   LitSeeker - Capstone Chapter 2 Literature Studio
echo ========================================================
echo.
echo Starting server on http://localhost:3005 ...
echo Press Ctrl+C in this window to stop the server anytime.
echo.
start http://localhost:3005
node server.js
pause
