export interface VideoMetadata {
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  view_count: number;
  description: string;
  url: string;
  is_live: boolean;
}

export interface SubScores {
  audio: number;
  speech: number;
  visual: number;
  face: number;
  gameplay: number;
}

export interface Highlight {
  id: string;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  category: string;
  description: string;
  audio_score: number;
  speech_score: number;
  visual_score: number;
  face_score: number;
  gameplay_score: number;
  transcript: string;
  thumbnail_url: string | null;
  is_accepted: boolean;
  is_exported: boolean;
}

export interface Clip {
  id: string;
  project_id: string;
  highlight_id: string | null;
  file_name: string;
  clip_url: string;
  original_clip_url?: string;
  is_edited?: boolean;
  thumbnail_url: string | null;
  file_size: number;
  duration: number;
  resolution: string;
  subtitle_style: string;
  layout_type: string;
  edit_settings?: any;
  created_at: string | null;
}

export interface ProjectSettings {
  num_clips: number;
  clip_duration: number;
  subtitle_style: string;
  layout_mode: string;
  auto_generate_clips: boolean;
  data_saver_mode?: boolean;
  highlight_types?: string[];
}

export interface Project {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail_url: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string;
  error_message: string | null;
  clip_count?: number;
  highlight_count?: number;
  settings?: ProjectSettings;
  highlights?: Highlight[];
  clips?: Clip[];
  created_at: string | null;
}

export interface QueueItem {
  id: string;
  project_id: string;
  clip_id: string;
  title: string;
  description: string;
  hashtags: string[];
  caption: string;
  scheduled_time: string | null;
  status: 'ready' | 'scheduled' | 'uploading' | 'published' | 'failed' | 'paused' | 'awaiting_approval';
  youtube_video_id: string | null;
  published_url: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string | null;
  published_at: string | null;
  clip?: {
    id: string;
    file_name: string;
    clip_url: string;
    thumbnail_url: string | null;
    duration: number;
    file_size: number;
    resolution: string;
    layout_type: string;
  };
}

export interface YouTubeAccountInfo {
  channel_id: string;
  channel_title: string;
  channel_avatar: string;
  is_active: boolean;
}

export interface PublishingSettingsData {
  publishing_mode: 'full_auto' | 'review_before_publish' | 'generate_only';
  frequency: 'daily' | 'every_12h' | 'every_2_days' | 'custom';
  preferred_hour: number;
  privacy_status: 'public' | 'unlisted' | 'private';
  default_title_template: string;
  default_desc_template: string;
  default_tags: string[];
  auto_schedule_enabled: boolean;
}

export interface AutomationStatusData {
  is_online: boolean;
  connected_account: YouTubeAccountInfo | null;
  publishing_mode: string;
  frequency: string;
  preferred_hour: number;
  privacy_status: string;
  counts: {
    total: number;
    scheduled: number;
    published: number;
    failed: number;
    awaiting_approval: number;
  };
  next_scheduled_item: {
    id: string;
    title: string;
    scheduled_time: string | null;
    thumbnail_url: string | null;
  } | null;
}

export interface SystemInfoData {
  application: {
    name: string;
    version: string;
    processing_mode: string;
    engine_status: string;
  };
  hardware: {
    os: string;
    cpu_cores: number;
    ram_total_gb: number;
    ram_available_gb: number;
    ram_used_pct: number;
    gpu_detected: boolean;
    gpu_model: string;
    gpu_memory: string;
    acceleration: string;
  };
  environment: {
    python_version: string;
    pytorch_version: string;
    ffmpeg_version: string;
  };
  ai_models: {
    speech_recognition: string;
    face_detection: string;
    audio_analysis: string;
    gameplay_motion: string;
  };
  storage: {
    disk_total_gb: number;
    disk_free_gb: number;
    disk_used_pct: number;
    clips_storage_mb: number;
    downloads_cache_mb: number;
    temp_scratch_mb: number;
    app_total_mb: number;
  };
  formats: {
    supported_inputs: string[];
    supported_outputs: string[];
    video_codec: string;
    audio_codec: string;
  };
  limitations: string[];
}

export interface ClipEditParams {
  title?: string;
  start_trim: number;
  end_trim?: number;
  aspect_ratio: '9:16' | 'original_16:9' | '1:1';
  layout_mode: 'split_stack' | 'overlay_pip' | 'blurred_fill' | 'fit_center';
  volume_multiplier: number;
  subtitles_enabled: boolean;
  subtitle_text?: string;
  subtitle_font: string;
  subtitle_font_size: number;
  subtitle_primary_color: string;
  subtitle_outline_color: string;
  subtitle_has_box_bg: boolean;
  subtitle_position: 'bottom' | 'middle' | 'top';
}
