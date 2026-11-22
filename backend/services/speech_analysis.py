import os
import re
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import whisper
from backend.app.config import WHISPER_DIR, TEMP_DIR

# High-energy / gaming / reaction vocabulary
EXCITEMENT_KEYWORDS = {
    # Hype phrases (high weight)
    "no way": 1.0,
    "oh my god": 0.95,
    "omg": 0.9,
    "let's go": 1.0,
    "lets go": 1.0,
    "clutch": 1.0,
    "headshot": 0.95,
    "insane": 0.9,
    "are you kidding": 0.95,
    "holy": 0.85,
    "unbelievable": 0.9,
    "ace": 0.95,
    "pog": 0.85,
    "what the": 0.85,
    "wtf": 0.9,
    "sheesh": 0.85,
    "crazy": 0.8,
    "he's one shot": 0.95,
    "one shot": 0.9,
    "quad kill": 1.0,
    "triple kill": 0.9,
    "victory": 0.95,
    "we won": 0.95,
    "gg": 0.75,
    "got him": 0.85,
    "kill": 0.75,
    "dead": 0.7,
    "sniper": 0.8,
    "watch this": 0.85,
    "shut up": 0.8,
    "noooo": 0.9,
    "yeeee": 0.9,
    "bro": 0.7,
    "look at this": 0.8,
    "how did": 0.8,
}

