import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

class HighlightScoringService:
    @staticmethod
    def calculate_composite_score(
        audio_score: float,
        speech_score: float,
        visual_score: float,
        face_score: float,
        gameplay_score: float,
        weights: Optional[Dict[str, float]] = None
    ) -> float:
        """
        Calculates weighted composite highlight score normalized to 0-100.
        Default balance:
        - Audio: 30%
        - Speech: 30%
        - Visual: 15%
        - Face Reaction: 15%
        - Gameplay: 10%
        """
        w = weights or {
            "audio": 0.30,
            "speech": 0.30,
            "visual": 0.15,
            "face": 0.15,
            "gameplay": 0.10,
        }

        total_weight = sum(w.values())
        raw_score = (
            w["audio"] * audio_score +
            w["speech"] * speech_score +
            w["visual"] * visual_score +
            w["face"] * face_score +
            w["gameplay"] * gameplay_score
        ) / total_weight

        # Normalize to 0-100 scale with dynamic range expansion
        normalized_score = np.clip(raw_score * 100.0, 0.0, 100.0)
        return round(float(normalized_score), 1)

    @staticmethod
    def categorize_moment(
        audio_score: float,
        speech_score: float,
        visual_score: float,
        face_score: float,
        transcript: str
    ) -> Tuple[str, str]:
        """
        Determines the most descriptive category and summary description for the highlight.
        """
        transcript_lower = transcript.lower()

        # Check for reaction / shock
        if face_score > 0.6 or any(k in transcript_lower for k in ["no way", "oh my god", "what?!", "what the"]):
            return (
                "Insane Reaction",
                f"Streamer has an unforgettable reaction: \"{transcript[:60]}...\"" if transcript else "Shocking moment with intense reaction."
            )
        
        # Check for clutch / victory play
        if visual_score > 0.6 and (audio_score > 0.6 or "clutch" in transcript_lower or "one shot" in transcript_lower):
            return (
                "Epic Clutch",
                "High-intensity gameplay action with peak engagement and triumphant payoff."
            )

        # Check for funny moment / laughter
        if any(k in transcript_lower for k in ["haha", "lmao", "bro", "crazy", "why did you"]):
            return (
                "Funny Moment",
                f"Hilarious sequence: \"{transcript[:60]}...\"" if transcript else "Humorous stream highlight."
            )

        # Check for high energy
        if audio_score > 0.65 or "let's go" in transcript_lower:
            return (
                "High Energy Play",
                "Massive volume surge and crowd hype during peak stream action."
            )

        return (
            "Stream Highlight",
            f"Entertaining commentary and action: \"{transcript[:60]}...\"" if transcript else "Key entertaining moment from the stream."
        )
