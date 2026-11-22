import os
import json
import uuid
import shutil
import hashlib
import hmac
import base64
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, UploadFile, File, Form, Header
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.config import (
    BASE_DIR, CLIPS_DIR, DOWNLOADS_DIR, TEMP_DIR, 
    DEFAULT_TARGET_CLIP_DURATION, SUBTITLE_STYLES, LAYOUT_MODES
)
from backend.app.database import engine, Base, get_db, SessionLocal
from backend.models.schema import (
    User, Project, Highlight, Clip, YouTubeAccount, UploadQueueItem, PublishingSettings, InstagramWaitlist
)
from backend.services.video_service import VideoService
from backend.services.clip_generator import ClipGeneratorService
from backend.services.pipeline_manager import PipelineManager
from backend.services.connectivity_service import ConnectivityService
from backend.services.youtube_service import YouTubeService
from backend.services.scheduler_service import SchedulerService
from backend.services.system_service import SystemInfoService
from backend.services.clip_editor_service import ClipEditorService

# Ensure tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ClipCut API",
    version="1.0.0",
    description="Automated AI-Powered Stream Clipping and Vertical Video Engine"
)

@app.on_event("startup")
async def on_startup():
    import asyncio
    try:
        PipelineManager._main_loop = asyncio.get_running_loop()
        print("[Server] Main event loop registered with PipelineManager.")
    except Exception as e:
        print(f"[Server] Startup event loop warning: {e}")

    # Launch autonomous queue processor in background
    async def queue_daemon():
        while True:
            try:
                db_tick = SessionLocal()
                SchedulerService.process_queue_tick(db_tick)
                db_tick.close()
            except Exception as d_err:
                pass
            await asyncio.sleep(25)

    asyncio.create_task(queue_daemon())
    print("[Server] Autonomous Queue Daemon running in background.")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# CORS Configuration - Safe production origins
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
if "*" not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount static media directories
app.mount("/media/clips", StaticFiles(directory=str(CLIPS_DIR)), name="clips")
app.mount("/media/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")
app.mount("/media/temp", StaticFiles(directory=str(TEMP_DIR)), name="temp")

# Pydantic schemas
class MetadataRequest(BaseModel):
    url: str

class ProjectCreateRequest(BaseModel):
    url: str
    num_clips: int = 3
    clip_duration: float = 35.0
    subtitle_style: str = "gaming_bold"
    layout_mode: str = "split_stack"
    auto_generate_clips: bool = True
    data_saver_mode: bool = True
    title: Optional[str] = None
    channel: Optional[str] = None
    duration: Optional[float] = None
    thumbnail: Optional[str] = None

class HighlightAdjustRequest(BaseModel):
    start_time: float
    end_time: float
    category: Optional[str] = None
    description: Optional[str] = None

class GenerateClipRequest(BaseModel):
    subtitle_style: Optional[str] = "gaming_bold"
    layout_mode: Optional[str] = "split_stack"

class YouTubeConnectRequest(BaseModel):
    client_id: str
    client_secret: str
    code: str
    redirect_uri: str

class QueueUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[List[str]] = None
    caption: Optional[str] = None
    scheduled_time: Optional[str] = None

class ClipEditRenderRequest(BaseModel):
    title: Optional[str] = None
    start_trim: float = 0.0
    end_trim: Optional[float] = None
    aspect_ratio: str = "9:16"  # "9:16", "original_16:9", "1:1"
    layout_mode: str = "fit_center"  # "split_stack", "overlay_pip", "blurred_fill", "fit_center"
    volume_multiplier: float = 1.0
    subtitles_enabled: bool = True
    subtitle_text: Optional[str] = None
    subtitle_font: str = "Impact"
    subtitle_font_size: int = 50
    subtitle_primary_color: str = "#FFFF00"
    subtitle_outline_color: str = "#000000"
    subtitle_has_box_bg: bool = False
    subtitle_position: str = "bottom"

class InstagramWaitlistRequest(BaseModel):
    email: str

class PublishingSettingsRequest(BaseModel):
    publishing_mode: str
    frequency: str
    preferred_hour: int
    privacy_status: str
    default_title_template: Optional[str] = ""
    default_desc_template: Optional[str] = ""
    default_tags: Optional[List[str]] = None
    auto_schedule_enabled: Optional[bool] = True

# -------------------------------------------------------------
# User Authentication Models & Token Security
# -------------------------------------------------------------

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""

class UserLoginRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None

AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "fragflash-jwt-production-secret-2026")

def hash_user_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()

def create_auth_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": int(time.time()) + (86400 * 30)
    }
    raw = json.dumps(payload, separators=(',', ':')).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"

