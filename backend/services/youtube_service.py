import os
import json
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

class YouTubeService:
    OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
    YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
    YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
    
    SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
    ]

    @classmethod
    def get_authorization_url(cls, client_id: str, redirect_uri: str, state: str = "state_stream_clipper") -> str:
        """
        Generates Google OAuth 2.0 consent URL for YouTube Data API permissions.
        """
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(cls.SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{cls.OAUTH_AUTH_URL}?{urllib.parse.urlencode(params)}"

    @classmethod
    def exchange_code_for_tokens(
        cls, 
        client_id: str, 
        client_secret: str, 
        code: str, 
        redirect_uri: str
    ) -> Dict[str, Any]:
        """
        Exchanges authorization code for access and refresh tokens.
        """
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }).encode("utf-8")

        req = urllib.request.Request(
            cls.OAUTH_TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                token_data = json.loads(res.read().decode("utf-8"))
                return {
                    "access_token": token_data.get("access_token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "expires_in": token_data.get("expires_in", 3600),
                    "token_expiry": time.time() + float(token_data.get("expires_in", 3600)),
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"OAuth token exchange failed ({e.code}): {err_body}")

    @classmethod
    def refresh_access_token(cls, client_id: str, client_secret: str, refresh_token: str) -> Dict[str, Any]:
        """
        Refreshes expired access token using persistent refresh token.
        """
        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8")

        req = urllib.request.Request(
            cls.OAUTH_TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                token_data = json.loads(res.read().decode("utf-8"))
                return {
                    "access_token": token_data.get("access_token"),
                    "expires_in": token_data.get("expires_in", 3600),
                    "token_expiry": time.time() + float(token_data.get("expires_in", 3600)),
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Token refresh failed ({e.code}): {err_body}")

    @classmethod
    def get_channel_profile(cls, access_token: str) -> Dict[str, Any]:
        """
        Retrieves authorized channel info (id, title, avatar).
        """
        url = f"{cls.YOUTUBE_API_BASE}/channels?part=snippet&mine=true"
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                items = data.get("items", [])
                if not items:
                    raise RuntimeError("No YouTube channel found for authorized account.")
                ch = items[0]
                snippet = ch.get("snippet", {})
                return {
                    "channel_id": ch.get("id"),
                    "channel_title": snippet.get("title", "My YouTube Channel"),
                    "channel_avatar": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Failed to fetch channel profile ({e.code}): {err_body}")

    @classmethod
    def get_channel_recent_videos(cls, access_token: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Fetches the recent uploads from the authorized user's YouTube channel.
        Uses channels.list(part=contentDetails, mine=true) -> playlistItems.list.
        """
        # Step 1: Get user's uploads playlist ID
        ch_url = f"{cls.YOUTUBE_API_BASE}/channels?part=contentDetails,snippet&mine=true"
        req = urllib.request.Request(
            ch_url,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as res:
                ch_data = json.loads(res.read().decode("utf-8"))
                items = ch_data.get("items", [])
                if not items:
                    return []
                uploads_id = items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
                if not uploads_id:
                    return []
        except Exception as e:
            print(f"[YouTubeService] Channel contentDetails notice: {e}")
            return []

        # Step 2: Fetch playlist items (videos)
        pl_url = f"{cls.YOUTUBE_API_BASE}/playlistItems?part=snippet,status&playlistId={uploads_id}&maxResults={max_results}"
        pl_req = urllib.request.Request(
            pl_url,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        try:
            with urllib.request.urlopen(pl_req, timeout=12) as pl_res:
                pl_data = json.loads(pl_res.read().decode("utf-8"))
                videos = []
                for item in pl_data.get("items", []):
                    snippet = item.get("snippet", {})
                    resource = snippet.get("resourceId", {})
                    v_id = resource.get("videoId")
                    if v_id:
                        thumbs = snippet.get("thumbnails", {})
                        thumb_url = thumbs.get("medium", {}).get("url") or thumbs.get("default", {}).get("url") or f"https://i.ytimg.com/vi/{v_id}/mqdefault.jpg"
                        videos.append({
                            "video_id": v_id,
                            "title": snippet.get("title", ""),
                            "description": snippet.get("description", ""),
                            "published_at": snippet.get("publishedAt", ""),
                            "thumbnail_url": thumb_url,
                            "youtube_url": f"https://www.youtube.com/watch?v={v_id}",
                            "status": item.get("status", {}).get("privacyStatus", "public")
                        })
                return videos
        except Exception as e:
            print(f"[YouTubeService] Playlist items fetch notice: {e}")
            return []

    @classmethod
    def upload_short_resumable(
        cls,
        access_token: str,
        video_path: Path,
        title: str,
        description: str,
        tags: Optional[list] = None,
        privacy_status: str = "public",
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Official Google YouTube Resumable Upload Protocol.
        Supports automatic internet interruption recovery and chunked streaming.
        Returns {'video_id': str, 'published_url': str}.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Clip video file not found at {video_path}")

        file_size = os.path.getsize(video_path)

        # 1. Strictly enforce YouTube Shorts classification requirements:
        # YouTube Data API requires '#Shorts' in the title or description to index uploads into the Shorts shelf.
        clean_title = title.strip()
        if "#shorts" not in clean_title.lower():
            if len(clean_title) > 90:
                clean_title = clean_title[:87].strip() + "..."
            clean_title = f"{clean_title} #Shorts"

        clean_desc = description.strip()
        if "#shorts" not in clean_desc.lower():
            clean_desc = f"#Shorts\n\n{clean_desc}"

        # Clean tags (YouTube API tags array expects plain keywords without '#')
        api_tags = []
        for t in (tags or ["Shorts", "YouTube Shorts", "Gaming", "Stream Highlights"]):
            clean_tag = t.replace("#", "").strip()
            if clean_tag and clean_tag not in api_tags:
                api_tags.append(clean_tag)
        if "Shorts" not in api_tags:
            api_tags.insert(0, "Shorts")
        if "YouTube Shorts" not in api_tags:
            api_tags.insert(1, "YouTube Shorts")

        # Initiate Resumable Upload Session
        metadata = {
            "snippet": {
                "title": clean_title[:100],
                "description": clean_desc[:5000],
                "tags": api_tags,
                "categoryId": "20",  # Gaming
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            }
        }

        init_url = f"{cls.YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status"
        init_body = json.dumps(metadata).encode("utf-8")

        init_req = urllib.request.Request(
            init_url,
            data=init_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(file_size),
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(init_req, timeout=15) as res:
                upload_url = res.headers.get("Location")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            if e.code == 403 and "quotaExceeded" in err_body:
                raise RuntimeError("YouTube API Quota Exceeded for today. Upload will pause until quota reset.")
            raise RuntimeError(f"Failed to initiate YouTube upload session ({e.code}): {err_body}")

        if not upload_url:
            raise RuntimeError("YouTube API did not return an upload session URL.")

        print(f"[YouTubeService] Initiated upload session for '{title}' ({file_size:,} bytes)")

        # 2. Upload Video in Chunks (e.g. 2 MB chunks)
        chunk_size = 2 * 1024 * 1024  # 2MB chunks
        uploaded_bytes = 0

        with open(video_path, "rb") as f:
            while uploaded_bytes < file_size:
                chunk = f.read(chunk_size)
                if not chunk:
                    break

                chunk_len = len(chunk)
                start_byte = uploaded_bytes
                end_byte = uploaded_bytes + chunk_len - 1

                chunk_req = urllib.request.Request(
                    upload_url,
                    data=chunk,
                    headers={
                        "Content-Type": "video/mp4",
                        "Content-Length": str(chunk_len),
                        "Content-Range": f"bytes {start_byte}-{end_byte}/{file_size}",
                    },
                    method="PUT"
                )

                try:
                    with urllib.request.urlopen(chunk_req, timeout=25) as res:
                        # Final response returns video metadata JSON
                        res_data = json.loads(res.read().decode("utf-8"))
                        video_id = res_data.get("id")
                        published_url = f"https://www.youtube.com/shorts/{video_id}"
                        return {
                            "video_id": video_id,
                            "published_url": published_url,
                            "status": "published"
                        }
                except urllib.error.HTTPError as e:
                    # HTTP 308 Resume Incomplete is expected for intermediate chunks
                    if e.code == 308:
                        uploaded_bytes += chunk_len
                        pct = (uploaded_bytes / file_size) * 100.0
                        if progress_callback:
                            progress_callback(pct)
                    elif e.code == 403 and "quotaExceeded" in e.read().decode("utf-8", errors="ignore"):
                        raise RuntimeError("YouTube API Daily Quota Exceeded.")
                    else:
                        raise RuntimeError(f"Chunk upload failed with status {e.code}")

        raise RuntimeError("Upload loop finished without final YouTube confirmation.")
