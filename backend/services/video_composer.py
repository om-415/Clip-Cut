import os
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

class VideoComposerService:
    @staticmethod
    def escape_filter_path(path: Path) -> str:
        """
        Escapes Windows file path for FFmpeg filtergraph (ass/subtitles filter).
        Example: D:\yt\sub.ass -> D\\:/yt/sub.ass
        """
        p_str = str(path.resolve()).replace("\\", "/")
        # Escape colon after drive letter: D: -> D\\:
        if len(p_str) > 1 and p_str[1] == ":":
            p_str = p_str[0] + "\\:" + p_str[2:]
        # Escape single quotes and brackets
        p_str = p_str.replace("'", "\\'").replace("[", "\\[").replace("]", "\\]")
        return p_str

    @classmethod
    def compose_vertical_clip(
        cls,
        source_video: Path,
        start_time: float,
        end_time: float,
        output_clip_path: Path,
        layout_mode: str = "split_stack",
        facecam_box: Optional[Dict[str, int]] = None,
        source_width: int = 1920,
        source_height: int = 1080,
        subtitles_ass_path: Optional[Path] = None,
        out_width: int = 1080,
        out_height: int = 1920,
    ) -> Path:
        """
        Composes a high-quality vertical 9:16 MP4 (1080x1920) clip.
        Creates balanced vertical composition:
        - Streamer facecam on top (1080x720)
        - Gameplay on bottom (1080x1200)
        - Burned-in synchronized subtitles
        """
        output_clip_path.parent.mkdir(parents=True, exist_ok=True)
        duration = max(0.5, end_time - start_time)

        # 1. Determine Facecam and Gameplay coordinates
        has_facecam = facecam_box is not None and facecam_box.get("w", 0) > 0 and facecam_box.get("h", 0) > 0

        # Build FFmpeg video filter graph based on layout mode
        filters = []

        if layout_mode == "split_stack" and has_facecam:
            # Facecam crop box
            fx = max(0, min(source_width - 10, facecam_box["x"]))
            fy = max(0, min(source_height - 10, facecam_box["y"]))
            fw = max(10, min(source_width - fx, facecam_box["w"]))
            fh = max(10, min(source_height - fy, facecam_box["h"]))

            # Gameplay crop: Center region of 16:9 gameplay (avoiding extreme edges)
            gw = int(source_width * 0.75)
            gh = int(source_height)
            gx = int((source_width - gw) / 2)
            gy = 0

            # Filter:
            # [top]: crop facecam -> scale to 1080x720
            # [bottom]: crop gameplay -> scale to 1080x1200
            # vstack -> 1080x1920 + subtle sleek divider + standard 9:16 SAR/DAR
            filter_str = (
                f"[0:v]crop={fw}:{fh}:{fx}:{fy},"
                f"scale={out_width}:720:force_original_aspect_ratio=increase,"
                f"crop={out_width}:720[cam];"
                f"[0:v]crop={gw}:{gh}:{gx}:{gy},"
                f"scale={out_width}:1200:force_original_aspect_ratio=increase,"
                f"crop={out_width}:1200[game];"
                f"[cam][game]vstack=inputs=2,"
                f"drawbox=y=718:h=4:color=0x1E1E2E@0.9:t=fill,"
                f"setsar=1,setdar=9/16[base]"
            )
            filters.append(filter_str)
            last_pad = "[base]"

        elif layout_mode == "overlay_pip" and has_facecam:
            # Facecam overlay in top-right with rounded border
            fx = facecam_box["x"]
            fy = facecam_box["y"]
            fw = facecam_box["w"]
            fh = facecam_box["h"]

            filter_str = (
                # Blurred background
                f"[0:v]scale={out_width}:{out_height}:force_original_aspect_ratio=increase,"
                f"crop={out_width}:{out_height},boxblur=25:5[bg];"
                # Centered gameplay
                f"[0:v]scale={out_width}:-1[main_game];"
                # Facecam pip (380x280)
                f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale=380:280:force_original_aspect_ratio=increase,"
                f"crop=380:280,drawbox=x=0:y=0:w=380:h=280:color=white@0.8:t=3[pip];"
                f"[bg][main_game]overlay=(W-w)/2:(H-h)/2[bg_game];"
                f"[bg_game][pip]overlay=W-w-40:80,"
                f"setsar=1,setdar=9/16[base]"
            )
            filters.append(filter_str)
            last_pad = "[base]"

        else:
            # Blurred background fill + crisp centered gameplay (Universal reliable layout)
            filter_str = (
                f"[0:v]scale={out_width}:{out_height}:force_original_aspect_ratio=increase,"
                f"crop={out_width}:{out_height},boxblur=25:5[bg];"
                f"[0:v]scale={out_width}:-1[game];"
                f"[bg][game]overlay=(W-w)/2:(H-h)/2,"
                f"setsar=1,setdar=9/16[base]"
            )
            filters.append(filter_str)
            last_pad = "[base]"

        # 2. Add Subtitles filter if ASS file exists
        if subtitles_ass_path and subtitles_ass_path.exists():
            escaped_ass = cls.escape_filter_path(subtitles_ass_path)
            filters.append(f"{last_pad}subtitles='{escaped_ass}',setsar=1,setdar=9/16[outv]")
            final_map_v = "[outv]"
        else:
            final_map_v = last_pad

        complete_filter = ";".join(filters)

        # Assemble full FFmpeg command
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", str(max(0.0, start_time)),
            "-t", str(duration),
            "-i", str(source_video),
            "-filter_complex", complete_filter,
            "-map", final_map_v,
            "-map", "0:a?",
            "-aspect", "9:16",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "21",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "44100",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_clip_path),
        ]

        print(f"[VideoComposer] Executing vertical rendering ({layout_mode}): {output_clip_path.name}")
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0 or not output_clip_path.exists():
            print(f"[VideoComposer] FFmpeg Error: {res.stderr}")
            # If complex filter failed (e.g. font / ass issue), attempt fallback without subtitles
            if subtitles_ass_path and subtitles_ass_path.exists():
                print("[VideoComposer] Retrying without subtitles fallback...")
                return cls.compose_vertical_clip(
                    source_video=source_video,
                    start_time=start_time,
                    end_time=end_time,
                    output_clip_path=output_clip_path,
                    layout_mode=layout_mode,
                    facecam_box=facecam_box,
                    source_width=source_width,
                    source_height=source_height,
                    subtitles_ass_path=None,
                    out_width=out_width,
                    out_height=out_height
                )
            raise RuntimeError(f"FFmpeg vertical composition failed: {res.stderr}")

        print(f"[VideoComposer] Successfully generated vertical clip: {output_clip_path} ({os.path.getsize(output_clip_path):,} bytes)")
        return output_clip_path
