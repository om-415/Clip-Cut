import os
import json
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, List
from backend.app.config import CLIPS_DIR, SUBTITLES_DIR
from backend.services.video_service import VideoService
from backend.services.subtitle_generator import SubtitleGeneratorService
from backend.services.video_composer import VideoComposerService

class ClipGeneratorService:
    @staticmethod
    def generate_clip_for_highlight(
        project_id: str,
        highlight_id: str,
        source_video_path: Path,
        start_time: float,
        end_time: float,
        category: str,
        transcript_segments: List[Dict[str, Any]],
        facecam_box: Optional[Dict[str, int]] = None,
        layout_mode: str = "split_stack",
        subtitle_style: str = "gaming_bold",
        source_width: int = 1920,
        source_height: int = 1080,
        is_pre_cut: bool = False
    ) -> Dict[str, Any]:
        """
        Orchestrates full clip creation for a specific highlight:
        1. Subtitle generation (.ass)
        2. Vertical video composition (1080x1920 MP4)
        3. Thumbnail extraction
        """
        clip_id = str(uuid.uuid4())[:8]
        clean_category = "".join(c for c in category if c.isalnum() or c in ("_", "-")).lower()
        clip_filename = f"clip_{clean_category}_{clip_id}.mp4"

        project_clips_dir = CLIPS_DIR / project_id
        project_clips_dir.mkdir(parents=True, exist_ok=True)
        out_clip_path = project_clips_dir / clip_filename

        # 1. Filter transcript segments that overlap with this clip
        relevant_segments = []
        for s in transcript_segments:
            if s["end"] >= start_time and s["start"] <= end_time:
                relevant_segments.append(s)

        # 2. Generate synchronized subtitles
        ass_path = None
        if relevant_segments:
            project_sub_dir = SUBTITLES_DIR / project_id
            project_sub_dir.mkdir(parents=True, exist_ok=True)
            ass_path = project_sub_dir / f"sub_{clip_id}.ass"
            
            SubtitleGeneratorService.generate_ass_subtitles(
                segments=relevant_segments,
                output_ass_path=ass_path,
                clip_start_offset=start_time,
                style_name=subtitle_style
            )

        # 3. Compose vertical clip
        # When is_pre_cut is True, the input file already starts at 0 and lasts (end_time - start_time)
        comp_start = 0.0 if is_pre_cut else start_time
        comp_end = (end_time - start_time) if is_pre_cut else end_time

        VideoComposerService.compose_vertical_clip(
            source_video=source_video_path,
            start_time=comp_start,
            end_time=comp_end,
            output_clip_path=out_clip_path,
            layout_mode=layout_mode,
            facecam_box=facecam_box,
            source_width=source_width,
            source_height=source_height,
            subtitles_ass_path=ass_path
        )

        # 4. Generate clip thumbnail
        thumb_filename = f"thumb_{clip_id}.jpg"
        thumb_path = project_clips_dir / thumb_filename
        VideoService.extract_thumbnail(
            video_path=out_clip_path,
            timestamp=min(1.0, (end_time - start_time) / 2.0),
            output_path=thumb_path,
            width=540
        )

        file_size = os.path.getsize(out_clip_path) if out_clip_path.exists() else 0
        duration = round(end_time - start_time, 2)

        return {
            "clip_id": clip_id,
            "file_path": str(out_clip_path),
            "file_name": clip_filename,
            "file_size": file_size,
            "duration": duration,
            "resolution": "1080x1920",
            "subtitle_style": subtitle_style,
            "layout_type": layout_mode,
            "thumbnail_path": str(thumb_path) if thumb_path.exists() else None,
        }
