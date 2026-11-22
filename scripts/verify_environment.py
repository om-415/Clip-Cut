"""
Comprehensive Environment and Dependency Verification Script
"""

import sys
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

def verify_all():
    print("=" * 70)
    print("AI STREAM CLIPPER: SYSTEM & DEPENDENCY VERIFICATION AUDIT")
    print("=" * 70)

    # 1. Python & Environment
    print(f"\n[1] Python Runtime: {sys.version.split()[0]} ({sys.executable})")
    assert sys.version_info >= (3, 10), "Python 3.10+ required"

    # 2. FFmpeg & FFprobe
    ffmpeg = shutil.which("ffmpeg") or r"D:\tools\ffmpeg\bin\ffmpeg.exe"
    ffprobe = shutil.which("ffprobe") or r"D:\tools\ffmpeg\bin\ffprobe.exe"
    print(f"[2] FFmpeg: {ffmpeg}")
    print(f"    FFprobe: {ffprobe}")
    res = subprocess.run([ffmpeg, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert res.returncode == 0, "FFmpeg failed"
    print(f"    Version: {res.stdout.splitlines()[0]}")

    # 3. PyTorch & CUDA check
    import torch
    import torchvision
    print(f"[3] PyTorch: {torch.__version__} (CUDA Available: {torch.cuda.is_available()})")
    print(f"    Torchvision: {torchvision.__version__}")

    # 4. Computer Vision (OpenCV & MediaPipe)
    import cv2
    import mediapipe as mp
    print(f"[4] OpenCV: {cv2.__version__}")
    print(f"    MediaPipe: {mp.__version__} (Solutions: {hasattr(mp, 'solutions')})")

    # 5. Speech Recognition & NLP (Whisper & Transformers)
    import whisper
    import transformers
    print(f"[5] OpenAI Whisper: {whisper.__version__}")
    print(f"    Transformers: {transformers.__version__}")

    # 6. Audio Processing (Librosa & Soundfile)
    import soundfile as sf
    import librosa
    print(f"[6] Librosa: {librosa.__version__}")
    print(f"    SoundFile: {sf.__version__}")

    # 7. Backend Framework
    import fastapi
    import uvicorn
    import pydantic
    import sqlalchemy
    print(f"[7] FastAPI: {fastapi.__version__}")
    print(f"    Uvicorn: {uvicorn.__version__}")
    print(f"    Pydantic: {pydantic.__version__}")
    print(f"    SQLAlchemy: {sqlalchemy.__version__}")

    # 8. Video Downloader (yt-dlp)
    import yt_dlp
    print(f"[8] yt-dlp: {yt_dlp.version.__version__}")

    # 9. Scene Detection & MoviePy
    import scenedetect
    import moviepy
    print(f"[9] PySceneDetect: {scenedetect.__version__}")
    print(f"    MoviePy: {moviepy.__version__}")

    print("\n" + "=" * 70)
    print("ALL DEPENDENCIES AND RUNTIMES VERIFIED SUCCESSFULLY (100% PASS)")
    print("=" * 70)

if __name__ == "__main__":
    verify_all()