class SpeechAnalysisService:
    _whisper_model = None

    @classmethod
    def get_whisper_model(cls, model_name: str = "base"):
        if cls._whisper_model is None:
            print(f"[SpeechAnalysis] Loading Whisper '{model_name}' model on CPU...")
            cls._whisper_model = whisper.load_model(
                model_name,
                download_root=str(WHISPER_DIR),
                in_memory=False
            )
        return cls._whisper_model

    @staticmethod
    def get_audio_duration(wav_path: Path) -> float:
        """Returns audio duration in seconds via ffprobe."""
        try:
            cmd = [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(wav_path)
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            return float(res.stdout.strip())
        except Exception:
            return 300.0

    @classmethod
    def transcribe_chunk(
        cls, 
        model, 
        chunk_wav_path: Path, 
        time_offset: float = 0.0,
        language: Optional[str] = "en"
    ) -> List[Dict[str, Any]]:
        """
        Fast CPU inference on a single audio chunk with greedy decoding (beam_size=1, fp16=False).
        Guarantees rapid execution without CPU thread lock or memory bloat.
        """
        options = {
            "task": "transcribe",
            "language": language or "en",
            "word_timestamps": True,
            "verbose": False,
            "fp16": False,
            "beam_size": 1,
            "best_of": 1,
            "temperature": 0.0,
        }

        try:
            result = model.transcribe(str(chunk_wav_path), **options)
        except Exception as e:
            print(f"[SpeechAnalysis] Chunk transcription notice: {e}")
            return []

        raw_segments = result.get("segments", [])
        analyzed_segments = []

        for seg in raw_segments:
            text = seg.get("text", "").strip()
            if not text:
                continue

            start = float(seg.get("start", 0.0)) + time_offset
            end = float(seg.get("end", 0.0)) + time_offset
            duration = max(end - start, 0.1)

            # Analyze text for excitement keywords
            text_lower = text.lower()
            keyword_score = 0.0
            matched_keywords = []

            for kw, weight in EXCITEMENT_KEYWORDS.items():
                if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                    keyword_score = max(keyword_score, weight)
                    matched_keywords.append(kw)

            # Punctuation & casing excitement signals
            exclamation_count = text.count("!")
            question_count = text.count("?")
            shout_punct_score = min(exclamation_count * 0.2 + question_count * 0.1, 0.4)

            # Capitalization intensity
            words = text.split()
            caps_words = [w for w in words if w.isupper() and len(w) > 1]
            caps_ratio = len(caps_words) / len(words) if words else 0.0
            caps_score = min(caps_ratio * 0.5, 0.3)

            # Speech cadence
            wps = len(words) / duration
            cadence_score = 0.2 if wps > 3.0 else 0.0

            # Combined score (0.0 to 1.0)
            combined_score = min(keyword_score + shout_punct_score + caps_score + cadence_score, 1.0)

            # Extract word-level timestamps
            words_info = []
            for w in seg.get("words", []):
                words_info.append({
                    "word": w.get("word", "").strip(),
                    "start": round(float(w.get("start", 0.0)) + time_offset, 3),
                    "end": round(float(w.get("end", 0.0)) + time_offset, 3),
                    "probability": round(float(w.get("probability", 1.0)), 2),
                })

            analyzed_segments.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "duration": round(duration, 3),
                "text": text,
                "score": round(float(combined_score), 4),
                "matched_keywords": matched_keywords,
                "words": words_info,
            })

        return analyzed_segments

    @classmethod
    def transcribe_and_analyze(
        cls, 
        wav_path: Path, 
        language: Optional[str] = "en",
        audio_timeline: Optional[List[Dict[str, Any]]] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> List[Dict[str, Any]]:
        """
        High-Performance Adaptive Speech Recognition Engine.
        Fixes the 45% freeze issue on long streams:
        1. If stream is <= 300s, transcribes directly in one pass.
        2. If stream is > 300s, uses audio energy peaks to transcribe only candidate regions
           (e.g., top 15-25 high-energy windows of 30s) instead of wasting hours on dead silence.
        3. Updates progress continuously from 45% -> 60% so user never experiences a stall.
        """
        model = cls.get_whisper_model("base")
        total_duration = cls.get_audio_duration(wav_path)
        print(f"[SpeechAnalysis] Audio duration: {total_duration:.1f}s")

        if progress_callback:
            progress_callback(46.0, "Loading Whisper speech models...")

        # Case 1: Short video (under 5 minutes) -> Single fast pass
        if total_duration <= 300.0:
            print("[SpeechAnalysis] Short video: running single-pass Whisper transcription...")
            if progress_callback:
                progress_callback(50.0, "Transcribing commentary...")
            segments = cls.transcribe_chunk(model, wav_path, time_offset=0.0, language=language)
            if progress_callback:
                progress_callback(60.0, "Speech recognition complete.")
            return segments

        # Case 2: Long stream (> 5 minutes) -> Energy-guided candidate windows
        print(f"[SpeechAnalysis] Long stream ({total_duration/60:.1f} min): using energy-guided window transcription...")
        
        # Determine candidate time windows (each 30s)
        windows = []
        if audio_timeline and len(audio_timeline) > 0:
            # Sort audio timestamps by excitement score descending
            sorted_peaks = sorted(audio_timeline, key=lambda x: x.get("score", 0.0), reverse=True)
            # Pick top peak timestamps, minimum 35s apart
            chosen_timestamps = []
            for p in sorted_peaks:
                ts = p.get("timestamp", 0.0)
                if not any(abs(ts - c) < 35.0 for c in chosen_timestamps):
                    chosen_timestamps.append(ts)
                    if len(chosen_timestamps) >= 20:  # Top 20 peak moments
                        break

            for ts in chosen_timestamps:
                start_w = max(0.0, ts - 15.0)
                end_w = min(total_duration, ts + 20.0)
                windows.append((start_w, end_w))
        else:
            # Fallback uniform sampling across the stream
            step = max(60.0, total_duration / 20.0)
            curr = 10.0
            while curr < total_duration and len(windows) < 20:
                windows.append((curr, min(total_duration, curr + 30.0)))
                curr += step

        # Sort windows chronologically
        windows.sort(key=lambda x: x[0])
        print(f"[SpeechAnalysis] Transcribing {len(windows)} candidate hype windows...")

        temp_chunk_dir = TEMP_DIR / "whisper_chunks"
        temp_chunk_dir.mkdir(parents=True, exist_ok=True)
        chunk_file = temp_chunk_dir / "temp_slice.wav"

        all_segments = []
        total_w = len(windows)

        for idx, (w_start, w_end) in enumerate(windows):
            pct = 46.0 + ((idx + 1) / total_w * 14.0)
            if progress_callback:
                progress_callback(pct, f"Transcribing commentary: window {idx + 1} of {total_w}...")

            w_dur = w_end - w_start
            # Fast extraction of 30s slice using ffmpeg
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(w_start),
                "-t", str(w_dur),
                "-i", str(wav_path),
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                str(chunk_file)
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            if chunk_file.exists():
                chunk_segs = cls.transcribe_chunk(model, chunk_file, time_offset=w_start, language=language)
                all_segments.extend(chunk_segs)

        # Cleanup temp slice
        if chunk_file.exists():
            try:
                os.remove(chunk_file)
            except Exception:
                pass

        if progress_callback:
            progress_callback(60.0, f"Speech recognition finished ({len(all_segments)} dialogue segments).")

        print(f"[SpeechAnalysis] Total transcribed segments across stream: {len(all_segments)}")
        return all_segments
