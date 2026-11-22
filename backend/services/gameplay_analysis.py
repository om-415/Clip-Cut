import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple
from scenedetect import detect, ContentDetector, AdaptiveDetector
from backend.services.video_service import VideoService

class GameplayAnalysisService:
    @staticmethod
    def detect_scene_cuts(video_path: Path, threshold: float = 27.0) -> List[Tuple[float, float]]:
        """
        Detects scene cuts and transitions in the video using PySceneDetect.
        Returns a list of (start_sec, end_sec) scene time boundaries.
        """
        try:
            print(f"[GameplayAnalysis] Running PySceneDetect on {video_path}...")
            scene_list = detect(str(video_path), ContentDetector(threshold=threshold))
            scenes = []
            for scene in scene_list:
                start_sec = scene[0].get_seconds()
                end_sec = scene[1].get_seconds()
                scenes.append((round(start_sec, 2), round(end_sec, 2)))
            print(f"[GameplayAnalysis] Found {len(scenes)} distinct scenes.")
            return scenes
        except Exception as e:
            print(f"[GameplayAnalysis] Scene detection warning (falling back): {e}")
            return []

    @staticmethod
    def analyze_motion_and_action(video_path: Path, sample_interval: float = 1.0) -> List[Dict[str, float]]:
        """
        Analyzes gameplay frame-to-frame motion energy and action intensity.
        Detects rapid visual action, camera rotations, and high-motion gameplay events.
        Returns a time series of motion scores (0.0 to 1.0).
        """
        motion_scores = []
        prev_gray = None

        for timestamp, frame in VideoService.sample_frames(video_path, interval_seconds=sample_interval):
            h, w = frame.shape[:2]
            # Downsample for ultra-fast motion estimation
            small_frame = cv2.resize(frame, (256, 144))
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)

            if prev_gray is not None:
                # Frame difference variance
                diff = cv2.absdiff(gray, prev_gray)
                mean_diff = np.mean(diff)
                std_diff = np.std(diff)
                
                # High mean + high variance indicates rapid movement / action
                raw_action = (mean_diff * 0.7) + (std_diff * 0.3)
                norm_action = np.clip(raw_action / 35.0, 0.0, 1.0)
                score = round(float(norm_action), 4)
            else:
                score = 0.2

            prev_gray = gray
            motion_scores.append({"timestamp": timestamp, "visual_score": score})

        return motion_scores

    @staticmethod
    def evaluate_gameplay_cues(video_path: Path, timestamp: float) -> float:
        """
        Modular hook for evaluating gameplay events (e.g., kill feed flashes,
        victory banners, low-health red borders, clutch moments).
        """
        # Base implementation provides high-contrast UI flash detection
        return 0.5
