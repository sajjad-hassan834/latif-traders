@echo off
title Latif Traders - POS & ERP System
color 0b

echo ========================================================
echo         LATIF TRADERS - POS & INVENTORY SYSTEM
echo             Running 100%% Free Local Mode
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not installed on this laptop!
    echo Please download and install Node.js (LTS version) from:
    echo https://nodejs.org
    echo.
    pause
    exit /b
)

:: Navigate to script directory
cd /d "%~dp0"

:: Check if client is built
if not exist "client\dist\index.html" (
    echo Building frontend application for the first time...
    call npm run build
    echo Frontend built successfully!
    echo.
)

:: Launch Server and open Browser
echo Starting Latif Traders local server...
echo Server running at http://localhost:5000
echo.
echo Opening system in your browser...
start http://localhost:5000

:: Start server
node server/index.js
pause
