@echo off
setlocal enabledelayedexpansion
title ClipCut - Production Launcher

echo ==============================================================================
echo       CLIPCUT - AUTONOMOUS AI VIDEO CLIPPING & SHORTS STUDIO
echo ==============================================================================
echo.

cd /d "%~dp0"

:: 1. Check Python Virtual Environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv.
    echo Please create it first: python -m venv .venv ^&^& .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

:: 2. Check Node & Frontend
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

:: 3. Build Frontend Production Bundle if not built
if not exist "frontend\dist\index.html" (
    echo [INFO] Building optimized frontend bundle...
    cd frontend && npm run build && cd ..
)

:: 4. Ensure Directory Structure
if not exist "clips" mkdir clips
if not exist "downloads" mkdir downloads
if not exist "models" mkdir models
if not exist "processed" mkdir processed
if not exist "subtitles" mkdir subtitles
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs

:: 5. Launch Backend in Background
echo [1/2] Starting FastAPI Backend on http://localhost:8000...
start "ClipCut Backend API" /min cmd /c "cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

:: 6. Launch Frontend Preview Server
echo [2/2] Starting Frontend Studio on http://localhost:3000...
start "ClipCut Frontend Studio" /min cmd /c "cd /d "%~dp0\frontend" && npm run preview -- --port 3000 --host 127.0.0.1"

:: 7. Wait and Open Browser
timeout /t 3 /nobreak >nul
echo.
echo Application successfully running!
echo Studio Interface: http://localhost:3000
echo Backend API Docs: http://localhost:8000/docs
echo.
start http://localhost:3000

echo Press any key to shutdown all servers...
pause >nul

echo Stopping services...
taskkill /f /im uvicorn.exe 2>nul
taskkill /f /im node.exe 2>nul
echo All services stopped cleanly.
