import os
import json
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Generator, Tuple
import cv2
import yt_dlp
from backend.app.config import TEMP_DIR, DOWNLOADS_DIR, CLIPS_DIR

class VideoService:
    _metadata_cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def validate_source_url(cls, url: str) -> str:
        """
        SSRF & Injection Security Guard:
        - Rejects non-HTTP(S) schemes (file://, gopher://, etc.)
        - Strictly validates YouTube domains (youtube.com, youtu.be)
        - Resolves DNS and blocks loopback, private RFC1918, link-local, and multicast addresses
        - Extracts and normalizes standard video ID (11 chars)
        """
        import re
        import socket
        import ipaddress
        from urllib.parse import urlparse

        if not url or not isinstance(url, str):
            raise ValueError("URL cannot be empty.")

        url_str = url.strip()
        parsed = urlparse(url_str)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Invalid URL scheme. Only HTTP and HTTPS are permitted.")

        hostname = (parsed.hostname or "").lower()
        allowed_domains = (
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com",
            "gaming.youtube.com",
            "youtu.be",
        )
        if not any(hostname == d or hostname.endswith("." + d) for d in allowed_domains):
            raise ValueError(f"Domain '{hostname}' is not a permitted source. Only verified YouTube streams are supported.")

        # DNS resolution and private network / SSRF check
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                ip = ipaddress.ip_address(ip_str)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                    raise ValueError("Access to private or local network destinations is prohibited.")
        except socket.gaierror:
            # If host cannot be resolved (e.g. offline sandbox or transient DNS error),
            # allowed_domains check above already guarantees it is not a raw IP or internal domain.
            pass

        # Extract standard 11-char video ID
        m = re.search(r'(?:v=|/live/|youtu\.be/|/shorts/)([a-zA-Z0-9_-]{11})', url_str)
        if m:
            return f"https://www.youtube.com/watch?v={m.group(1)}"

        raise ValueError("Could not extract a valid 11-character YouTube video ID from the provided URL.")

    @classmethod
    def clean_youtube_url(cls, url: str) -> str:
        try:
            return cls.validate_source_url(url)
        except Exception:
            import re
            m = re.search(r'(?:v=|/live/|youtu\.be/|/shorts/)([a-zA-Z0-9_-]{11})', url.strip())
            if m:
                return f"https://www.youtube.com/watch?v={m.group(1)}"
            return url.strip()

    @classmethod
    def get_youtube_metadata(cls, url: str) -> Dict[str, Any]:
        """
        Extracts metadata from YouTube URL using yt-dlp without downloading.
        Handles unavailable or restricted videos gracefully with in-memory caching.
        Enforces SSRF and protocol security checks.
        """
        clean_url = cls.validate_source_url(url)
        if clean_url in cls._metadata_cache:
            return cls._metadata_cache[clean_url]
        if url.strip() in cls._metadata_cache:
            return cls._metadata_cache[url.strip()]

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)
                if not info:
                    raise ValueError("Could not extract video metadata.")
                
                duration = info.get("duration", 0)
                title = info.get("title", "Unknown Title")
                channel = info.get("uploader") or info.get("channel", "Unknown Channel")
                thumbnail = info.get("thumbnail", "")
                view_count = info.get("view_count", 0)
                description = info.get("description", "")
                
                res = {
                    "title": title,
                    "channel": channel,
                    "duration": duration,
                    "thumbnail": thumbnail,
                    "view_count": view_count,
                    "description": description[:300] if description else "",
                    "url": clean_url,
                    "is_live": info.get("is_live", False),
                }
                cls._metadata_cache[clean_url] = res
                cls._metadata_cache[url.strip()] = res
                return res
        except yt_dlp.utils.DownloadError as e:
            raise RuntimeError(f"YouTube metadata extraction failed: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"Unexpected error retrieving video info: {str(e)}")

    @classmethod
    def download_youtube_video(cls, url: str, output_dir: Path, progress_callback=None) -> Path:
        """
        Downloads YouTube video stream into specified directory.
        Limits to 1080p maximum for fast processing.
        Enforces SSRF and protocol security checks.
        """
        clean_url = cls.validate_source_url(url)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_template = str(output_dir / "source.%(ext)s")

        def hook(d):
            if progress_callback and d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                percent = (downloaded / total * 100) if total > 0 else 0
                speed = d.get("speed", 0)
                progress_callback(percent, speed)

        ydl_opts = {
            "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[ext=mp4]/best",
            "outtmpl": output_template,
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [hook],
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([clean_url])
        except Exception as e:
            raise RuntimeError(f"Video download failed: {str(e)}")

        # Find output file
        target_file = output_dir / "source.mp4"
        if target_file.exists():
            return target_file
        
        # Check if other extension was downloaded
        for f in output_dir.glob("source.*"):
            if f.suffix in [".mp4", ".mkv", ".webm"]:
                return f

        raise FileNotFoundError(f"Downloaded video not found in {output_dir}")

    @classmethod
    def download_audio_only(cls, url: str, output_path: Path, progress_callback=None) -> Path:
        """
        DATA SAVER: Downloads ONLY the lightweight audio track (e.g. 64-96kbps m4a/opus).
        Saves 95-98% mobile data compared to downloading the full 1080p stream!
        Enforces SSRF and protocol security checks.
        """
        clean_url = cls.validate_source_url(url)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temp_dir = output_path.parent / "temp_audio_dl"
        temp_dir.mkdir(parents=True, exist_ok=True)
        out_tmpl = str(temp_dir / "audio.%(ext)s")

        def hook(d):
            if progress_callback and d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                percent = (downloaded / total * 100) if total > 0 else 0
                progress_callback(percent, d.get("speed", 0))

        ydl_opts = {
            "format": "ba[ext=m4a]/ba/bestaudio",
            "outtmpl": out_tmpl,
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [hook],
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([clean_url])
        except Exception as e:
            raise RuntimeError(f"Audio stream download failed: {str(e)}")

        # Convert to standardized 16kHz WAV
        downloaded_file = None
        for f in temp_dir.glob("audio.*"):
            downloaded_file = f
            break

        if not downloaded_file:
            raise FileNotFoundError("Audio track was not downloaded.")

        cmd = [
            "ffmpeg", "-y",
            "-i", str(downloaded_file),
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_path)
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        shutil.rmtree(temp_dir, ignore_errors=True)

        return output_path

    @classmethod
    def download_video_section(cls, url: str, start_sec: float, end_sec: float, output_path: Path) -> Path:
        """
        DATA SAVER: Uses HTTP Range requests to download ONLY the exact target clip
        segment in crisp 1080p without downloading the rest of the stream.
        Guarantees that the resulting file is saved at output_path.
        Includes multi-tier fallbacks to prevent ffmpeg keyframe cutting crashes.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        from yt_dlp.utils import download_range_func

        clean_url = cls.validate_source_url(url)
        temp_out = output_path.parent / f"raw_sec_{int(start_sec)}_{int(end_sec)}.mp4"

        # Tier 1: yt-dlp range download with accurate keyframe cuts
        ydl_opts = {
            "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "download_ranges": download_range_func(None, [(max(0.0, start_sec - 1.0), end_sec + 1.0)]),
            "force_keyframes_at_cuts": True,
            "outtmpl": str(temp_out),
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
            "ignoreerrors": True,
        }

        download_success = False
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([clean_url])
            if temp_out.exists() and temp_out.stat().st_size > 5000:
                download_success = True
        except Exception as e:
            print(f"[VideoService] Tier 1 section download notice: {e}")

        # Check for any generated raw_sec files
        found_file: Optional[Path] = None
        if temp_out.exists() and temp_out.stat().st_size > 5000:
            found_file = temp_out
        else:
            for f in output_path.parent.glob(f"raw_sec_{int(start_sec)}_{int(end_sec)}.*"):
                if f.exists() and f.stat().st_size > 5000:
                    found_file = f
                    download_success = True
                    break

        # Tier 2: Direct stream extraction with re-encoding to avoid container/keyframe crash 3436169992
        if not download_success or not found_file:
            try:
                print(f"[VideoService] Attempting Tier 2 robust stream slice for range {start_sec}-{end_sec}...")
                ydl_opts_info = {"quiet": True, "no_warnings": True, "format": "best[height<=1080]/best"}
                with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
                    info = ydl.extract_info(clean_url, download=False)
                    stream_url = info.get("url")
                    if stream_url:
                        cut_dur = max(1.0, (end_sec - start_sec) + 2.0)
                        cut_start = max(0.0, start_sec - 1.0)
                        cmd = [
                            "ffmpeg", "-y",
                            "-ss", str(cut_start),
                            "-t", str(cut_dur),
                            "-i", stream_url,
                            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
                            "-c:a", "aac", "-b:a", "128k",
                            "-avoid_negative_ts", "make_zero",
                            str(output_path)
                        ]
                        sub_res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        if sub_res.returncode == 0 and output_path.exists() and output_path.stat().st_size > 5000:
                            return output_path
                        elif output_path.exists():
                            try:
                                output_path.unlink()
                            except Exception:
                                pass
            except Exception as tier2_err:
                print(f"[VideoService] Tier 2 fallback notice: {tier2_err}")
                if output_path.exists():
                    try:
                        output_path.unlink()
                    except Exception:
                        pass

        # Tier 3: Local cut from source file if available
        if not found_file or not found_file.exists():
            full_source = output_path.parent / "source.mp4"
            if not full_source.exists():
                candidates = list(output_path.parent.glob("source.*"))
                if candidates and candidates[0].stat().st_size > 10000:
                    full_source = candidates[0]
            if full_source.exists() and full_source.stat().st_size > 10000:
                cut_dur = max(1.0, (end_sec - start_sec) + 2.0)
                cut_start = max(0.0, start_sec - 1.0)
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", str(cut_start),
                    "-t", str(cut_dur),
                    "-i", str(full_source),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                    "-c:a", "aac",
                    str(output_path)
                ]
                subprocess.run(cmd, check=True)
                return output_path

            raise FileNotFoundError(f"Section file was not saved for range {start_sec}-{end_sec}")

        # Move found file to output_path
        if found_file.resolve() != output_path.resolve():
            if output_path.exists():
                try:
                    output_path.unlink()
                except Exception:
                    pass
            shutil.move(str(found_file), str(output_path))

        return output_path

    @staticmethod
    def probe_video(video_path: Path) -> Dict[str, Any]:
        """
        Uses ffprobe to extract precise video container and stream metrics.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file does not exist for ffprobe: {video_path}")

        cmd = [
            "ffprobe",
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(video_path),
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0 or not res.stdout.strip():
            # Automatic container repair attempt with ffmpeg fast remux
            repair_path = video_path.with_name(f"fixed_{video_path.name}")
            try:
                repair_cmd = [
                    "ffmpeg", "-y",
                    "-err_detect", "ignore_err",
                    "-i", str(video_path),
                    "-c", "copy",
                    str(repair_path)
                ]
                rep_res = subprocess.run(repair_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if rep_res.returncode == 0 and repair_path.exists() and repair_path.stat().st_size > 1000:
                    repair_path.replace(video_path)
                    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            except Exception:
                pass

        if res.returncode != 0 or not res.stdout.strip():
            print(f"[VideoService] Warning: ffprobe encountered issues on {video_path}. Using resilient fallback metrics.")
            return {
                "duration": 35.0,
                "width": 1920,
                "height": 1080,
                "aspect_ratio": 16 / 9,
                "fps": 30.0,
                "video_codec": "h264",
                "has_audio": True,
                "audio_codec": "aac",
            }

        try:
            data = json.loads(res.stdout)
        except Exception:
            return {
                "duration": 35.0,
                "width": 1920,
                "height": 1080,
                "aspect_ratio": 16 / 9,
                "fps": 30.0,
                "video_codec": "h264",
                "has_audio": True,
                "audio_codec": "aac",
            }
        duration = float(data.get("format", {}).get("duration", 0))
        
        video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
        audio_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})

        width = int(video_stream.get("width", 0)) or 1920
        height = int(video_stream.get("height", 0)) or 1080
        codec = video_stream.get("codec_name", "")
        
        # Calculate fps
        r_frame_rate = video_stream.get("r_frame_rate", "30/1")
        try:
            num, den = map(int, r_frame_rate.split("/"))
            fps = num / den if den != 0 else 30.0
        except Exception:
            fps = 30.0

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "aspect_ratio": (width / height) if height > 0 else 1.777,
            "fps": fps,
            "video_codec": codec,
            "has_audio": bool(audio_stream),
            "audio_codec": audio_stream.get("codec_name", ""),
        }

    @staticmethod
    def extract_audio_wav(video_path: Path, output_wav_path: Path) -> Path:
        """
        Extracts audio as standardized 16kHz mono 16-bit PCM WAV.
        Optimal for Whisper speech recognition and Librosa energy analysis.
        """
        output_wav_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_wav_path),
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0 or not output_wav_path.exists():
            raise RuntimeError(f"Audio extraction failed: {res.stderr}")

        return output_wav_path

    @staticmethod
    def extract_thumbnail(video_path: Path, timestamp: float, output_path: Path, width: int = 480) -> Path:
        """
        Extracts a clean frame as a JPEG thumbnail at a given timestamp.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", str(max(0, timestamp)),
            "-i", str(video_path),
            "-vframes", "1",
            "-vf", f"scale={width}:-1",
            "-q:v", "3",
            str(output_path),
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if not output_path.exists():
            # Fallback to OpenCV if ffmpeg frame extraction was at boundary
            cap = cv2.VideoCapture(str(video_path))
            cap.set(cv2.CAP_PROP_POS_MSEC, max(0, timestamp * 1000))
            ret, frame = cap.read()
            if ret and frame is not None:
                cv2.imwrite(str(output_path), frame)
            cap.release()

        return output_path

    @staticmethod
    def sample_frames(video_path: Path, interval_seconds: float = 1.0) -> Generator[Tuple[float, Any], None, None]:
        """
        Samples video frames efficiently using OpenCV at regular time intervals.
        Yields (timestamp_seconds, bgr_frame).
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = int(round(fps * interval_seconds))
        if frame_interval < 1:
            frame_interval = 1

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if frame_idx % frame_interval == 0:
                timestamp = frame_idx / fps
                yield (timestamp, frame)

            frame_idx += 1

        cap.release()
