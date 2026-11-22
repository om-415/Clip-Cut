@echo off
title AI Stream Clipper - Backend API
echo ========================================================
echo Starting AI Stream Clipper Backend API (FastAPI + Uvicorn)
echo ========================================================

cd /d D:\yt\ai-stream-clipper
set PATH=D:\tools\ffmpeg\bin;%PATH%
set MPLCONFIGDIR=D:\yt\ai-stream-clipper\temp\matplotlib
set DISABLE_SQLALCHEMY_CEXT=1

D:\yt\ai-stream-clipper\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