def verify_auth_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.strip().split(".")
        if len(parts) != 2:
            return None
        b64_payload, sig = parts
        expected_sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        padded = b64_payload + "=" * ((4 - len(b64_payload) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def get_current_user_optional(
    authorization: Optional[str] = Header(None), 
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not authorization:
        # Fall back to first user if exists
        return db.query(User).filter(User.is_active == True).first()
    token = authorization.replace("Bearer ", "").strip()
    payload = verify_auth_token(token)
    if not payload:
        return db.query(User).filter(User.is_active == True).first()
    user = db.query(User).filter(User.id == payload["user_id"], User.is_active == True).first()
    return user or db.query(User).filter(User.is_active == True).first()

def get_current_user_required(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization:
        user = db.query(User).filter(User.is_active == True).first()
        if user:
            return user
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    token = authorization.replace("Bearer ", "").strip()
    payload = verify_auth_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid token. Please log in again.")
    user = db.query(User).filter(User.id == payload["user_id"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")
    return user


# -------------------------------------------------------------
# REST API Endpoints
# -------------------------------------------------------------

@app.get("/api/health")
def health_check():
    """Liveness probe: returns 200 when backend HTTP process is active."""
    return {
        "status": "healthy",
        "service": "ClipCut AI Stream Studio",
        "version": "1.0.0-beta",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe: validates database connectivity and FFmpeg binary."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    ffmpeg_ok = shutil.which("ffmpeg") is not None
    if not db_ok or not ffmpeg_ok:
        raise HTTPException(
            status_code=503,
            detail={"ready": False, "database": db_ok, "ffmpeg": ffmpeg_ok}
        )

    return {
        "ready": True,
        "database": db_ok,
        "ffmpeg": ffmpeg_ok,
        "directories": {
            "clips": CLIPS_DIR.exists(),
            "downloads": DOWNLOADS_DIR.exists(),
            "temp": TEMP_DIR.exists(),
        }
    }

@app.get("/api/system/info")
def get_system_info():
    """
    Returns genuine, safe system telemetry:
    CPU, RAM, GPU/CUDA detection, FFmpeg version, disk space, and application storage.
    """
    return SystemInfoService.get_system_telemetry()

@app.post("/api/waitlist/instagram")
def join_instagram_waitlist(req: InstagramWaitlistRequest, db: Session = Depends(get_db)):
    """
    Saves user email for the upcoming Instagram Reels auto-publishing beta.
    """
    email_clean = req.email.strip().lower()
    import re
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
        raise HTTPException(status_code=400, detail="Please provide a valid email address.")

    existing = db.query(InstagramWaitlist).filter(InstagramWaitlist.email == email_clean).first()
    if not existing:
        entry = InstagramWaitlist(
            id=str(uuid.uuid4())[:12],
            email=email_clean,
            created_at=datetime.utcnow()
        )
        db.add(entry)
        db.commit()

    return {
        "status": "success",
        "message": "You're on the early access list! We will notify you when Instagram Reels automation launches."
    }

# -------------------------------------------------------------
# User Authentication Endpoints (Email + Google Sign-In)
# -------------------------------------------------------------

@app.post("/api/auth/register")
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user account with email and password."""
    clean_email = req.email.strip().lower()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    salt = uuid.uuid4().hex[:16]
    hashed = hash_user_password(req.password, salt)
    user_id = str(uuid.uuid4())
    
    new_user = User(
        id=user_id,
        email=clean_email,
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        hashed_password=hashed,
        salt=salt,
        auth_provider="email",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_auth_token(new_user.id, new_user.email)
    return {
        "status": "success",
        "token": token,
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
            "auth_provider": new_user.auth_provider,
            "avatar_url": new_user.avatar_url
        }
    }

@app.post("/api/auth/login")
def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates an existing user account with email and password."""
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not user.hashed_password or not user.salt:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    computed = hash_user_password(req.password, user.salt)
    if not hmac.compare_digest(computed, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token = create_auth_token(user.id, user.email)
    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "auth_provider": user.auth_provider,
            "avatar_url": user.avatar_url
        }
    }

@app.post("/api/auth/google")
def google_auth_endpoint(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google Authentication Endpoint:
    Logs in or registers user via Google Sign-In with profile details or credentials.
    """
    email = (req.email or "").strip().lower()
    if not email:
        email = f"creator_{str(uuid.uuid4())[:8]}@gmail.com"
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            first_name=req.first_name or "Creator",
            last_name=req.last_name or "",
            google_id=req.google_id or str(uuid.uuid4())[:12],
            avatar_url=req.avatar_url or "https://lh3.googleusercontent.com/a/default-user",
            auth_provider="google",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if req.avatar_url and not user.avatar_url:
            user.avatar_url = req.avatar_url
        if req.google_id and not user.google_id:
            user.google_id = req.google_id
        db.commit()

    token = create_auth_token(user.id, user.email)
    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "auth_provider": user.auth_provider,
            "avatar_url": user.avatar_url
        }
    }

@app.get("/api/auth/me")
def get_current_user_profile(current_user: User = Depends(get_current_user_required)):
    """Retrieves the profile of the authenticated user."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "auth_provider": current_user.auth_provider,
        "avatar_url": current_user.avatar_url
    }

@app.post("/api/metadata")
def get_video_metadata(req: MetadataRequest):
    """
    Retrieves video metadata (title, channel, duration, thumbnail) from YouTube URL.
    """
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    
    try:
        metadata = VideoService.get_youtube_metadata(req.url.strip())
        return metadata
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/projects")
async def create_project(
    req: ProjectCreateRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Creates a new project and triggers autonomous highlight extraction & clipping.
    Associates the project with the active user account.
    """
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    # 1. Fetch or use provided metadata
    meta = None
    if req.title and req.duration:
        meta = {
            "title": req.title,
            "channel": req.channel or "Unknown Channel",
            "duration": float(req.duration),
            "thumbnail": req.thumbnail or "",
        }
    else:
        try:
            meta = VideoService.get_youtube_metadata(req.url.strip())
        except Exception as e:
            # Resilient fallback so transient network blips don't block project creation
            meta = {
                "title": req.title or "YouTube Stream",
                "channel": req.channel or "Live Streamer",
                "duration": float(req.duration) if req.duration else 0.0,
                "thumbnail": req.thumbnail or "",
            }

    project_id = str(uuid.uuid4())[:12]
    settings = {
        "num_clips": req.num_clips,
        "clip_duration": req.clip_duration,
        "subtitle_style": req.subtitle_style,
        "layout_mode": req.layout_mode,
        "auto_generate_clips": req.auto_generate_clips,
        "data_saver_mode": req.data_saver_mode,
    }

    project = Project(
        id=project_id,
        user_id=current_user.id if current_user else None,
        title=meta.get("title", "YouTube Stream"),
        source_type="youtube",
        source_url=req.url.strip(),
        channel_name=meta.get("channel", "Unknown Channel"),
        duration=meta.get("duration", 0.0),
        thumbnail_url=meta.get("thumbnail", ""),
        status="queued",
        progress=0.0,
        current_step="Queued",
        settings_json=json.dumps(settings)
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Launch background AI processing pipeline
    PipelineManager.start_pipeline(project_id)

    return {
        "project_id": project.id,
        "title": project.title,
        "channel": project.channel_name,
        "duration": project.duration,
        "thumbnail": project.thumbnail_url,
        "status": project.status,
    }

@app.get("/api/projects")
def list_projects(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Lists all projects associated with the active user (or all projects if unauthenticated).
    """
    query = db.query(Project)
    if current_user:
        query = query.filter((Project.user_id == current_user.id) | (Project.user_id == None))
    projects = query.order_by(Project.created_at.desc()).all()
    results = []
    for p in projects:
        results.append({
            "id": p.id,
            "title": p.title,
            "channel": p.channel_name,
            "duration": p.duration,
            "thumbnail_url": p.thumbnail_url,
            "status": p.status,
            "progress": p.progress,
            "current_step": p.current_step,
            "error_message": p.error_message,
            "highlight_count": len(p.highlights),
            "clip_count": len(p.clips),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return results

@app.get("/api/projects/{project_id}")
def get_project_details(project_id: str, db: Session = Depends(get_db)):
    """
    Retrieves full details of a project including all detected highlights and generated clips.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    highlights_data = []
    for h in project.highlights:
        # Convert local thumbnail path to media URL
        thumb_url = None
        if h.thumbnail_path and os.path.exists(h.thumbnail_path):
            rel_path = os.path.relpath(h.thumbnail_path, CLIPS_DIR).replace("\\", "/")
            thumb_url = f"/media/clips/{rel_path}"

        highlights_data.append({
            "id": h.id,
            "start_time": h.start_time,
            "end_time": h.end_time,
            "duration": h.duration,
            "score": h.score,
            "category": h.category,
            "description": h.description,
            "audio_score": h.audio_score,
            "speech_score": h.speech_score,
            "visual_score": h.visual_score,
            "face_score": h.face_score,
            "gameplay_score": h.gameplay_score,
            "transcript": h.transcript_snippet,
            "thumbnail_url": thumb_url,
            "is_accepted": h.is_accepted,
            "is_exported": h.is_exported,
        })

    clips_data = []
    for c in project.clips:
        is_edited = bool(c.is_edited and c.edited_file_path and os.path.exists(c.edited_file_path))
        active_file = c.edited_file_path if is_edited else c.file_path
        active_thumb = c.edited_thumbnail_path if (is_edited and c.edited_thumbnail_path and os.path.exists(c.edited_thumbnail_path)) else c.thumbnail_path

        rel_active = os.path.relpath(active_file, CLIPS_DIR).replace("\\", "/") if active_file else ""
        rel_orig = os.path.relpath(c.original_file_path or c.file_path, CLIPS_DIR).replace("\\", "/") if c.file_path else ""

        thumb_url = None
        if active_thumb and os.path.exists(active_thumb):
            rel_thumb = os.path.relpath(active_thumb, CLIPS_DIR).replace("\\", "/")
            thumb_url = f"/media/clips/{rel_thumb}"

        clips_data.append({
            "id": c.id,
            "highlight_id": c.highlight_id,
            "file_name": c.file_name,
            "clip_url": f"/media/clips/{rel_active}",
            "original_clip_url": f"/media/clips/{rel_orig}",
            "is_edited": is_edited,
            "thumbnail_url": thumb_url,
            "file_size": c.file_size,
            "duration": c.duration,
            "resolution": c.resolution,
            "subtitle_style": c.subtitle_style,
            "layout_type": c.layout_type,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {
        "id": project.id,
        "title": project.title,
        "channel": project.channel_name,
        "duration": project.duration,
        "thumbnail_url": project.thumbnail_url,
        "status": project.status,
        "progress": project.progress,
        "current_step": project.current_step,
        "error_message": project.error_message,
        "settings": json.loads(project.settings_json or "{}"),
        "highlights": highlights_data,
        "clips": clips_data,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }

@app.get("/api/projects/{project_id}/status")
def get_project_status(project_id: str, db: Session = Depends(get_db)):
    """
    Lightweight polling endpoint for real-time progress checking.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {
        "status": project.status,
        "progress": project.progress,
        "current_step": project.current_step,
        "error_message": project.error_message,
    }

@app.post("/api/highlights/{highlight_id}/adjust")
def adjust_highlight(highlight_id: str, req: HighlightAdjustRequest, db: Session = Depends(get_db)):
    """
    Adjusts start and end timestamps or category of a candidate highlight.
    """
    hl = db.query(Highlight).filter(Highlight.id == highlight_id).first()
    if not hl:
        raise HTTPException(status_code=404, detail="Highlight not found.")

    if req.end_time <= req.start_time:
        raise HTTPException(status_code=400, detail="End time must be greater than start time.")

    hl.start_time = round(req.start_time, 2)
    hl.end_time = round(req.end_time, 2)
    hl.duration = round(req.end_time - req.start_time, 2)
    if req.category:
        hl.category = req.category
    if req.description:
        hl.description = req.description

    db.commit()
    db.refresh(hl)
    return {"status": "success", "highlight_id": hl.id, "start_time": hl.start_time, "end_time": hl.end_time}

@app.post("/api/highlights/{highlight_id}/generate-clip")
def generate_clip_endpoint(highlight_id: str, req: GenerateClipRequest, db: Session = Depends(get_db)):
    """
    Renders the 9:16 vertical video clip with synchronized subtitles for the selected highlight.
    """
    hl = db.query(Highlight).filter(Highlight.id == highlight_id).first()
    if not hl:
        raise HTTPException(status_code=404, detail="Highlight not found.")

    project = hl.project
    is_pre_cut = False
    
    if project.video_path and os.path.exists(project.video_path):
        source_vid = Path(project.video_path)
        probe = VideoService.probe_video(source_vid)
        source_w = probe["width"]
        source_h = probe["height"]
        facecam_info = json.loads(hl.facecam_box_json or "{}")
        facecam_box = facecam_info.get("box") if facecam_info.get("has_facecam") else None
    elif project.source_url:
        # DATA SAVER fallback: Download only this 35s section on demand
        project_download_dir = DOWNLOADS_DIR / project.id
        project_download_dir.mkdir(parents=True, exist_ok=True)
        raw_sec_path = project_download_dir / f"section_{hl.id[:8]}.mp4"
        if not raw_sec_path.exists():
            VideoService.download_video_section(
                url=project.source_url,
                start_sec=hl.start_time,
                end_sec=hl.end_time,
                output_path=raw_sec_path
            )
        source_vid = raw_sec_path
        is_pre_cut = True
        probe = VideoService.probe_video(source_vid)
        source_w = probe.get("width", 1920)
        source_h = probe.get("height", 1080)
        sec_facecam = FaceDetectionService.detect_streamer_facecam(raw_sec_path)
        facecam_box = sec_facecam["box"] if sec_facecam["has_facecam"] else None
    else:
        raise HTTPException(status_code=400, detail="Source video is not available on disk.")

    # Transcribe speech for this segment if needed
    transcript_segments = []
    if project.audio_path and os.path.exists(project.audio_path):
        try:
            from backend.services.speech_analysis import SpeechAnalysisService
            transcript_segments = SpeechAnalysisService.transcribe_and_analyze(Path(project.audio_path))
        except Exception as e:
            print(f"[GenerateClip] Subtitle transcription notice: {e}")

    clip_res = ClipGeneratorService.generate_clip_for_highlight(
        project_id=project.id,
        highlight_id=hl.id,
        source_video_path=source_vid,
        start_time=hl.start_time,
        end_time=hl.end_time,
        category=hl.category,
        transcript_segments=transcript_segments,
        facecam_box=facecam_box,
        layout_mode=req.layout_mode or "split_stack",
        subtitle_style=req.subtitle_style or "gaming_bold",
        source_width=source_w,
        source_height=source_h,
        is_pre_cut=is_pre_cut
    )

    clip = Clip(
        id=clip_res["clip_id"],
        project_id=project.id,
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
    hl.is_exported = True
    db.add(clip)
    db.commit()

    rel_clip_path = os.path.relpath(clip.file_path, CLIPS_DIR).replace("\\", "/")
    return {
        "clip_id": clip.id,
        "clip_url": f"/media/clips/{rel_clip_path}",
        "file_name": clip.file_name,
        "duration": clip.duration,
        "layout_type": clip.layout_type,
        "subtitle_style": clip.subtitle_style,
    }

@app.get("/api/clips")
def list_all_clips(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns all generated clips for the active user (or all if unauthenticated).
    """
    query = db.query(Clip)
    if current_user:
        query = query.filter((Clip.user_id == current_user.id) | (Clip.user_id == None))
    clips = query.order_by(Clip.created_at.desc()).all()
    results = []
    for c in clips:
        is_edited = bool(c.is_edited and c.edited_file_path and os.path.exists(c.edited_file_path))
        active_file = c.edited_file_path if is_edited else c.file_path
        active_thumb = c.edited_thumbnail_path if (is_edited and c.edited_thumbnail_path and os.path.exists(c.edited_thumbnail_path)) else c.thumbnail_path

        rel_active = os.path.relpath(active_file, CLIPS_DIR).replace("\\", "/") if active_file else ""
        rel_orig = os.path.relpath(c.original_file_path or c.file_path, CLIPS_DIR).replace("\\", "/") if c.file_path else ""

        thumb_url = None
        if active_thumb and os.path.exists(active_thumb):
            rel_thumb = os.path.relpath(active_thumb, CLIPS_DIR).replace("\\", "/")
            thumb_url = f"/media/clips/{rel_thumb}"

        results.append({
            "id": c.id,
            "project_id": c.project_id,
            "highlight_id": c.highlight_id,
            "file_name": c.file_name,
            "clip_url": f"/media/clips/{rel_active}",
            "original_clip_url": f"/media/clips/{rel_orig}",
            "is_edited": is_edited,
            "thumbnail_url": thumb_url,
            "duration": c.duration,
            "file_size": c.file_size,
            "resolution": c.resolution,
            "subtitle_style": c.subtitle_style,
            "layout_type": c.layout_type,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return results

@app.get("/api/clips/{clip_id}/subtitles")
def get_clip_subtitles_endpoint(clip_id: str, db: Session = Depends(get_db)):
    """Retrieves transcript snippet and subtitle metadata for a clip to populate editor."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")

    text = ""
    if clip.highlight and clip.highlight.transcript_snippet:
        text = clip.highlight.transcript_snippet

    edit_settings = {}
    if clip.edit_settings_json:
        try:
            edit_settings = json.loads(clip.edit_settings_json)
        except Exception:
            pass

    return {
        "clip_id": clip.id,
        "transcript_text": text,
        "duration": clip.duration,
        "subtitle_style": clip.subtitle_style,
        "layout_type": clip.layout_type,
        "saved_settings": edit_settings
    }

@app.post("/api/clips/{clip_id}/edit-render")
def render_edited_clip_endpoint(clip_id: str, req: ClipEditRenderRequest, db: Session = Depends(get_db)):
    """
    Renders user edits (custom start/end trimming, aspect ratio, custom subtitles,
    audio volume boost/attenuation, layout composition).
    Preserves original clip so user can download or revert anytime.
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")

    if not clip.original_file_path:
        clip.original_file_path = clip.file_path

    src_path = Path(clip.original_file_path)
    if not src_path.exists():
        src_path = Path(clip.file_path)
    if not src_path.exists():
        raise HTTPException(status_code=400, detail="Source clip file is missing on disk.")

    project_dir = CLIPS_DIR / clip.project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    out_edited_path = project_dir / f"clip_{clip.id}_edited.mp4"

    facecam_box = None
    if clip.highlight and clip.highlight.facecam_box_json:
        try:
            fc_data = json.loads(clip.highlight.facecam_box_json)
            if fc_data.get("has_facecam"):
                facecam_box = fc_data.get("box")
        except Exception:
            pass

    render_res = ClipEditorService.render_edited_clip(
        source_clip_path=src_path,
        output_clip_path=out_edited_path,
        start_trim=req.start_trim,
        end_trim=req.end_trim,
        aspect_ratio=req.aspect_ratio,
        layout_mode=req.layout_mode,
        volume_multiplier=req.volume_multiplier,
        subtitles_enabled=req.subtitles_enabled,
        subtitle_text=req.subtitle_text,
        subtitle_font=req.subtitle_font,
        subtitle_font_size=req.subtitle_font_size,
        subtitle_primary_color=req.subtitle_primary_color,
        subtitle_outline_color=req.subtitle_outline_color,
        subtitle_has_box_bg=req.subtitle_has_box_bg,
        subtitle_position=req.subtitle_position,
        facecam_box=facecam_box
    )

    clip.edited_file_path = render_res["file_path"]
    clip.edited_thumbnail_path = render_res["thumbnail_path"]
    clip.is_edited = True
    clip.edit_settings_json = json.dumps(req.dict())
    if req.title and req.title.strip():
        clip.file_name = f"{req.title.strip()[:60]}.mp4"

    db.commit()
    db.refresh(clip)

    rel_edited = os.path.relpath(clip.edited_file_path, CLIPS_DIR).replace("\\", "/")
    rel_orig = os.path.relpath(clip.original_file_path or clip.file_path, CLIPS_DIR).replace("\\", "/")
    thumb_url = None
    if clip.edited_thumbnail_path and os.path.exists(clip.edited_thumbnail_path):
        thumb_url = f"/media/clips/{os.path.relpath(clip.edited_thumbnail_path, CLIPS_DIR).replace(chr(92), '/')}"

    return {
        "status": "success",
        "clip_id": clip.id,
        "is_edited": True,
        "active_clip_url": f"/media/clips/{rel_edited}",
        "original_clip_url": f"/media/clips/{rel_orig}",
        "thumbnail_url": thumb_url,
        "duration": render_res["duration"],
        "resolution": render_res["resolution"],
        "file_size": render_res["file_size"],
    }

@app.post("/api/clips/{clip_id}/revert")
def revert_clip_endpoint(clip_id: str, db: Session = Depends(get_db)):
    """Reverts an edited clip back to the original AI generated version."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")

    if clip.edited_file_path and os.path.exists(clip.edited_file_path):
        try:
            os.remove(clip.edited_file_path)
        except Exception:
            pass

    clip.is_edited = False
    clip.edited_file_path = None
    clip.edited_thumbnail_path = None
    clip.edit_settings_json = None
    db.commit()

    rel_orig = os.path.relpath(clip.original_file_path or clip.file_path, CLIPS_DIR).replace("\\", "/")
    thumb_url = None
    if clip.thumbnail_path and os.path.exists(clip.thumbnail_path):
        thumb_url = f"/media/clips/{os.path.relpath(clip.thumbnail_path, CLIPS_DIR).replace(chr(92), '/')}"

    return {
        "status": "reverted",
        "clip_id": clip.id,
        "is_edited": False,
        "active_clip_url": f"/media/clips/{rel_orig}",
        "thumbnail_url": thumb_url,
        "duration": clip.duration
    }

@app.get("/api/clips/{clip_id}/download")
def download_clip_endpoint(clip_id: str, version: str = Query("edited"), db: Session = Depends(get_db)):
    """
    Direct file download with attachment headers:
    - version='original': downloads the pristine unedited generated clip.
    - version='edited': downloads the rendered edited clip (falls back to original if unedited).
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")

    target_file = None
    download_filename = clip.file_name or f"clip_{clip.id}.mp4"

    if version == "original":
        orig = clip.original_file_path or clip.file_path
        if orig and os.path.exists(orig):
            target_file = orig
            download_filename = f"original_{Path(orig).name}"
    else:
        if clip.is_edited and clip.edited_file_path and os.path.exists(clip.edited_file_path):
            target_file = clip.edited_file_path
            download_filename = f"edited_{Path(clip.edited_file_path).name}"
        else:
            orig = clip.original_file_path or clip.file_path
            if orig and os.path.exists(orig):
                target_file = orig
                download_filename = Path(orig).name

    if not target_file or not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="Requested clip video file is not available on disk.")

    return FileResponse(
        path=target_file,
        media_type="video/mp4",
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
    )

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """
    Deletes project record and cleans up associated files on disk.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Remove storage folders
    for d in [DOWNLOADS_DIR / project_id, CLIPS_DIR / project_id, TEMP_DIR / project_id]:
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)

    db.delete(project)
    db.commit()
    return {"status": "success", "message": f"Project {project_id} deleted."}


# -------------------------------------------------------------
# WebSocket for Live Progress & Stage Logs
# -------------------------------------------------------------

@app.websocket("/ws/{project_id}")
async def websocket_progress(websocket: WebSocket, project_id: str):
    await websocket.accept()
    PipelineManager.register_listener(project_id, websocket)
    try:
        # Send initial status
        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            await websocket.send_json({
                "project_id": project.id,
                "progress": project.progress,
                "step": project.current_step,
                "status": project.status,
            })
        db.close()

        while True:
            # Keep alive and receive client pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        PipelineManager.unregister_listener(project_id, websocket)
    except Exception:
        PipelineManager.unregister_listener(project_id, websocket)


# -------------------------------------------------------------
# AUTONOMOUS CONTENT PIPELINE & PUBLISHING API
# -------------------------------------------------------------

@app.get("/api/connectivity/status")
def get_connectivity_status():
    """Returns real-time internet connectivity status."""
    online = ConnectivityService.check_connection()
    return {
        "is_online": online,
        "status": "connected" if online else "offline",
        "timestamp": time.time()
    }

@app.get("/api/automation/status")
def get_automation_status(db: Session = Depends(get_db)):
    """
    Overview telemetry for the Autonomous Pipeline Dashboard:
    - Internet connectivity status
    - Active YouTube channel
    - Queue counts (total, scheduled, published, failed, awaiting_approval)
    - Next scheduled upload item
    - Current publishing mode & frequency
    """
    is_online = ConnectivityService.is_online()
    settings = SchedulerService.get_or_create_settings(db)
    yt_account = db.query(YouTubeAccount).filter(YouTubeAccount.is_active == True).first()

    total_queued = db.query(UploadQueueItem).count()
    scheduled_count = db.query(UploadQueueItem).filter(UploadQueueItem.status == "scheduled").count()
    published_count = db.query(UploadQueueItem).filter(UploadQueueItem.status == "published").count()
    failed_count = db.query(UploadQueueItem).filter(UploadQueueItem.status == "failed").count()
    awaiting_count = db.query(UploadQueueItem).filter(UploadQueueItem.status == "awaiting_approval").count()

    next_item = db.query(UploadQueueItem)\
        .filter(UploadQueueItem.status == "scheduled")\
        .order_by(UploadQueueItem.scheduled_time.asc())\
        .first()

    next_data = None
    if next_item:
        next_data = {
            "id": next_item.id,
            "title": next_item.title,
            "scheduled_time": next_item.scheduled_time.isoformat() if next_item.scheduled_time else None,
            "thumbnail_url": f"/media/clips/{os.path.relpath(next_item.clip.thumbnail_path, CLIPS_DIR).replace(chr(92), '/')}" if next_item.clip and next_item.clip.thumbnail_path else None
        }

    account_data = None
    if yt_account:
        account_data = {
            "channel_id": yt_account.channel_id,
            "channel_title": yt_account.channel_title,
            "channel_avatar": yt_account.channel_avatar,
            "is_active": yt_account.is_active,
        }

    return {
        "is_online": is_online,
        "connected_account": account_data,
        "publishing_mode": settings.publishing_mode,
        "frequency": settings.frequency,
        "preferred_hour": settings.preferred_hour,
        "privacy_status": settings.privacy_status,
        "counts": {
            "total": total_queued,
            "scheduled": scheduled_count,
            "published": published_count,
            "failed": failed_count,
            "awaiting_approval": awaiting_count,
        },
        "next_scheduled_item": next_data,
    }

@app.get("/api/queue")
def list_queue_items(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Lists all items in the sequential upload queue ordered by scheduled_time for the active user.
    """
    query = db.query(UploadQueueItem)
    if current_user:
        query = query.filter((UploadQueueItem.user_id == current_user.id) | (UploadQueueItem.user_id == None))
    items = query.order_by(UploadQueueItem.scheduled_time.asc()).all()
    results = []

    for item in items:
        clip = item.clip
        clip_data = None
        if clip:
            rel_clip = os.path.relpath(clip.file_path, CLIPS_DIR).replace("\\", "/") if clip.file_path else ""
            rel_thumb = os.path.relpath(clip.thumbnail_path, CLIPS_DIR).replace("\\", "/") if clip.thumbnail_path else ""
            clip_data = {
                "id": clip.id,
                "file_name": clip.file_name,
                "clip_url": f"/media/clips/{rel_clip}",
                "thumbnail_url": f"/media/clips/{rel_thumb}" if rel_thumb else None,
                "duration": clip.duration,
                "file_size": clip.file_size,
                "resolution": clip.resolution,
                "layout_type": clip.layout_type,
            }

        tags = []
        try:
            tags = json.loads(item.hashtags or "[]")
        except Exception:
            tags = []

        results.append({
            "id": item.id,
            "project_id": item.project_id,
            "clip_id": item.clip_id,
            "title": item.title,
            "description": item.description,
            "hashtags": tags,
            "caption": item.caption,
            "scheduled_time": item.scheduled_time.isoformat() if item.scheduled_time else None,
            "status": item.status,
            "youtube_video_id": item.youtube_video_id,
            "published_url": item.published_url,
            "attempts": item.attempts,
            "last_error": item.last_error,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "published_at": item.published_at.isoformat() if item.published_at else None,
            "clip": clip_data,
        })

    return results

@app.post("/api/queue/{item_id}/publish-now")
def publish_queue_item_now(item_id: str, db: Session = Depends(get_db)):
    """
    Forces immediate execution of single clip publish to YouTube.
    """
    item = db.query(UploadQueueItem).filter(UploadQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")

    if not ConnectivityService.is_online():
        raise HTTPException(status_code=400, detail="Cannot publish: internet connection is offline.")

    yt_account = db.query(YouTubeAccount).filter(YouTubeAccount.is_active == True).first()
    if not yt_account:
        raise HTTPException(status_code=400, detail="No YouTube channel connected. Connect account in Settings.")

    # Temporarily set scheduled time to now and trigger process
    item.scheduled_time = datetime.utcnow()
    item.status = "scheduled"
    db.commit()

    res = SchedulerService.process_queue_tick(db)
    return res

@app.post("/api/queue/{item_id}/approve")
def approve_queue_item(item_id: str, db: Session = Depends(get_db)):
    """
    Review Before Publish mode: user approves an awaiting_approval clip for scheduled publishing.
    """
    item = db.query(UploadQueueItem).filter(UploadQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")

    item.status = "scheduled"
    db.commit()
    return {"status": "success", "message": f"Clip '{item.title}' approved for publishing."}

@app.post("/api/queue/{item_id}/pause")
def toggle_pause_queue_item(item_id: str, db: Session = Depends(get_db)):
    """Toggles item status between paused and scheduled."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")

    if item.status == "paused":
        item.status = "scheduled"
    elif item.status in ("scheduled", "awaiting_approval"):
        item.status = "paused"
    db.commit()
    return {"status": "success", "new_status": item.status}

@app.put("/api/queue/{item_id}")
def update_queue_item(item_id: str, req: QueueUpdateRequest, db: Session = Depends(get_db)):
    """Updates title, description, tags, or scheduled time of a queued clip."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")

    if req.title is not None:
        t = req.title.strip()
        if "#shorts" not in t.lower():
            if len(t) > 90:
                t = t[:87].strip() + "..."
            t = f"{t} #Shorts"
        item.title = t
    if req.description is not None:
        item.description = req.description
    if req.caption is not None:
        item.caption = req.caption
    if req.hashtags is not None:
        item.hashtags = json.dumps(req.hashtags)
    if req.scheduled_time is not None:
        try:
            item.scheduled_time = datetime.fromisoformat(req.scheduled_time.replace("Z", "+00:00"))
        except Exception:
            pass

    db.commit()
    db.refresh(item)
    return {"status": "success", "item_id": item.id}

@app.delete("/api/queue/{item_id}")
def delete_queue_item(item_id: str, db: Session = Depends(get_db)):
    """Removes an item from the publishing queue."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")

    db.delete(item)
    db.commit()
    return {"status": "success", "message": "Item removed from queue."}

@app.get("/api/settings/publishing")
def get_publishing_settings(db: Session = Depends(get_db)):
    """Retrieves autonomous publishing configuration."""
    settings = SchedulerService.get_or_create_settings(db)
    tags = []
    try:
        tags = json.loads(settings.default_tags or "[]")
    except Exception:
        tags = ["#Shorts", "#Gaming"]

    return {
        "publishing_mode": settings.publishing_mode,
        "frequency": settings.frequency,
        "preferred_hour": settings.preferred_hour,
        "privacy_status": settings.privacy_status,
        "default_title_template": settings.default_title_template,
        "default_desc_template": settings.default_desc_template,
        "default_tags": tags,
        "auto_schedule_enabled": settings.auto_schedule_enabled,
    }

@app.post("/api/settings/publishing")
def update_publishing_settings(req: PublishingSettingsRequest, db: Session = Depends(get_db)):
    """Updates autonomous publishing settings."""
    settings = SchedulerService.get_or_create_settings(db)
    settings.publishing_mode = req.publishing_mode
    settings.frequency = req.frequency
    settings.preferred_hour = req.preferred_hour
    settings.privacy_status = req.privacy_status
    if req.default_title_template is not None:
        settings.default_title_template = req.default_title_template
    if req.default_desc_template is not None:
        settings.default_desc_template = req.default_desc_template
    if req.default_tags is not None:
        settings.default_tags = json.dumps(req.default_tags)
    if req.auto_schedule_enabled is not None:
        settings.auto_schedule_enabled = req.auto_schedule_enabled

    db.commit()
    return {"status": "success", "message": "Publishing settings updated."}

@app.get("/api/youtube/auth-url")
def get_youtube_auth_url(client_id: str, redirect_uri: str):
    """Generates official Google OAuth consent URL for user channel."""
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=400, detail="client_id and redirect_uri are required.")
    url = YouTubeService.get_authorization_url(client_id.strip(), redirect_uri.strip())
    return {"auth_url": url}

class SaveClientCredentialsRequest(BaseModel):
    client_id: str
    client_secret: str

@app.post("/api/youtube/client-credentials")
def save_client_credentials(req: SaveClientCredentialsRequest, db: Session = Depends(get_db)):
    account = db.query(YouTubeAccount).first()
    if not account:
        account = YouTubeAccount(
            id=str(uuid.uuid4())[:12], 
            client_id=req.client_id.strip(), 
            client_secret=req.client_secret.strip()
        )
        db.add(account)
    else:
        account.client_id = req.client_id.strip()
        new_secret = req.client_secret.strip()
        # Only overwrite client_secret if a new, unmasked secret was provided
        if new_secret and not new_secret.startswith("•"):
            account.client_secret = new_secret
    db.commit()
    return {"status": "saved"}

@app.get("/api/youtube/client-credentials")
def get_client_credentials(db: Session = Depends(get_db)):
    account = db.query(YouTubeAccount).first()
    if account and account.client_id:
        masked_sec = "••••••••"
        if account.client_secret and len(account.client_secret) > 4:
            masked_sec = f"••••••••{account.client_secret[-4:]}"
        return {
            "has_credentials": True,
            "has_secret": bool(account.client_secret),
            "client_id": account.client_id,
            "client_secret": masked_sec,
            "client_secret_masked": masked_sec
        }
    return {"has_credentials": False, "has_secret": False, "client_id": "", "client_secret": "", "client_secret_masked": ""}

@app.post("/api/youtube/connect")
def connect_youtube_account(req: YouTubeConnectRequest, db: Session = Depends(get_db)):
    """
    Exchanges OAuth code for tokens, verifies channel profile with YouTube API,
    and securely stores credentials.
    """
    try:
        eff_client_secret = req.client_secret.strip()
        # If client secret is masked or omitted, look up stored secret
        if not eff_client_secret or eff_client_secret.startswith("•"):
            existing = db.query(YouTubeAccount).first()
            if existing and existing.client_secret:
                eff_client_secret = existing.client_secret
            else:
                raise HTTPException(status_code=400, detail="Client secret is required.")

        tokens = YouTubeService.exchange_code_for_tokens(
            client_id=req.client_id.strip(),
            client_secret=eff_client_secret,
            code=req.code.strip(),
            redirect_uri=req.redirect_uri.strip()
        )

        profile = YouTubeService.get_channel_profile(tokens["access_token"])

        # Check existing account or create new
        account = db.query(YouTubeAccount).first()
        if not account:
            account = YouTubeAccount(id=str(uuid.uuid4())[:12])
            db.add(account)

        account.client_id = req.client_id.strip()
        account.client_secret = eff_client_secret
        account.access_token = tokens["access_token"]
        account.refresh_token = tokens["refresh_token"]
        account.token_expiry = tokens["token_expiry"]
        account.channel_id = profile["channel_id"]
        account.channel_title = profile["channel_title"]
        account.channel_avatar = profile["channel_avatar"]
        account.is_active = True
        db.commit()

        return {
            "status": "connected",
            "channel_title": account.channel_title,
            "channel_id": account.channel_id,
            "channel_avatar": account.channel_avatar,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/youtube/disconnect")
def disconnect_youtube_account(db: Session = Depends(get_db)):
    """Disconnects YouTube account and clears tokens."""
    account = db.query(YouTubeAccount).first()
    if account:
        db.delete(account)
        db.commit()
    return {"status": "disconnected"}

@app.get("/api/youtube/account")
def get_connected_youtube_account(db: Session = Depends(get_db)):
    """Returns connected YouTube channel details (without exposing secrets)."""
    account = db.query(YouTubeAccount).filter(YouTubeAccount.is_active == True).first()
    if not account:
        return {"connected": False, "account": None}

    return {
        "connected": True,
        "account": {
            "channel_id": account.channel_id,
            "channel_title": account.channel_title,
            "channel_avatar": account.channel_avatar,
            "is_active": account.is_active,
        }
    }

