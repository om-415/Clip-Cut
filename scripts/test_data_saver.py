import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.services.video_service import VideoService
from backend.services.highlight_detection import HighlightDetectionService
from backend.services.clip_generator import ClipGeneratorService
from backend.services.pipeline_manager import PipelineManager
from backend.app.main import app

def test_imports_and_signatures():
    print("[TEST] Testing highlight detection with custom_weights...")
    # Test data saver custom weights in highlight detection
    audio_tl = [{"timestamp": 10.0, "score": 0.9}, {"timestamp": 11.0, "score": 0.85}]
    speech_segs = [{"start": 9.0, "end": 14.0, "text": "NO WAY THAT WAS INSANE BRO!", "score": 0.95}]
    
    weights = {"audio": 0.55, "speech": 0.45, "visual": 0.0, "face": 0.0, "gameplay": 0.0}
    highlights = HighlightDetectionService.detect_highlights(
        total_duration=60.0,
        audio_timeline=audio_tl,
        speech_segments=speech_segs,
        motion_timeline=[],
        reaction_timeline=[],
        target_clip_duration=25.0,
        top_k=1,
        custom_weights=weights
    )
    
    assert len(highlights) == 1, "Expected 1 highlight"
    hl = highlights[0]
    print(f"[TEST] Highlight detected: score={hl['score']}, category={hl['category']}, start={hl['start_time']}s, end={hl['end_time']}s")
    assert hl['score'] > 0, "Highlight score should be > 0"
    
    print("[TEST] All tests passed with flying colors!")

if __name__ == "__main__":
    test_imports_and_signatures()
