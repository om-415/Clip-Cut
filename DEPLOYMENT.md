# ClipCut Studio - Production Deployment & Hosting Guide

This guide covers complete, production-grade deployment strategies for **ClipCut Studio** so other creators and beta testers can access and use the platform publicly.

---

## Architecture Overview

```
[ Web Browser / Client ]
           │
           ▼ HTTPS (Port 443)
[ Cloudflare / Let's Encrypt SSL ]
           │
           ▼
[ Nginx Reverse Proxy (Port 80/443) ]
     ├── /api/*, /ws, /auth/* ──► FastAPI ASGI Backend (Uvicorn, Port 8000)
     └── /*                   ──► Static Production Frontend (Vite build)
                                          │
                                          ▼
                               [ SQLite / PostgreSQL ]
                                          │
                               [ Autonomous Daemon ]
                               (Processes Queue & Recovers from Offline)
```

---

## Deployment Option 1: VPS Deployment (Hetzner / DigitalOcean / Linode)

*Recommended for video processing performance. An 8-core CPU or GPU instance (e.g., Hetzner CPX41 or DigitalOcean CPU-Optimized Droplet) is ideal for fast FFmpeg encoding and Whisper transcription.*

### Step 1: Server Provisioning (Ubuntu 22.04 or 24.04 LTS)
Connect to your server via SSH:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install prerequisites (Python 3.11+, Node.js 20+, FFmpeg):
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv ffmpeg git nginx certbot python3-certbot-nginx

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Clone Codebase & Install Backend
```bash
git clone https://github.com/YOUR_USERNAME/clipcut.git /var/www/clipcut
cd /var/www/clipcut

# Create Python Virtual Environment
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 3: Build Production Frontend
```bash
cd /var/www/clipcut/frontend
npm install
npm run build
```
This produces the high-performance compiled bundle in `/var/www/clipcut/frontend/dist`.

### Step 4: Configure Environment (.env)
```bash
cd /var/www/clipcut
cp .env.example .env
nano .env
```
Fill in your production values:
```env
APP_ENV=production
HOST=127.0.0.1
PORT=8000
APP_BASE_URL=https://clipcut.yourdomain.com
AUTH_SECRET_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://clipcut.yourdomain.com
GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
GOOGLE_REDIRECT_URI=https://clipcut.yourdomain.com/auth/google/callback
```

Run database migration:
```bash
python3 scripts/migrate_v2.py
```

### Step 5: Setup Systemd Services (Automatic Restart on Reboot)

**1. FastAPI Web Server (`/etc/systemd/system/clipcut-web.service`):**
```ini
[Unit]
Description=ClipCut Studio FastAPI Server
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/clipcut
Environment="PATH=/var/www/clipcut/.venv/bin"
ExecStart=/var/www/clipcut/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**2. Autonomous Publishing Daemon (`/etc/systemd/system/clipcut-daemon.service`):**
```ini
[Unit]
Description=ClipCut Autonomous Publishing Daemon
After=clipcut-web.service

[Service]
User=root
WorkingDirectory=/var/www/clipcut
Environment="PATH=/var/www/clipcut/.venv/bin"
ExecStart=/var/www/clipcut/.venv/bin/python -m backend.services.autonomous_scheduler
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start both services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clipcut-web
sudo systemctl enable --now clipcut-daemon
sudo systemctl status clipcut-web
```

### Step 6: Configure Nginx & SSL
Create `/etc/nginx/sites-available/clipcut`:
```nginx
server {
    listen 80;
    server_name clipcut.yourdomain.com;

    # Static Frontend Assets
    location / {
        root /var/www/clipcut/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API & WebSocket Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site and acquire free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/clipcut /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d clipcut.yourdomain.com
```

---

## Deployment Option 2: Docker Containerization

Create `Dockerfile`:
```dockerfile
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Engine
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Run with Docker Compose:
```bash
docker compose up -d --build
```

---

## Deployment Option 3: Railway / Cloud PaaS
1. Connect your GitHub repository to [Railway.app](https://railway.app).
2. Set build command: `cd frontend && npm install && npm run build && cd .. && pip install -r backend/requirements.txt`
3. Set start command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example` into Railway's Variables dashboard.

---

## Pre-Launch Verification Checklist

- [x] All 12 backend security & audio tests pass (`python -m unittest backend/tests/test_audit_suite.py`).
- [x] Frontend builds with 0 errors (`npm run build`).
- [x] Google Cloud Console has authorized redirect URIs:
  - `https://yourdomain.com/auth/google/callback`
  - `https://yourdomain.com/oauth-callback`
- [x] Salted PBKDF2 authentication & signed JWT sessions active.
- [x] Multi-user data isolation verified.
- [x] Live channel video retrieval active via YouTube Data API v3.
- [x] Brute-force rate limiting active (12 attempts/min).
