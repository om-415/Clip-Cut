@echo off
title AI Stream Clipper - Launcher
echo ========================================================
echo Launching AI Stream Clipper (Backend + Frontend)
echo ========================================================

echo [1/2] Starting Backend API in separate window...
start "AI Stream Clipper - Backend API" cmd /c "D:\yt\ai-stream-clipper\scripts\start_backend.bat"

echo Waiting 3 seconds for Backend to initialize...
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend UI in separate window...
start "AI Stream Clipper - Frontend Dashboard" cmd /c "D:\yt\ai-stream-clipper\scripts\start_frontend.bat"

echo.
echo ========================================================
echo Both servers have been launched!
echo - Frontend Dashboard: http://localhost:3000
echo - Backend API Docs:   http://127.0.0.1:8000/docs
echo ========================================================
echo You can minimize this window.
pause
