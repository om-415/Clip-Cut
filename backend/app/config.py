import os
from pathlib import Path

# Paths
BASE_DIR = Path(r"D:\yt\ai-stream-clipper")
BACKEND_DIR = BASE_DIR / "backend"
MODELS_DIR = BASE_DIR / "models"
WHISPER_DIR = MODELS_DIR / "whisper"
HF_CACHE_DIR = MODELS_DIR / "cache" / "huggingface"
TORCH_CACHE_DIR = MODELS_DIR / "cache" / "torch"
DOWNLOADS_DIR = BASE_DIR / "downloads"
PROCESSED_DIR = BASE_DIR / "processed"
CLIPS_DIR = BASE_DIR / "clips"
SUBTITLES_DIR = BASE_DIR / "subtitles"
TEMP_DIR = BASE_DIR / "temp"
LOGS_DIR = BASE_DIR / "logs"
MPL_DIR = TEMP_DIR / "matplotlib"

# Ensure critical directories exist
for p in [MODELS_DIR, WHISPER_DIR, HF_CACHE_DIR, TORCH_CACHE_DIR, 
          DOWNLOADS_DIR, PROCESSED_DIR, CLIPS_DIR, SUBTITLES_DIR, 
          TEMP_DIR, LOGS_DIR, MPL_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# Environment variables setup
os.environ["PATH"] = r"D:\tools\ffmpeg\bin;" + os.environ.get("PATH", "")
os.environ["HF_HOME"] = str(HF_CACHE_DIR)
os.environ["TORCH_HOME"] = str(TORCH_CACHE_DIR)
os.environ["MPLCONFIGDIR"] = str(MPL_DIR)
os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

# Database Configuration
DB_PATH = BASE_DIR / "stream_clipper.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Video & Export Settings
DEFAULT_VERTICAL_WIDTH = 1080
DEFAULT_VERTICAL_HEIGHT = 1920
DEFAULT_VIDEO_FPS = 30
DEFAULT_VIDEO_CRF = 21
DEFAULT_AUDIO_BITRATE = "192k"
DEFAULT_TARGET_CLIP_DURATION = 35.0  # seconds
MIN_CLIP_DURATION = 15.0
MAX_CLIP_DURATION = 60.0

# Subtitle styles
SUBTITLE_STYLES = ["gaming_bold", "minimal_white", "animated_highlight", "professional_captions"]
LAYOUT_MODES = ["split_stack", "overlay_pip", "blurred_fill", "pure_gameplay"]
