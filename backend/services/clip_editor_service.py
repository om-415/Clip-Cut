import os
import json
import re
import subprocess
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, List

from backend.app.config import CLIPS_DIR, SUBTITLES_DIR, TEMP_DIR
from backend.services.video_service import VideoService

class ClipEditorService:
    @staticmethod
    def hex_to_ass_color(hex_str: str, alpha_hex: str = "00") -> str:
        """
        Converts standard #RRGGBB hex string into ASS &HAABBGGRR format.
        """
        clean = hex_str.lstrip("#").strip()
        if len(clean) == 3:
            clean = "".join(c * 2 for c in clean)
        if len(clean) != 6:
            clean = "FFFFFF"
        r = clean[0:2].upper()
        g = clean[2:4].upper()
        b = clean[4:6].upper()
        return f"&H{alpha_hex}{b}{g}{r}"

    @classmethod
    def generate_custom_ass_subtitles(
        cls,
        text: str,
        duration: float,
        output_ass_path: Path,
        font_name: str = "Impact",
        font_size: int = 50,
        primary_color: str = "#FFFF00",
        outline_color: str = "#000000",
        has_box_bg: bool = False,
        position: str = "bottom",
        out_width: int = 1080,
        out_height: int = 1920
    ) -> Path:
        """
        Builds a customized .ass subtitle file based on user styling preferences.
        """
        output_ass_path.parent.mkdir(parents=True, exist_ok=True)

        ass_primary = cls.hex_to_ass_color(primary_color, "00")
        ass_outline = cls.hex_to_ass_color(outline_color, "00")
        ass_box_bg = "&H80000000" if has_box_bg else "&H90000000"
        border_style = 3 if has_box_bg else 1  # 3 = opaque/translucent box, 1 = outline + shadow

        # Alignment: 2 = Bottom center, 5 = Middle center, 8 = Top center
        if position == "top":
            alignment = 8
            margin_v = 140
        elif position == "middle":
            alignment = 5
            margin_v = 0
        else:
            # default bottom
            alignment = 2
            margin_v = 140

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {out_width}
PlayResY: {out_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Custom,{font_name},{font_size},{ass_primary},&H000000FF,{ass_outline},{ass_box_bg},-1,0,0,0,100,100,0,0,{border_style},4.0,2.0,{alignment},80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        # Split text into sentences / chunks across duration
        lines = [ln.strip() for ln in re.split(r'[\n\.\?!]+', text) if ln.strip()]
        if not lines:
            lines = [text.strip() or ""]

        events = []
        if len(lines) == 1:
            events.append(f"Dialogue: 0,0:00:00.00,{cls.format_time(duration)},Custom,,0,0,0,,{lines[0]}")
        else:
            time_per_line = max(1.2, duration / len(lines))
            curr = 0.0
            for ln in lines:
                end_t = min(duration, curr + time_per_line)
                events.append(f"Dialogue: 0,{cls.format_time(curr)},{cls.format_time(end_t)},Custom,,0,0,0,,{ln}")
                curr = end_t
                if curr >= duration:
                    break

        content = header + "\n".join(events) + "\n"
        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(content)

        return output_ass_path

    @staticmethod
    def format_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        if cs >= 100:
            cs = 99
        return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"

    @classmethod
    def render_edited_clip(
        cls,
        source_clip_path: Path,
        output_clip_path: Path,
        start_trim: float = 0.0,
        end_trim: Optional[float] = None,
        aspect_ratio: str = "9:16",
        layout_mode: str = "split_stack",
        volume_multiplier: float = 1.0,
        subtitles_enabled: bool = True,
        subtitle_text: Optional[str] = None,
        subtitle_font: str = "Impact",
        subtitle_font_size: int = 50,
        subtitle_primary_color: str = "#FFFF00",
        subtitle_outline_color: str = "#000000",
        subtitle_has_box_bg: bool = False,
        subtitle_position: str = "bottom",
        facecam_box: Optional[Dict[str, int]] = None,
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Executes real FFmpeg rendering pipeline applying all user customizations.
        Preserves original clip, creates edited clip at output_clip_path.
        """
        if not source_clip_path.exists():
            raise FileNotFoundError(f"Source video clip not found at {source_clip_path}")

        output_clip_path.parent.mkdir(parents=True, exist_ok=True)
        probe = VideoService.probe_video(source_clip_path)
        orig_dur = probe.get("duration", 30.0)
        source_w = probe.get("width", 1080)
        source_h = probe.get("height", 1920)

        real_start = max(0.0, min(orig_dur - 0.5, start_trim))
        real_end = orig_dur if end_trim is None or end_trim <= real_start else min(orig_dur, end_trim)
        target_duration = max(0.5, real_end - real_start)

        # Determine target resolution and aspect ratio
        if aspect_ratio == "original_16:9":
            out_w, out_h = 1920, 1080
            sar_dar_filter = "setsar=1,setdar=16/9"
            aspect_arg = ["-aspect", "16:9"]
        elif aspect_ratio == "1:1":
            out_w, out_h = 1080, 1080
            sar_dar_filter = "setsar=1,setdar=1/1"
            aspect_arg = ["-aspect", "1:1"]
        else:
            # Default 9:16 vertical Shorts
            out_w, out_h = 1080, 1920
            sar_dar_filter = "setsar=1,setdar=9/16"
            aspect_arg = ["-aspect", "9:16"]

        # Build Subtitle ASS if enabled
        sub_ass_path = None
        if subtitles_enabled and subtitle_text and subtitle_text.strip():
            sub_dir = TEMP_DIR / "editor_subtitles"
            sub_dir.mkdir(parents=True, exist_ok=True)
            sub_ass_path = sub_dir / f"edit_sub_{uuid.uuid4().hex[:8]}.ass"
            cls.generate_custom_ass_subtitles(
                text=subtitle_text.strip(),
                duration=target_duration,
                output_ass_path=sub_ass_path,
                font_name=subtitle_font,
                font_size=subtitle_font_size,
                primary_color=subtitle_primary_color,
                outline_color=subtitle_outline_color,
                has_box_bg=subtitle_has_box_bg,
                position=subtitle_position,
                out_width=out_w,
                out_height=out_h
            )

        # Video Filter Graph
        # If source is already vertical 9:16 and target is 9:16, we can scale / frame cleanly
        v_filters = []
        if aspect_ratio == "9:16":
            if layout_mode == "split_stack" and facecam_box and facecam_box.get("w", 0) > 0:
                fx = max(0, min(source_w - 10, facecam_box["x"]))
                fy = max(0, min(source_h - 10, facecam_box["y"]))
                fw = max(10, min(source_w - fx, facecam_box["w"]))
                fh = max(10, min(source_h - fy, facecam_box["h"]))
                v_filters.append(
                    f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale={out_w}:720:force_original_aspect_ratio=increase,crop={out_w}:720[cam];"
                    f"[0:v]scale={out_w}:1200:force_original_aspect_ratio=increase,crop={out_w}:1200[game];"
                    f"[cam][game]vstack=inputs=2,drawbox=y=718:h=4:color=0x1E1E2E@0.9:t=fill,{sar_dar_filter}[base]"
                )
                last_pad = "[base]"
            elif layout_mode == "blurred_fill":
                v_filters.append(
                    f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},boxblur=25:5[bg];"
                    f"[0:v]scale={out_w}:-1[game];"
                    f"[bg][game]overlay=(W-w)/2:(H-h)/2,{sar_dar_filter}[base]"
                )
                last_pad = "[base]"
            else:
                # Direct scale to 1080x1920 with square pixels
                v_filters.append(
                    f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},{sar_dar_filter}[base]"
                )
                last_pad = "[base]"
        elif aspect_ratio == "1:1":
            v_filters.append(
                f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},{sar_dar_filter}[base]"
            )
            last_pad = "[base]"
        else:
            # 16:9
            v_filters.append(
                f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2,{sar_dar_filter}[base]"
            )
            last_pad = "[base]"

        # Subtitles Filter
        if sub_ass_path and sub_ass_path.exists():
            from backend.services.video_composer import VideoComposerService
            escaped_ass = VideoComposerService.escape_filter_path(sub_ass_path)
            v_filters.append(f"{last_pad}subtitles='{escaped_ass}',{sar_dar_filter}[outv]")
            final_pad = "[outv]"
        else:
            final_pad = last_pad

        filter_complex_str = ";".join(v_filters)

        # Audio Filter
        vol = max(0.0, min(2.5, float(volume_multiplier)))
        a_filter = f"volume={vol:.2f}"

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(real_start),
            "-t", str(target_duration),
            "-i", str(source_clip_path),
            "-filter_complex", filter_complex_str,
            "-map", final_pad,
            "-map", "0:a?",
            "-af", a_filter,
            *aspect_arg,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "44100",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_clip_path)
        ]

        print(f"[ClipEditorService] Rendering edited clip: {output_clip_path.name} (Trim: {real_start}s -> {real_end}s, Vol: {vol}x)")
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0 or not output_clip_path.exists():
            print(f"[ClipEditorService] Render error: {res.stderr}")
            raise RuntimeError(f"FFmpeg editor rendering failed: {res.stderr[:400]}")

        # Extract edited thumbnail
        thumb_path = output_clip_path.parent / f"thumb_{output_clip_path.stem}.jpg"
        VideoService.extract_thumbnail(
            video_path=output_clip_path,
            timestamp=min(1.0, target_duration / 2.0),
            output_path=thumb_path,
            width=540
        )

        file_size = os.path.getsize(output_clip_path)
        return {
            "file_path": str(output_clip_path),
            "file_name": output_clip_path.name,
            "file_size": file_size,
            "duration": round(target_duration, 2),
            "resolution": f"{out_w}x{out_h}",
            "thumbnail_path": str(thumb_path) if thumb_path.exists() else None,
        }
