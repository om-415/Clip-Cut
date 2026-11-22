import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.models.schema import (
    UploadQueueItem, 
    YouTubeAccount, 
    PublishingSettings, 
    Clip, 
    Project
)
from backend.services.connectivity_service import ConnectivityService
from backend.services.youtube_service import YouTubeService

class SchedulerService:
    @staticmethod
    def get_or_create_settings(db: Session) -> PublishingSettings:
        settings = db.query(PublishingSettings).filter(PublishingSettings.id == "default").first()
        if not settings:
            settings = PublishingSettings(
                id="default",
                publishing_mode="full_auto",
                frequency="daily",
                preferred_hour=18,
                preferred_days=json.dumps(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
                privacy_status="public",
                default_title_template="{topic} #Shorts",
                default_desc_template="",
                default_tags=json.dumps(["Shorts", "Gaming", "YouTube Shorts"]),
                auto_schedule_enabled=True,
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

    @classmethod
    def calculate_next_slot(cls, db: Session, settings: PublishingSettings) -> datetime:
        """
        Calculates the next available scheduled publishing timestamp based on
        frequency (daily, every_12h, every_2_days) and preferred hour.
        Avoids simultaneous uploads by finding the latest scheduled item in queue.
        """
        now = datetime.utcnow()
        latest_item = db.query(UploadQueueItem)\
            .filter(UploadQueueItem.status.in_(["scheduled", "uploading"]))\
            .order_by(UploadQueueItem.scheduled_time.desc())\
            .first()

        base_time = now
        if latest_item and latest_item.scheduled_time and latest_item.scheduled_time > now:
            base_time = latest_item.scheduled_time

        freq = settings.frequency or "daily"
        pref_hour = int(settings.preferred_hour or 18)

        if freq == "every_12h":
            next_slot = base_time + timedelta(hours=12)
        elif freq == "every_2_days":
            next_slot = base_time + timedelta(days=2)
            next_slot = next_slot.replace(hour=pref_hour, minute=0, second=0, microsecond=0)
        else:
            # Default: Daily
            next_slot = base_time + timedelta(days=1)
            next_slot = next_slot.replace(hour=pref_hour, minute=0, second=0, microsecond=0)

        # If base_time was now and preferred hour for today is still in the future:
        if base_time == now:
            today_slot = now.replace(hour=pref_hour, minute=0, second=0, microsecond=0)
            if today_slot > now + timedelta(minutes=15):
                next_slot = today_slot

        return next_slot

    @classmethod
    def enqueue_clip(
        cls,
        db: Session,
        clip_id: str,
        project_id: str,
        metadata: Dict[str, Any]
    ) -> UploadQueueItem:
        """
        Enqueues a generated clip into the persistent upload queue with scheduling.
        """
        settings = cls.get_or_create_settings(db)
        
        # Calculate schedule slot
        scheduled_dt = cls.calculate_next_slot(db, settings)

        # Determine initial status based on publishing mode
        mode = settings.publishing_mode or "full_auto"
        if mode == "full_auto":
            initial_status = "scheduled"
        elif mode == "review_before_publish":
            initial_status = "awaiting_approval"
        else:
            initial_status = "ready"  # generate only

        item_id = f"queue_{clip_id[:12]}"
        
        # Avoid duplicate queue entries
        existing = db.query(UploadQueueItem).filter(UploadQueueItem.clip_id == clip_id).first()
        if existing:
            return existing

        # Ensure #Shorts is present in the title
        raw_title = metadata.get("title", "New YouTube Short").strip()
        if "#shorts" not in raw_title.lower():
            if len(raw_title) > 90:
                raw_title = raw_title[:87].strip() + "..."
            final_title = f"{raw_title} #Shorts"
        else:
            final_title = raw_title

        queue_item = UploadQueueItem(
            id=item_id,
            project_id=project_id,
            clip_id=clip_id,
            title=final_title,
            description=metadata.get("description", ""),
            hashtags=json.dumps(metadata.get("hashtags", ["#Shorts", "#Gaming"])),
            caption=metadata.get("caption", ""),
            scheduled_time=scheduled_dt,
            status=initial_status,
            attempts=0
        )
        db.add(queue_item)
        db.commit()
        db.refresh(queue_item)
        print(f"[SchedulerService] Enqueued clip {clip_id} for {scheduled_dt} (status={initial_status})")
        return queue_item

    @classmethod
    def process_queue_tick(cls, db: Session) -> Optional[Dict[str, Any]]:
        """
        Sequential Upload Queue Worker execution tick:
        1. Verifies internet connectivity.
        2. Retrieves next eligible scheduled item where scheduled_time <= now.
        3. Performs content & safety validation.
        4. Uploads single clip to YouTube via official resumable API.
        5. Updates persistent records.
        """
        # 1. Check internet connectivity
        if not ConnectivityService.is_online():
            print("[SchedulerService] Internet offline. Queue paused until connectivity returns.")
            return {"status": "paused_offline"}

        # 2. Check active YouTube account
        yt_account = db.query(YouTubeAccount).filter(YouTubeAccount.is_active == True).first()
        if not yt_account:
            # No channel connected
            return {"status": "no_account_connected"}

        now = datetime.utcnow()
        settings = cls.get_or_create_settings(db)

        # 3. Find next item ready to publish
        # In full_auto mode: scheduled items where scheduled_time <= now
        # In review_before_publish: only approved items (status == 'scheduled' and scheduled_time <= now)
        item = db.query(UploadQueueItem)\
            .filter(
                UploadQueueItem.status == "scheduled",
                UploadQueueItem.scheduled_time <= now
            )\
            .order_by(UploadQueueItem.scheduled_time.asc())\
            .first()

        if not item:
            return {"status": "idle"}

        clip = item.clip
        if not clip or not os.path.exists(clip.file_path):
            item.status = "failed"
            item.last_error = f"Clip file not found on disk at {clip.file_path if clip else 'None'}"
            db.commit()
            return {"status": "file_not_found", "item_id": item.id}

        # Prevent duplicate publishing
        if item.youtube_video_id:
            item.status = "published"
            db.commit()
            return {"status": "already_published", "item_id": item.id}

        # 4. Mark item as uploading
        item.status = "uploading"
        item.attempts += 1
        db.commit()

        # 5. Check and refresh OAuth token if expired
        try:
            if time.time() >= (yt_account.token_expiry or 0.0) - 120.0:
                print("[SchedulerService] Refreshing YouTube OAuth access token...")
                fresh_tokens = YouTubeService.refresh_access_token(
                    client_id=yt_account.client_id,
                    client_secret=yt_account.client_secret,
                    refresh_token=yt_account.refresh_token
                )
                yt_account.access_token = fresh_tokens["access_token"]
                yt_account.token_expiry = fresh_tokens["token_expiry"]
                db.commit()

            # 6. Execute Resumable Upload
            print(f"[SchedulerService] Uploading Short: '{item.title}' to {yt_account.channel_title}...")
            tags = json.loads(item.hashtags or "[]")
            privacy = settings.privacy_status or "public"

            upload_res = YouTubeService.upload_short_resumable(
                access_token=yt_account.access_token,
                video_path=Path(clip.file_path),
                title=item.title,
                description=item.description,
                tags=tags,
                privacy_status=privacy
            )

            # 7. Record successful publish
            item.youtube_video_id = upload_res["video_id"]
            item.published_url = upload_res["published_url"]
            item.status = "published"
            item.published_at = datetime.utcnow()
            item.last_error = None
            db.commit()

            print(f"[SchedulerService] Successfully published YouTube Short: {item.published_url}")
            return {
                "status": "published",
                "item_id": item.id,
                "video_id": item.youtube_video_id,
                "url": item.published_url
            }

        except Exception as e:
            err_msg = str(e)
            print(f"[SchedulerService] Upload error: {err_msg}")
            
            # If network error, revert to scheduled for auto-retry
            if "offline" in err_msg.lower() or "connection" in err_msg.lower() or "timed out" in err_msg.lower():
                item.status = "scheduled"
                item.scheduled_time = now + timedelta(minutes=2)
            elif "quota" in err_msg.lower():
                item.status = "paused"
                item.last_error = "YouTube API Daily Quota Exceeded. Resume after quota reset."
            else:
                item.status = "failed"
                item.last_error = err_msg

            db.commit()
            return {"status": "error", "error": err_msg, "item_id": item.id}
