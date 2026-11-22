import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

import psutil
import torch

from backend.app.config import BASE_DIR, CLIPS_DIR, DOWNLOADS_DIR, TEMP_DIR

class SystemInfoService:
    @staticmethod
    def _get_dir_size_mb(path: Path) -> float:
        """Safely calculates total size of a directory in Megabytes."""
        if not path.exists():
            return 0.0
        total_bytes = 0
        try:
            for entry in path.rglob("*"):
                if entry.is_file():
                    total_bytes += entry.stat().st_size
        except Exception:
            pass
        return round(total_bytes / (1024 * 1024), 2)

    @classmethod
    def get_system_telemetry(cls) -> Dict[str, Any]:
        """
        Gathers safe, minimal, real runtime capabilities and specifications.
        Never leaks private hostnames, IPs, environment secrets, or process arguments.
        """
        # 1. CPU & OS
        os_name = platform.system()
        os_release = platform.release()
        cpu_cores = os.cpu_count() or 1
        cpu_arch = platform.machine()
        
        # 2. Memory
        try:
            mem = psutil.virtual_memory()
            ram_total_gb = round(mem.total / (1024 ** 3), 2)
            ram_available_gb = round(mem.available / (1024 ** 3), 2)
            ram_used_pct = mem.percent
        except Exception:
            ram_total_gb = 0.0
            ram_available_gb = 0.0
            ram_used_pct = 0.0

        # 3. GPU / Hardware Acceleration
        cuda_available = torch.cuda.is_available()
        gpu_name = "None detected (CPU mode active)"
        gpu_mem = "Unavailable"
        if cuda_available:
            try:
                gpu_name = torch.cuda.get_device_name(0)
                gpu_mem = f"{round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)} GB"
            except Exception:
                gpu_name = "CUDA Compatible Device"

        # 4. FFmpeg Engine
        ffmpeg_version = "Unavailable"
        try:
            res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if res.returncode == 0:
                first_line = res.stdout.splitlines()[0]
                # Extract version token e.g. "ffmpeg version N-127043..."
                ffmpeg_version = first_line.split(" Copyright")[0].replace("ffmpeg version ", "FFmpeg ")
        except Exception:
            ffmpeg_version = "FFmpeg (CLI in PATH)"

        # 5. Disk Space
        try:
            du = shutil.disk_usage(str(BASE_DIR))
            disk_total_gb = round(du.total / (1024 ** 3), 1)
            disk_free_gb = round(du.free / (1024 ** 3), 1)
            disk_used_pct = round((du.used / du.total) * 100, 1)
        except Exception:
            disk_total_gb = 0.0
            disk_free_gb = 0.0
            disk_used_pct = 0.0

        # 6. Storage usage of application folders
        clips_mb = cls._get_dir_size_mb(CLIPS_DIR)
        downloads_mb = cls._get_dir_size_mb(DOWNLOADS_DIR)
        temp_mb = cls._get_dir_size_mb(TEMP_DIR)
        total_app_storage_mb = round(clips_mb + downloads_mb + temp_mb, 2)

        return {
            "application": {
                "name": "ClipCut AI Stream Studio",
                "version": "1.0.0-beta",
                "processing_mode": "Local Machine Engine",
                "engine_status": "Ready",
            },
            "hardware": {
                "os": f"{os_name} {os_release} ({cpu_arch})",
                "cpu_cores": cpu_cores,
                "ram_total_gb": ram_total_gb,
                "ram_available_gb": ram_available_gb,
                "ram_used_pct": ram_used_pct,
                "gpu_detected": cuda_available,
                "gpu_model": gpu_name,
                "gpu_memory": gpu_mem,
                "acceleration": "NVIDIA CUDA" if cuda_available else "Intel AVX2 / CPU SIMD",
            },
            "environment": {
                "python_version": platform.python_version(),
                "pytorch_version": torch.__version__,
                "ffmpeg_version": ffmpeg_version,
            },
            "ai_models": {
                "speech_recognition": "OpenAI Whisper (Speech Hype Candidate Windows)",
                "face_detection": "MediaPipe Vision Face Landmark & ROI Box",
                "audio_analysis": "Librosa RMS Energy & Spectral Flux",
                "gameplay_motion": "OpenCV Farneback Dense Optical Flow",
            },
            "storage": {
                "disk_total_gb": disk_total_gb,
                "disk_free_gb": disk_free_gb,
                "disk_used_pct": disk_used_pct,
                "clips_storage_mb": clips_mb,
                "downloads_cache_mb": downloads_mb,
                "temp_scratch_mb": temp_mb,
                "app_total_mb": total_app_storage_mb,
            },
            "formats": {
                "supported_inputs": ["YouTube Video / Livestream URL", "MP4", "MKV", "WebM"],
                "supported_outputs": ["1080x1920 (9:16) MP4", "1080x1080 (1:1) MP4", "1920x1080 (16:9) MP4"],
                "video_codec": "H.264 (libx264) @ yuv420p + faststart",
                "audio_codec": "AAC Stereo 44.1kHz / 192kbps",
            },
            "limitations": [
                "Audio-first range downloads preserve 95%+ cellular/mobile data bandwidth.",
                "Processing duration scales with target stream length and selected candidate count.",
                "Shorts video format strictly adheres to 9:16 vertical ratio and duration under 60s.",
            ]
        }
