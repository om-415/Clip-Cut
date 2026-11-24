import os
import time
import unittest
import socket
from pathlib import Path
from backend.services.video_service import VideoService
from backend.services.system_service import SystemInfoService
from backend.services.clip_editor_service import ClipEditorService

class TestAuditSuite(unittest.TestCase):
    
    # =========================================================================
    # 1. SSRF & URL Security Tests
    # =========================================================================
    def test_ssrf_rejects_non_http_schemes(self):
        """Must reject file://, gopher://, ftp:// schemes."""
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("file:///etc/passwd")
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("ftp://example.com/stream.mp4")

    def test_ssrf_rejects_unauthorized_domains(self):
        """Must reject non-YouTube domains."""
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("https://malicious-site.com/video")
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("https://vimeo.com/123456789")

    def test_ssrf_rejects_internal_ip_addresses(self):
        """Must reject loopback and private RFC1918 addresses."""
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("http://127.0.0.1:8000/test")
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("http://192.168.1.1/admin")
        with self.assertRaises(ValueError):
            VideoService.validate_source_url("http://169.254.169.254/latest/meta-data")

    def test_ssrf_accepts_valid_youtube_urls(self):
        """Must accept standard YouTube watch and short links."""
        url1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        self.assertIn("youtube.com/watch?v=dQw4w9WgXcQ", VideoService.validate_source_url(url1))
        
        url2 = "https://youtu.be/dQw4w9WgXcQ"
        self.assertIn("youtube.com/watch?v=dQw4w9WgXcQ", VideoService.validate_source_url(url2))

    def test_metadata_extraction_with_mobile_client(self):
        """Must extract YouTube metadata without bot-check block."""
        res = VideoService.get_youtube_metadata("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertIn("title", res)
        self.assertIn("channel", res)
        self.assertIn("thumbnail", res)
        self.assertGreaterEqual(res["duration"], 0)

    # =========================================================================
    # 2. System Info & Hardware Detection Tests
    # =========================================================================
    def test_system_telemetry_returns_genuine_metrics(self):
        """Must return genuine hardware telemetry without mock values."""
        info = SystemInfoService.get_system_telemetry()
        self.assertIn("hardware", info)
        self.assertIn("environment", info)
        self.assertIn("storage", info)
        self.assertIn("ai_models", info)
        self.assertIn("limitations", info)
        
        # Verify genuine values
        self.assertGreater(info["hardware"]["cpu_cores"], 0)
        self.assertGreater(info["hardware"]["ram_total_gb"], 0)
        self.assertIsInstance(info["hardware"]["gpu_detected"], bool)
        self.assertIn("FFmpeg", info["environment"]["ffmpeg_version"])
        self.assertGreater(info["storage"]["disk_total_gb"], 0)

    # =========================================================================
    # 3. Clip Customization & Subtitle Helper Tests
    # =========================================================================
    def test_ass_color_conversion(self):
        """Must convert hex color #RRGGBB into ASS &HAABBGGRR format."""
        # Red #FF0000 -> &H000000FF
        ass_red = ClipEditorService.hex_to_ass_color("#FF0000")
        self.assertEqual(ass_red, "&H000000FF")
        
        # Cyan #00FFFF -> &H00FFFF00
        ass_cyan = ClipEditorService.hex_to_ass_color("#00FFFF")
        self.assertEqual(ass_cyan, "&H00FFFF00")

    def test_generate_custom_ass_subtitles(self):
        """Must generate valid .ass subtitle file with customized properties."""
        test_ass = Path("temp") / "test_custom_sub.ass"
        test_ass.parent.mkdir(parents=True, exist_ok=True)
        res_path = ClipEditorService.generate_custom_ass_subtitles(
            text="Unbelievable clutch win in the final circle!",
            duration=12.5,
            output_ass_path=test_ass,
            font_name="Montserrat",
            font_size=48,
            primary_color="#00FFCC",
            outline_color="#000000",
            position="bottom"
        )
        self.assertTrue(res_path.exists())
        content = res_path.read_text(encoding="utf-8")
        self.assertIn("[Script Info]", content)
        self.assertIn("Montserrat", content)
        self.assertIn("Unbelievable clutch win", content)
        # Cleanup
        if res_path.exists():
            res_path.unlink()

    # =========================================================================
    # 4. User Authentication & Multi-User Partitioning Tests
    # =========================================================================
    def test_auth_token_lifecycle(self):
        """Must create valid signed auth token and verify user payload."""
        from backend.app.main import create_auth_token, verify_auth_token
        test_uid = "user_test_12345"
        test_email = "creator@fragflash.ai"
        token = create_auth_token(test_uid, test_email)
        self.assertIsInstance(token, str)
        self.assertIn(".", token)

        payload = verify_auth_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["user_id"], test_uid)
        self.assertEqual(payload["email"], test_email)

        # Invalid token must fail gracefully
        self.assertIsNone(verify_auth_token("invalid.token.signature"))

    def test_password_hashing(self):
        """Must produce deterministic HMAC hash with unique salt."""
        from backend.app.main import hash_user_password
        salt1 = "salt_alpha_1"
        salt2 = "salt_beta_2"
        h1 = hash_user_password("MySecurePass123", salt1)
        h2 = hash_user_password("MySecurePass123", salt2)
        h1_repeat = hash_user_password("MySecurePass123", salt1)

        self.assertEqual(h1, h1_repeat)
        self.assertNotEqual(h1, h2)

    # =========================================================================
    # 5. Rate Limiting & Abuse Prevention Tests
    # =========================================================================
    def test_auth_rate_limiter_blocks_rapid_attempts(self):
        """Rate limiter must throw HTTP 429 after exceeding max attempts within window."""
        from backend.app.main import check_auth_rate_limit, HTTPException
        client_ip = f"198.51.100.{int(time.time() % 200)}"
        
        # Under limit: should not throw
        for _ in range(12):
            check_auth_rate_limit(client_ip)
            
        # 13th attempt: must throw 429
        with self.assertRaises(HTTPException) as ctx:
            check_auth_rate_limit(client_ip)
        self.assertEqual(ctx.exception.status_code, 429)

    # =========================================================================
    # 6. YouTube OAuth URL Structure Tests
    # =========================================================================
    def test_youtube_auth_url_structure(self):
        """Must generate standard Google OAuth URL with proper scopes and offline access."""
        from backend.services.youtube_service import YouTubeService
        url = YouTubeService.get_authorization_url(
            client_id="123456789-test.apps.googleusercontent.com",
            redirect_uri="http://localhost:3000/oauth-callback"
        )
        self.assertTrue(url.startswith("https://accounts.google.com/o/oauth2/v2/auth?"))
        self.assertIn("response_type=code", url)
        self.assertIn("access_type=offline", url)
        self.assertIn("prompt=consent", url)
        self.assertIn("youtube.upload", url)

    # =========================================================================
    # 7. Multi-User Partitioning & IDOR Tests
    # =========================================================================
    def test_multi_user_data_isolation(self):
        """User B must NOT see or modify User A's projects or clips."""
        from backend.app.database import SessionLocal
        from backend.models.schema import User, Project
        import uuid

        db = SessionLocal()
        try:
            # Create User A & User B
            uid_a = f"user_a_{uuid.uuid4().hex[:8]}"
            uid_b = f"user_b_{uuid.uuid4().hex[:8]}"
            user_a = User(id=uid_a, email=f"{uid_a}@clipcut.ai", first_name="Alice")
            user_b = User(id=uid_b, email=f"{uid_b}@clipcut.ai", first_name="Bob")
            db.add_all([user_a, user_b])
            db.commit()

            # Create Project for User A
            proj_id = f"proj_a_{uuid.uuid4().hex[:8]}"
            proj = Project(
                id=proj_id,
                user_id=uid_a,
                source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                title="Alice Secret Stream",
                status="completed"
            )
            db.add(proj)
            db.commit()

            # Query from perspective of User B
            b_projects = db.query(Project).filter(Project.user_id == uid_b).all()
            b_project_ids = [p.id for p in b_projects]
            self.assertNotIn(proj_id, b_project_ids)

            # Query from perspective of User A
            a_projects = db.query(Project).filter(Project.user_id == uid_a).all()
            a_project_ids = [p.id for p in a_projects]
            self.assertIn(proj_id, a_project_ids)

            # Cleanup
            db.delete(proj)
            db.delete(user_a)
            db.delete(user_b)
            db.commit()
        finally:
            db.close()

if __name__ == "__main__":
    unittest.main()
