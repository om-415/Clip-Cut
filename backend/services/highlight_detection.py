import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.highlight_scoring import HighlightScoringService

class HighlightDetectionService:
    @staticmethod
    def detect_highlights(
        total_duration: float,
        audio_timeline: List[Dict[str, Any]],
        speech_segments: List[Dict[str, Any]],
        motion_timeline: List[Dict[str, Any]],
        reaction_timeline: List[Dict[str, Any]],
        target_clip_duration: float = 35.0,
        min_clip_duration: float = 20.0,
        max_clip_duration: float = 45.0,
        top_k: int = 5,
        sensitivity: str = "medium",
        custom_weights: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Multi-signal intelligent highlight detection engine.
        Combines audio, speech, motion, and face reaction curves across the entire video.
        Uses sliding window convolution and Non-Maximum Suppression (NMS) to eliminate duplicates.
        """
        if total_duration < min_clip_duration:
            # Video is shorter than minimum clip duration: return full duration
            return [{
                "start_time": 0.0,
                "end_time": round(total_duration, 2),
                "duration": round(total_duration, 2),
                "score": 85.0,
                "category": "Complete Clip",
                "description": "Short stream clip.",
                "transcript": " ".join([s["text"] for s in speech_segments])[:150],
                "sub_scores": {"audio": 70, "speech": 70, "visual": 70, "face": 70, "gameplay": 70}
            }]

        # Create continuous 1-second grid across entire video duration
        grid_len = int(np.ceil(total_duration))
        time_grid = np.arange(grid_len)

        audio_grid = np.zeros(grid_len, dtype=np.float32)
        speech_grid = np.zeros(grid_len, dtype=np.float32)
        motion_grid = np.zeros(grid_len, dtype=np.float32)
        reaction_grid = np.zeros(grid_len, dtype=np.float32)

        # Populate audio scores into grid
        for item in audio_timeline:
            idx = int(item["timestamp"])
            if 0 <= idx < grid_len:
                audio_grid[idx] = max(audio_grid[idx], item.get("score", 0.0))

        # Populate speech excitement into grid
        for seg in speech_segments:
            s_idx = max(0, int(seg["start"]))
            e_idx = min(grid_len, int(np.ceil(seg["end"])))
            speech_grid[s_idx:e_idx] = np.maximum(speech_grid[s_idx:e_idx], seg.get("score", 0.2))

        # Populate motion/action into grid
        for item in motion_timeline:
            idx = int(item["timestamp"])
            if 0 <= idx < grid_len:
                motion_grid[idx] = max(motion_grid[idx], item.get("visual_score", 0.0))

        # Populate facial reaction into grid
        for item in reaction_timeline:
            idx = int(item["timestamp"])
            if 0 <= idx < grid_len:
                reaction_grid[idx] = max(reaction_grid[idx], item.get("reaction_score", 0.0))

        # Smooth each curve with a 3-second moving average
        kernel = np.ones(3) / 3.0
        audio_smooth = np.convolve(audio_grid, kernel, mode="same")
        speech_smooth = np.convolve(speech_grid, kernel, mode="same")
        motion_smooth = np.convolve(motion_grid, kernel, mode="same")
        reaction_smooth = np.convolve(reaction_grid, kernel, mode="same")

        # Sliding window evaluation (step = 2 seconds)
        window_size = int(target_clip_duration)
        step = 2

        candidates = []

        for start_sec in range(0, grid_len - window_size + 1, step):
            end_sec = start_sec + window_size

            # Compute average score in window
            w_audio = float(np.mean(audio_smooth[start_sec:end_sec]))
            w_speech = float(np.mean(speech_smooth[start_sec:end_sec]))
            w_motion = float(np.mean(motion_smooth[start_sec:end_sec]))
            w_face = float(np.mean(reaction_smooth[start_sec:end_sec]))
            w_gameplay = (w_motion + w_audio) / 2.0

            composite = HighlightScoringService.calculate_composite_score(
                audio_score=w_audio,
                speech_score=w_speech,
                visual_score=w_motion,
                face_score=w_face,
                gameplay_score=w_gameplay,
                weights=custom_weights
            )

            candidates.append({
                "start": float(start_sec),
                "end": float(end_sec),
                "score": composite,
                "audio_avg": w_audio,
                "speech_avg": w_speech,
                "motion_avg": w_motion,
                "face_avg": w_face,
                "gameplay_avg": w_gameplay,
            })

        # Sort candidates by score descending
        candidates.sort(key=lambda x: x["score"], reverse=True)

        # Non-Maximum Suppression (NMS) to avoid overlapping duplicate clips
        # Overlap threshold (IoU)
        iou_threshold = 0.20
        selected = []

        for cand in candidates:
            # Check overlap with already selected highlights
            c_start, c_end = cand["start"], cand["end"]
            overlap = False

            for s in selected:
                s_start, s_end = s["start"], s["end"]
                # Compute intersection
                inter_start = max(c_start, s_start)
                inter_end = min(c_end, s_end)
                if inter_end > inter_start:
                    intersection = inter_end - inter_start
                    union = (c_end - c_start) + (s_end - s_start) - intersection
                    iou = intersection / union if union > 0 else 0
                    if iou > iou_threshold:
                        overlap = True
                        break

            if not overlap:
                selected.append(cand)
                if len(selected) >= top_k:
                    break

        # Boundary refinement: Align start & end with natural speech boundaries from Whisper
        final_highlights = []
        for cand in selected:
            raw_start = cand["start"]
            raw_end = cand["end"]

            # Refine start: find closest segment start within +/- 3s
            best_start = raw_start
            for seg in speech_segments:
                if abs(seg["start"] - raw_start) <= 3.5:
                    best_start = seg["start"]
                    break

            # Refine end: find closest segment end within +/- 4s
            best_end = raw_end
            for seg in speech_segments:
                if abs(seg["end"] - raw_end) <= 4.0:
                    best_end = seg["end"]
                    break

            # Bound within duration limits
            clip_dur = best_end - best_start
            if clip_dur < min_clip_duration:
                best_end = min(total_duration, best_start + min_clip_duration)
            elif clip_dur > max_clip_duration:
                best_end = best_start + max_clip_duration

            # Gather transcript within highlight
            transcript_parts = [
                s["text"] for s in speech_segments
                if (s["start"] >= best_start - 0.5 and s["end"] <= best_end + 0.5)
            ]
            transcript_text = " ".join(transcript_parts).strip()

            category, description = HighlightScoringService.categorize_moment(
                audio_score=cand["audio_avg"],
                speech_score=cand["speech_avg"],
                visual_score=cand["motion_avg"],
                face_score=cand["face_avg"],
                transcript=transcript_text
            )

            final_highlights.append({
                "start_time": round(float(best_start), 2),
                "end_time": round(float(best_end), 2),
                "duration": round(float(best_end - best_start), 2),
                "score": cand["score"],
                "category": category,
                "description": description,
                "transcript": transcript_text,
                "sub_scores": {
                    "audio": round(cand["audio_avg"] * 100, 1),
                    "speech": round(cand["speech_avg"] * 100, 1),
                    "visual": round(cand["motion_avg"] * 100, 1),
                    "face": round(cand["face_avg"] * 100, 1),
                    "gameplay": round(cand["gameplay_avg"] * 100, 1),
                }
            })

        # Order chronologically for natural video flow
        final_highlights.sort(key=lambda x: x["start_time"])
        print(f"[HighlightDetection] Identified {len(final_highlights)} ranked non-overlapping highlights.")
        return final_highlights
