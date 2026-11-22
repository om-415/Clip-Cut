from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100), default="")
    last_name = Column(String(100), default="")
    hashed_password = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    salt = Column(String(64), nullable=True)
    auth_provider = Column(String(50), default="email")   # "email", "google"
    google_id = Column(String(255), nullable=True, index=True)
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    projects = relationship("Project", back_populates="user")
    clips = relationship("Clip", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(255), default="Untitled Video")
    source_type = Column(String(50), default="youtube")  # "youtube" or "local"
    source_url = Column(Text, nullable=True)
    channel_name = Column(String(255), nullable=True)
    duration = Column(Float, default=0.0)
    thumbnail_url = Column(Text, nullable=True)
    video_path = Column(Text, nullable=True)
    audio_path = Column(Text, nullable=True)
    status = Column(String(50), default="queued")  # queued, processing, completed, failed
    progress = Column(Float, default=0.0)
    current_step = Column(String(100), default="Initializing")
    error_message = Column(Text, nullable=True)
    settings_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="projects")
    highlights = relationship("Highlight", back_populates="project", cascade="all, delete-orphan")
    clips = relationship("Clip", back_populates="project", cascade="all, delete-orphan")


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(String(36), primary_key=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    score = Column(Float, default=0.0)
    category = Column(String(100), default="Highlight")
    description = Column(Text, default="")
    
    # Detailed sub-scores (0-100)
    audio_score = Column(Float, default=0.0)
    speech_score = Column(Float, default=0.0)
    visual_score = Column(Float, default=0.0)
    face_score = Column(Float, default=0.0)
    gameplay_score = Column(Float, default=0.0)
    
    transcript_snippet = Column(Text, default="")
    thumbnail_path = Column(Text, nullable=True)
    facecam_box_json = Column(Text, default="{}")  # {"x": ..., "y": ..., "w": ..., "h": ..., "detected": bool}
    
    is_accepted = Column(Boolean, default=True)
    is_exported = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="highlights")
    clips = relationship("Clip", back_populates="highlight", cascade="all, delete-orphan")


class Clip(Base):
    __tablename__ = "clips"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    highlight_id = Column(String(36), ForeignKey("highlights.id"), nullable=True, index=True)
    file_path = Column(Text, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0)
    duration = Column(Float, default=0.0)
    resolution = Column(String(50), default="1080x1920")
    subtitle_style = Column(String(50), default="gaming_bold")
    layout_type = Column(String(50), default="split_stack")
    thumbnail_path = Column(Text, nullable=True)
    original_file_path = Column(Text, nullable=True)
    edited_file_path = Column(Text, nullable=True)
    edited_thumbnail_path = Column(Text, nullable=True)
    is_edited = Column(Boolean, default=False)
    edit_settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="clips")
    project = relationship("Project", back_populates="clips")
    highlight = relationship("Highlight", back_populates="clips")


class InstagramWaitlist(Base):
    __tablename__ = "instagram_waitlist"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class YouTubeAccount(Base):
    __tablename__ = "youtube_accounts"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    channel_id = Column(String(100), nullable=True)
    channel_title = Column(String(255), default="My Channel")
    channel_avatar = Column(Text, nullable=True)
    client_id = Column(Text, nullable=False)
    client_secret = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    token_expiry = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class UploadQueueItem(Base):
    __tablename__ = "upload_queue"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    clip_id = Column(String(36), ForeignKey("clips.id"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    hashtags = Column(Text, default="[]")  # JSON list of tags
    caption = Column(Text, default="")
    scheduled_time = Column(DateTime, nullable=True, index=True)
    status = Column(String(50), default="scheduled", index=True)  # ready, scheduled, uploading, published, failed, paused, awaiting_approval
    youtube_video_id = Column(String(100), nullable=True)
    published_url = Column(Text, nullable=True)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    project = relationship("Project")
    clip = relationship("Clip")


class PublishingSettings(Base):
    __tablename__ = "publishing_settings"

    id = Column(String(36), primary_key=True, default="default")
    publishing_mode = Column(String(50), default="full_auto")  # full_auto, review_before_publish, generate_only
    frequency = Column(String(50), default="daily")  # daily, every_12h, every_2_days, custom
    preferred_hour = Column(Integer, default=18)  # 6 PM
    preferred_days = Column(Text, default="[\"mon\",\"tue\",\"wed\",\"thu\",\"fri\",\"sat\",\"sun\"]")
    privacy_status = Column(String(50), default="public")  # public, unlisted, private
    default_title_template = Column(Text, default="")
    default_desc_template = Column(Text, default="")
    default_tags = Column(Text, default="[\"#Shorts\", \"#Gaming\"]")
    auto_schedule_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
