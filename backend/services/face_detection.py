import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import mediapipe as mp
from backend.services.video_service import VideoService

class FaceDetectionService:
    @staticmethod
    def detect_streamer_facecam(video_path: Path, sample_interval: float = 2.0) -> Dict[str, Any]:
        """
        Analyzes video frames across time to automatically identify the streamer's
        facecam position (bounding box) and detect if a facecam exists.
        Returns: {
            "has_facecam": bool,
            "box": {"x": int, "y": int, "w": int, "h": int}, # relative to source res
            "normalized_box": [ymin, xmin, ymax, xmax],
            "quadrant": str, # "top-left", "top-right", "bottom-left", "bottom-right"
            "confidence": float
        }
        """
        mp_face = mp.solutions.face_detection
        detector = mp_face.FaceDetection(min_detection_confidence=0.5, model_selection=1)

        detected_boxes = []
        frame_count = 0
        video_w, video_h = 1920, 1080

        for timestamp, frame in VideoService.sample_frames(video_path, interval_seconds=sample_interval):
            frame_count += 1
            if frame_count > 60:  # Sample up to ~2 minutes of video for facecam localization
                break

            video_h, video_w = frame.shape[:2]
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.process(rgb_frame)

            if results.detections:
                for det in results.detections:
                    bbox = det.location_data.relative_bounding_box
                    xmin = max(0.0, bbox.xmin)
                    ymin = max(0.0, bbox.ymin)
                    width = min(1.0 - xmin, bbox.width)
                    height = min(1.0 - ymin, bbox.height)

                    # Only consider faces that occupy reasonable facecam sizes (between 3% and 40% of frame width)
                    if 0.03 <= width <= 0.40 and 0.03 <= height <= 0.45:
                        detected_boxes.append((xmin, ymin, width, height, timestamp))

        detector.close()

        if not detected_boxes or len(detected_boxes) < 4:
            print("[FaceDetection] No consistent streamer facecam detected (pure gameplay or no webcam).")
            return {
                "has_facecam": False,
                "box": None,
                "normalized_box": None,
                "quadrant": "none",
                "confidence": 0.0
            }

        # Cluster detections by spatial proximity (find the most stable location across time)
        boxes_np = np.array([b[:4] for b in detected_boxes]) # xmin, ymin, w, h
        centers_x = boxes_np[:, 0] + boxes_np[:, 2] / 2.0
        centers_y = boxes_np[:, 1] + boxes_np[:, 3] / 2.0

        # Bin into quadrants:
        # 0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right
        quadrant_indices = []
        for cx, cy in zip(centers_x, centers_y):
            if cx < 0.5 and cy < 0.5:
                quadrant_indices.append(0)
            elif cx >= 0.5 and cy < 0.5:
                quadrant_indices.append(1)
            elif cx < 0.5 and cy >= 0.5:
                quadrant_indices.append(2)
            else:
                quadrant_indices.append(3)

        counts = np.bincount(quadrant_indices, minlength=4)
        best_quadrant = int(np.argmax(counts))
        quadrant_names = ["top-left", "top-right", "bottom-left", "bottom-right"]

        # Filter boxes in the dominant quadrant
        dominant_mask = [q == best_quadrant for q in quadrant_indices]
        dominant_boxes = boxes_np[dominant_mask]

        if len(dominant_boxes) < 3:
            return {
                "has_facecam": False,
                "box": None,
                "normalized_box": None,
                "quadrant": "none",
                "confidence": 0.0
            }

        # Calculate median bounding box of the streamer's face
        med_xmin, med_ymin, med_w, med_h = np.median(dominant_boxes, axis=0)

        # Expand bounding box to frame the full facecam (head, shoulders, background margin)
        expand_w = med_w * 0.9
        expand_h = med_h * 1.1
        box_xmin = max(0.0, med_xmin - expand_w / 2.0)
        box_ymin = max(0.0, med_ymin - expand_h * 0.4)
        box_w = min(1.0 - box_xmin, med_w + expand_w)
        box_h = min(1.0 - box_ymin, med_h + expand_h)

        pixel_x = int(round(box_xmin * video_w))
        pixel_y = int(round(box_ymin * video_h))
        pixel_w = int(round(box_w * video_w))
        pixel_h = int(round(box_h * video_h))

        # Ensure even numbers for ffmpeg cropping
        pixel_x = pixel_x - (pixel_x % 2)
        pixel_y = pixel_y - (pixel_y % 2)
        pixel_w = pixel_w - (pixel_w % 2)
        pixel_h = pixel_h - (pixel_h % 2)

        confidence = float(len(dominant_boxes) / frame_count)
        print(f"[FaceDetection] Streamer FaceCam identified in {quadrant_names[best_quadrant]} with {confidence:.1%} confidence: [{pixel_x}, {pixel_y}, {pixel_w}, {pixel_h}]")

        return {
            "has_facecam": True,
            "box": {"x": pixel_x, "y": pixel_y, "w": pixel_w, "h": pixel_h},
            "normalized_box": [round(float(box_ymin), 4), round(float(box_xmin), 4), 
                               round(float(box_ymin + box_h), 4), round(float(box_xmin + box_w), 4)],
            "quadrant": quadrant_names[best_quadrant],
            "confidence": round(confidence, 3)
        }

    @staticmethod
    def compute_facial_reactions(video_path: Path, facecam_box: Optional[Dict[str, int]], sample_interval: float = 1.0) -> List[Dict[str, float]]:
        """
        Samples streamer's face region during the stream to detect facial reactions
        (e.g., mouth opening in shock/laughter, rapid head movement/shaking).
        Returns a time series of reaction scores (0.0 to 1.0).
        """
        if not facecam_box:
            return []

        fx, fy, fw, fh = facecam_box["x"], facecam_box["y"], facecam_box["w"], facecam_box["h"]
        reaction_scores = []
        prev_crop_gray = None

        for timestamp, frame in VideoService.sample_frames(video_path, interval_seconds=sample_interval):
            h, w = frame.shape[:2]
            # Ensure crop coordinates stay within frame bounds
            x1 = max(0, min(w - 1, fx))
            y1 = max(0, min(h - 1, fy))
            x2 = max(x1 + 1, min(w, x1 + fw))
            y2 = max(y1 + 1, min(h, y1 + fh))

            face_crop = frame[y1:y2, x1:x2]
            if face_crop.size == 0:
                continue

            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (128, 128))

            if prev_crop_gray is not None:
                # Frame difference variance in face area (rapid motion / shock reaction)
                diff = cv2.absdiff(gray, prev_crop_gray)
                movement_score = float(np.mean(diff) / 40.0)
                score = min(max(movement_score, 0.0), 1.0)
            else:
                score = 0.2

            prev_crop_gray = gray
            reaction_scores.append({"timestamp": timestamp, "reaction_score": round(score, 4)})

        return reaction_scores
