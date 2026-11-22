import os
import json
import uuid
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable
from concurrent.futures import ThreadPoolExecutor

from backend.app.config import DOWNLOADS_DIR, TEMP_DIR, CLIPS_DIR
from backend.app.database import SessionLocal
from backend.models.schema import Project, Highlight, Clip
from backend.services.video_service import VideoService
from backend.services.audio_analysis import AudioAnalysisService
from backend.services.speech_analysis import SpeechAnalysisService
from backend.services.face_detection import FaceDetectionService
from backend.services.gameplay_analysis import GameplayAnalysisService
from backend.services.highlight_detection import HighlightDetectionService
from backend.services.clip_generator import ClipGeneratorService

# Global executor for thread-based compute tasks (video processing & AI inference)
_thread_pool = ThreadPoolExecutor(max_workers=2)

class PipelineManager:
    # In-memory connection manager for WebSocket listeners
    _listeners: Dict[str, List[Any]] = {}
    _main_loop: Optional[asyncio.AbstractEventLoop] = None

    @classmethod
    def register_listener(cls, project_id: str, websocket: Any):
        if project_id not in cls._listeners:
            cls._listeners[project_id] = []
        cls._listeners[project_id].append(websocket)

    @classmethod
    def unregister_listener(cls, project_id: str, websocket: Any):
        if project_id in cls._listeners:
            cls._listeners[project_id] = [ws for ws in cls._listeners[project_id] if ws != websocket]

    @classmethod
    async def broadcast_progress(cls, project_id: str, progress: float, step: str, message: str = ""):
        payload = {
            "project_id": project_id,
            "progress": round(progress, 1),
            "step": step,
            "message": message,
        }
        # Update database project record
        try:
            db = SessionLocal()
            proj = db.query(Project).filter(Project.id == project_id).first()
            if proj:
                proj.progress = progress
                proj.current_step = step
                db.commit()
            db.close()
        except Exception as e:
            print(f"[PipelineManager] DB update error: {e}")

        # Broadcast to active WebSockets
        listeners = cls._listeners.get(project_id, [])
        for ws in listeners:
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    @classmethod
    def run_pipeline_sync(cls, project_id: str, loop: Optional[asyncio.AbstractEventLoop] = None):
        """
        Runs the end-to-end AI clipping pipeline synchronously inside the worker thread.
        Dispatches async progress updates to WebSockets.
        """
        def update_progress(percent: float, step: str, message: str = ""):
            target_loop = loop or cls._main_loop
            if target_loop and target_loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    cls.broadcast_progress(project_id, percent, step, message),
                    target_loop
                )
            else:
                try:
                    db_up = SessionLocal()
                    proj = db_up.query(Project).filter(Project.id == project_id).first()
                    if proj:
                        proj.progress = percent
                        proj.current_step = step
                        db_up.commit()
                    db_up.close()
                except Exception:
                    pass

        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            db.close()
            return

        settings = json.loads(project.settings_json or "{}")
        num_clips = int(settings.get("num_clips", 3))
        target_clip_duration = float(settings.get("clip_duration", 35.0))
        subtitle_style = settings.get("subtitle_style", "gaming_bold")
        layout_mode = settings.get("layout_mode", "split_stack")
        auto_generate_clips = settings.get("auto_generate_clips", True)
        data_saver_mode = bool(settings.get("data_saver_mode", True)) and (project.source_type == "youtube")

        try:
            project.status = "processing"
            db.commit()

            project_download_dir = DOWNLOADS_DIR / project_id
            project_download_dir.mkdir(parents=True, exist_ok=True)
            audio_wav_path = TEMP_DIR / project_id / "audio_16k.wav"

            # -------------------------------------------------------------
            # STEP 1 & 2: Stream Retrieval & Audio Extraction
            # -------------------------------------------------------------
            if data_saver_mode:
                update_progress(5.0, "Mobile Data Saver", "Downloading stream audio only (~120MB instead of 5GB+)...")
                def audio_dl_hook(p, speed):
                    update_progress(5.0 + (p * 0.15), "Mobile Data Saver", f"Downloading audio track: {p:.1f}%")

                VideoService.download_audio_only(
                    url=project.source_url,
                    output_path=audio_wav_path,
                    progress_callback=audio_dl_hook
                )
                project.audio_path = str(audio_wav_path)

                # Determine accurate stream duration from audio WAV
                probe_cmd = [
                    "ffprobe", "-v", "quiet",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(audio_wav_path)
                ]
                res = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    total_duration = float(res.stdout.strip())
                except Exception:
                    total_duration = float(project.duration) if project.duration else 300.0

                project.duration = total_duration
                db.commit()
                video_path = None
                source_width = 1920
                source_height = 1080
            else:
                update_progress(5.0, "Downloading Stream", "Connecting to video stream source...")
                if project.source_type == "youtube":
                    def dl_hook(p, speed):
                        update_progress(5.0 + (p * 0.15), "Downloading Stream", f"Downloading: {p:.1f}%")

                    video_path = VideoService.download_youtube_video(
                        url=project.source_url,
                        output_dir=project_download_dir,
                        progress_callback=dl_hook
                    )
                else:
                    video_path = Path(project.video_path)

                project.video_path = str(video_path)
                db.commit()

                update_progress(22.0, "Audio Extraction", "Extracting high-fidelity audio track for AI...")
                probe_info = VideoService.probe_video(video_path)
                total_duration = probe_info["duration"]
                source_width = probe_info["width"]
                source_height = probe_info["height"]
                project.duration = total_duration
                db.commit()

                VideoService.extract_audio_wav(video_path, audio_wav_path)
                project.audio_path = str(audio_wav_path)
                db.commit()

            # -------------------------------------------------------------
            # STEP 3: Multi-Signal Audio Analysis
            # -------------------------------------------------------------
            update_progress(30.0, "Audio Analysis", "Detecting volume surges, screams, and crowd hype...")
            audio_timeline = AudioAnalysisService.analyze_audio(audio_wav_path)

            # -------------------------------------------------------------
            # STEP 4: Whisper Speech Recognition & Excitement Scoring
            # -------------------------------------------------------------
            def whisper_progress(pct, msg):
                update_progress(pct, "Speech Recognition", msg)

            speech_segments = SpeechAnalysisService.transcribe_and_analyze(
                wav_path=audio_wav_path,
                audio_timeline=audio_timeline,
                progress_callback=whisper_progress
            )

            # -------------------------------------------------------------
            # STEP 5: Visual Analysis / Signal Fusion
            # -------------------------------------------------------------
            if data_saver_mode:
                update_progress(62.0, "Signal Fusion", "Correlating acoustic energy peaks with dialogue hype...")
                facecam_info = {"has_facecam": False, "box": None}
                facecam_box = None
                motion_timeline = []
                reaction_timeline = []
                custom_weights = {"audio": 0.55, "speech": 0.45, "visual": 0.0, "face": 0.0, "gameplay": 0.0}
            else:
                update_progress(62.0, "Visual Analysis", "Analyzing gameplay action and locating streamer facecam...")
                facecam_info = FaceDetectionService.detect_streamer_facecam(video_path)
                facecam_box = facecam_info["box"] if facecam_info["has_facecam"] else None
                motion_timeline = GameplayAnalysisService.analyze_motion_and_action(video_path)
                reaction_timeline = FaceDetectionService.compute_facial_reactions(video_path, facecam_box)
                custom_weights = None

            # -------------------------------------------------------------
            # STEP 6: Multi-Signal Highlight Scoring & Detection
            # -------------------------------------------------------------
            update_progress(78.0, "Highlight Detection", "Ranking entertaining moments and removing duplicates...")
            highlights_data = HighlightDetectionService.detect_highlights(
                total_duration=total_duration,
                audio_timeline=audio_timeline,
                speech_segments=speech_segments,
                motion_timeline=motion_timeline,
                reaction_timeline=reaction_timeline,
                target_clip_duration=target_clip_duration,
                top_k=num_clips,
                custom_weights=custom_weights
            )

            # Save highlights to database
            db_highlights = []
            for h in highlights_data:
                h_id = str(uuid.uuid4())
                thumb_path = CLIPS_DIR / project_id / f"highlight_{h_id[:8]}.jpg"
                if video_path and video_path.exists():
                    VideoService.extract_thumbnail(video_path, h["start_time"] + 2.0, thumb_path)

                hl_record = Highlight(
                    id=h_id,
                    project_id=project_id,
                    start_time=h["start_time"],
                    end_time=h["end_time"],
                    duration=h["duration"],
                    score=h["score"],
                    category=h["category"],
                    description=h["description"],
                    audio_score=h["sub_scores"]["audio"],
                    speech_score=h["sub_scores"]["speech"],
                    visual_score=h["sub_scores"]["visual"],
                    face_score=h["sub_scores"]["face"],
                    gameplay_score=h["sub_scores"]["gameplay"],
                    transcript_snippet=h["transcript"],
                    thumbnail_path=str(thumb_path) if thumb_path.exists() else None,
                    facecam_box_json=json.dumps(facecam_info),
                    is_accepted=True,
                    is_exported=False
                )
                db.add(hl_record)
                db_highlights.append(hl_record)

            db.commit()

            # -------------------------------------------------------------
            # STEP 7: Automated Vertical Clip Generation (9:16)
            # -------------------------------------------------------------
            if auto_generate_clips and db_highlights:
                update_progress(82.0, "Clip Generation", "Rendering 1080x1920 vertical composition & subtitles...")
                total_to_gen = len(db_highlights)
                successful_clips = 0

                for idx, hl in enumerate(db_highlights):
                    step_pct = 82.0 + ((idx + 1) / total_to_gen * 16.0)

                    try:
                        if data_saver_mode:
                            update_progress(step_pct, "Clip Generation", f"Downloading 35s stream slice for Clip {idx + 1} of {total_to_gen} (~8MB)...")
                            raw_sec_path = project_download_dir / f"section_{hl.id[:8]}.mp4"
                            raw_sec_path = VideoService.download_video_section(
                                url=project.source_url,
                                start_sec=hl.start_time,
                                end_sec=hl.end_time,
                                output_path=raw_sec_path
                            )

                            sec_probe = VideoService.probe_video(raw_sec_path)
                            clip_source_w = sec_probe.get("width", 1920)
                            clip_source_h = sec_probe.get("height", 1080)

                            sec_facecam = FaceDetectionService.detect_streamer_facecam(raw_sec_path)
                            sec_face_box = sec_facecam["box"] if sec_facecam["has_facecam"] else None
                            hl.facecam_box_json = json.dumps(sec_facecam)
                            db.commit()

                            update_progress(step_pct, "Clip Generation", f"Composing vertical 9:16 layout for Clip {idx + 1} of {total_to_gen}...")
                            clip_res = ClipGeneratorService.generate_clip_for_highlight(
                                project_id=project_id,
                                highlight_id=hl.id,
                                source_video_path=raw_sec_path,
                                start_time=hl.start_time,
                                end_time=hl.end_time,
                                category=hl.category,
                                transcript_segments=speech_segments,
                                facecam_box=sec_face_box,
                                layout_mode=layout_mode,
                                subtitle_style=subtitle_style,
                                source_width=clip_source_w,
                                source_height=clip_source_h,
                                is_pre_cut=True
                            )
                        else:
                            update_progress(step_pct, "Clip Generation", f"Rendering clip {idx + 1} of {total_to_gen}...")
                            clip_res = ClipGeneratorService.generate_clip_for_highlight(
                                project_id=project_id,
                                highlight_id=hl.id,
                                source_video_path=video_path,
                                start_time=hl.start_time,
                                end_time=hl.end_time,
                                category=hl.category,
                                transcript_segments=speech_segments,
                                facecam_box=facecam_box,
                                layout_mode=layout_mode,
                                subtitle_style=subtitle_style,
                                source_width=source_width,
                                source_height=source_height,
                                is_pre_cut=False
                            )

                        hl.thumbnail_path = clip_res["thumbnail_path"]
                        hl.is_exported = True

                        clip_record = Clip(
                            id=clip_res["clip_id"],
                            user_id=project.user_id,
                            project_id=project_id,
                            highlight_id=hl.id,
                            file_path=clip_res["file_path"],
                            file_name=clip_res["file_name"],
                            file_size=clip_res["file_size"],
                            duration=clip_res["duration"],
                            resolution=clip_res["resolution"],
                            subtitle_style=clip_res["subtitle_style"],
                            layout_type=clip_res["layout_type"],
                            thumbnail_path=clip_res["thumbnail_path"]
                        )
                        db.add(clip_record)
                        db.commit()
                        successful_clips += 1

                        # Autonomous Pipeline: Generate metadata & enqueue in sequential upload queue
                        try:
                            from backend.services.metadata_generator import MetadataGeneratorService
                            from backend.services.scheduler_service import SchedulerService

                            clip_meta = MetadataGeneratorService.generate_metadata_for_clip(
                                clip_category=hl.category,
                                stream_title=project.title,
                                channel_name=project.channel_name or "Streamer",
                                transcript_snippet=hl.transcript_snippet or "",
                                clip_duration=clip_record.duration
                            )
                            SchedulerService.enqueue_clip(
                                db=db,
                                clip_id=clip_record.id,
                                project_id=project_id,
                                metadata=clip_meta
                            )
                        except Exception as meta_err:
                            print(f"[PipelineManager] Metadata/queue enqueue notice: {meta_err}")

                    except Exception as clip_err:
                        print(f"[PipelineManager] Warning: Failed to render highlight {hl.id} (Clip {idx + 1}): {clip_err}")
                        import traceback
                        traceback.print_exc()
                        continue

                if successful_clips == 0 and total_to_gen > 0:
                    raise RuntimeError("No vertical clips could be rendered from the detected highlights.")

            # -------------------------------------------------------------
            # STEP 8: Pipeline Completed
            # -------------------------------------------------------------
            project.status = "completed"
            project.progress = 100.0
            project.current_step = "Completed"
            db.commit()
            update_progress(100.0, "Completed", f"Successfully generated {successful_clips} vertical clips!")
            print(f"[PipelineManager] Pipeline finished successfully for project {project_id}")

        except Exception as e:
            import traceback
            traceback.print_exc()
            project.status = "failed"
            project.error_message = str(e)
            db.commit()
            update_progress(project.progress, "Failed", f"Error: {str(e)}")
            print(f"[PipelineManager] Pipeline failed for project {project_id}: {e}")

        finally:
            db.close()

    @classmethod
    def start_pipeline(cls, project_id: str):
        """
        Dispatches background pipeline execution to thread pool.
        """
        target_loop = None
        try:
            target_loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                target_loop = asyncio.get_event_loop()
            except RuntimeError:
                target_loop = cls._main_loop

        _thread_pool.submit(cls.run_pipeline_sync, project_id, target_loop)
