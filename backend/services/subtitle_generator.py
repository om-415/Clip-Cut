import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

class SubtitleGeneratorService:
    @staticmethod
    def format_ass_timestamp(seconds: float) -> str:
        """Converts seconds into ASS timestamp format: H:MM:SS.cs"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centisecs = int(round((seconds - int(seconds)) * 100))
        if centisecs >= 100:
            centisecs = 99
        return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

    @staticmethod
    def format_srt_timestamp(seconds: float) -> str:
        """Converts seconds into SRT timestamp format: HH:MM:SS,mmm"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int(round((seconds - int(seconds)) * 1000))
        if millisecs >= 1000:
            millisecs = 999
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

    @classmethod
    def generate_ass_subtitles(
        cls,
        segments: List[Dict[str, Any]],
        output_ass_path: Path,
        clip_start_offset: float = 0.0,
        style_name: str = "gaming_bold",
        font_size: int = 54
    ) -> Path:
        """
        Generates Advanced SubStation Alpha (.ass) subtitle file formatted for 1080x1920 vertical video.
        Supports styles: 'gaming_bold', 'minimal_white', 'animated_highlight', 'professional_captions'.
        """
        output_ass_path.parent.mkdir(parents=True, exist_ok=True)

        # Style definitions (ASS color format: &HAABBGGRR)
        styles_map = {
            # Yellow text, thick black border, box shadow
            "gaming_bold": (
                f"Style: Default,Impact,{font_size},&H0000FFFF,&H000000FF,&H00000000,&H80000000,"
                f"-1,0,0,0,100,100,0,0,1,5.0,2.0,2,80,80,360,1"
            ),
            # Clean minimal white, subtle dark outline
            "minimal_white": (
                f"Style: Default,Arial,{font_size - 4},&H00FFFFFF,&H000000FF,&H00000000,&H90000000,"
                f"0,0,0,0,100,100,0,0,1,2.5,1.5,2,80,80,360,1"
            ),
            # Bright cyan/yellow animated karaoke
            "animated_highlight": (
                f"Style: Default,Trebuchet MS,{font_size},&H0000E5FF,&H0000FFFF,&H00000000,&H80000000,"
                f"-1,0,0,0,100,100,0,0,1,4.5,2.0,2,80,80,360,1"
            ),
            # Professional translucent box background
            "professional_captions": (
                f"Style: Default,Helvetica,{font_size - 6},&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,"
                f"0,0,0,0,100,100,0,0,3,3.0,0.0,2,80,80,360,1"
            ),
        }

        style_line = styles_map.get(style_name, styles_map["gaming_bold"])

        ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        events = []
        for seg in segments:
            # Adjust timestamp relative to clip start
            seg_start = seg["start"] - clip_start_offset
            seg_end = seg["end"] - clip_start_offset

            if seg_end <= 0:
                continue

            # Ensure start is non-negative
            start_sec = max(0.0, seg_start)
            end_sec = max(start_sec + 0.3, seg_end)

            start_str = cls.format_ass_timestamp(start_sec)
            end_str = cls.format_ass_timestamp(end_sec)

            text = seg.get("text", "").strip()
            if not text:
                continue

            # Word-level karaoke highlighting if animated style
            if style_name == "animated_highlight" and seg.get("words"):
                words_list = seg["words"]
                karaoke_text_parts = []
                for w in words_list:
                    w_text = w.get("word", "")
                    w_dur_cs = int(round((w["end"] - w["start"]) * 100))
                    if w_dur_cs < 5:
                        w_dur_cs = 5
                    karaoke_text_parts.append(f"{{\\k{w_dur_cs}}}{w_text}")
                formatted_text = " ".join(karaoke_text_parts)
            else:
                # Add slight emphasis to capital or exclamation words
                formatted_text = text.replace('"', '\\"')

            events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{formatted_text}")

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(ass_header + "\n".join(events) + "\n")

        return output_ass_path

    @classmethod
    def generate_srt_subtitles(
        cls,
        segments: List[Dict[str, Any]],
        output_srt_path: Path,
        clip_start_offset: float = 0.0
    ) -> Path:
        """
        Generates standard SubRip (.srt) subtitle file.
        """
        output_srt_path.parent.mkdir(parents=True, exist_ok=True)
        srt_entries = []
        counter = 1

        for seg in segments:
            seg_start = seg["start"] - clip_start_offset
            seg_end = seg["end"] - clip_start_offset

            if seg_end <= 0:
                continue

            start_sec = max(0.0, seg_start)
            end_sec = max(start_sec + 0.3, seg_end)

            start_str = cls.format_srt_timestamp(start_sec)
            end_str = cls.format_srt_timestamp(end_sec)

            text = seg.get("text", "").strip()
            if not text:
                continue

            srt_entries.append(f"{counter}\n{start_str} --> {end_str}\n{text}\n")
            counter += 1

        with open(output_srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_entries))

        return output_srt_path
