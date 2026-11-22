# ClipCut AI Studio 🎬⚡

**Intelligent Autonomous AI Video Clipping & YouTube Shorts Studio**

ClipCut transforms long gaming livestreams and YouTube videos into high-engagement **1080x1920 (9:16) vertical short-form clips** with burned-in subtitles, autonomous metadata generation, and scheduled YouTube Shorts publishing.

---

## 🚀 Key Highlights & Capabilities

- **Single URL Autonomous Pipeline**: Provide a YouTube link once; the system downloads, analyzes multi-signal excitement, extracts facecam/gameplay, generates subtitles, crafts titles/descriptions, and publishes sequentially to your connected YouTube channel.
- **Data Saver Technology**: Preserves 95%+ cellular/mobile data by downloading only audio for neural analysis and slicing exact 35-second 1080p stream sections via HTTP Range requests.
- **Precision Clip Studio & Editor (Option A)**:
  - Timeline scrubber with sub-second start/end trim handles.
  - Subtitle text editing & styling (Impact, Montserrat, Anton, Bebas Neue, custom colors, background boxes, positioning).
  - Audio volume multiplier (0.5x to 2.0x boost).
  - Multi-layout modes: Split Stack (facecam on top, gameplay on bottom), Blurred Fill, Overlay PiP, Fit Center.
  - Revert to original pristine clip anytime.
- **Dual Direct Downloads (Option B)**: One-click export for both pristine AI generated clips and customized edited versions without watermarks.
- **Autonomous YouTube Shorts Publishing**:
  - Official Google OAuth 2.0 integration with persistent token refresh.
  - Resumable upload protocol with network interruption recovery.
  - Three autonomous operating policies: *Full Autonomous*, *Review Before Publish*, and *Generate Only*.
  - Persistent SQLite upload queue with retry mechanisms and rate-limit backoff.
- **Enterprise-Grade Security Hardening**:
  - Strict SSRF protection rejecting RFC1918 private IPs, loopback, link-local, and unauthorized origins.
  - Automatic masking of Google Cloud OAuth client secrets (`••••••••XXXX`).
  - Strict HTTP security headers (`nosniff`, `DENY` framing, XSS filtering).
  - Configurable CORS origin restriction.
- **Genuine Hardware & Telemetry Engine**: Live, un-mocked hardware detection reporting exact CPU logical cores, RAM utilization, PyTorch device execution, FFmpeg build metrics, and disk space allocations.
- **Instagram Reels Roadmap**: Built-in early access waitlist for Instagram Graph API automation.

---

## 🏗️ Architecture & Directory Overview

```
fragflash-ai-clipper/
├── backend/
│   ├── app/
│   │   ├── config.py             # System configuration, paths, defaults
│   │   ├── database.py           # SQLAlchemy SQLite engine & session
│   │   └── main.py               # FastAPI REST endpoints, WebSockets, health/ready
│   ├── models/
│   │   └── schema.py             # SQLite ORM models (Projects, Clips, Queue, Waitlist)
│   ├── services/
│   │   ├── video_service.py      # SSRF validation, yt-dlp Range extraction, ffprobe
│   │   ├── clip_editor_service.py# Precision trimming, custom ASS styling & re-rendering
│   │   ├── clip_generator.py     # 1080x1920 vertical composition orchestrator
│   │   ├── video_composer.py     # Multi-layout FFmpeg filtergraph rendering
│   │   ├── subtitle_generator.py # Synchronized ASS & SRT subtitles
│   │   ├── youtube_service.py    # Resumable upload protocol & OAuth exchange
│   │   ├── scheduler_service.py  # Sequential publishing worker & slot calculator
│   │   ├── connectivity_service.py # Online/offline monitoring & auto-resume
│   │   ├── system_service.py     # Genuine hardware telemetry (psutil, torch, disk)
│   │   └── pipeline_manager.py   # Multi-signal AI pipeline background orchestrator
│   └── tests/
│       └── test_audit_suite.py   # Automated security, telemetry, and rendering tests
├── frontend/                     # Pure Black Studio Interface (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoEditorModal.tsx        # Timeline trimmer, subtitle & layout studio
│   │   │   ├── ClipsGalleryView.tsx        # Dual download & editor entry points
│   │   │   ├── AutomationDashboardView.tsx # Autonomous publishing controls
│   │   │   ├── UploadQueueView.tsx         # Real-time scheduled Shorts queue
│   │   │   ├── YouTubeSettingsView.tsx     # OAuth connect & channel credentials
│   │   │   ├── SettingsView.tsx            # Genuine hardware meters & telemetry
│   │   │   └── InstagramAutomationCard.tsx # Roadmap waitlist component
│   │   ├── api.ts
│   │   └── App.tsx
├── Dockerfile                    # Multi-stage production container
├── docker-compose.yml            # Compose specification with persistent volumes
├── start_production.bat          # Production launch script (Windows)
├── start_production.sh           # Production launch script (Linux/macOS)
├── .env.example                  # Environment variable reference
└── stream_clipper.db             # Local persistent SQLite database
```

---

## ⚡ Quick Start

### Option 1: Native Local Installation

#### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.11.9)
- **Node.js**: 18+ & npm
- **FFmpeg & FFprobe**: Installed and available on system PATH

#### 2. Backend Setup
```bash
# Clone or navigate to the repository
cd fragflash-ai-clipper

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
cd ..
```

#### 4. Run Automated Test Suite
```bash
python -m unittest backend.tests.test_audit_suite
```

#### 5. Launch the Studio
- **Windows**: Double-click `start_production.bat`
- **Linux/macOS**: Run `./start_production.sh`

The studio interface opens automatically at `http://localhost:3000`.

---

### Option 2: Docker & Docker Compose

```bash
docker compose up -d --build
```

Access the studio at `http://localhost:8000` (or `http://localhost:3000` with reverse proxy).

---

## 🔒 Security & Privacy Commitments

- **SSRF Hardening**: Only official YouTube domains are accepted; internal RFC1918 IPs, loopbacks, and cloud metadata endpoints (`169.254.169.254`) are strictly blocked.
- **Credentials Protection**: OAuth Client Secrets stored in SQLite are masked upon retrieval (`••••••••XXXX`) and protected against accidental overwriting.
- **Fair Use & Respect for Platform Terms**: Operates exclusively with publicly available YouTube videos or content the creator owns/has rights to. Adheres to Google YouTube API quotas and policies.

---

## 📜 License & Release

FragFlash AI Stream Clipper is maintained for content creators, streamers, and video editors. Private Beta Release.
