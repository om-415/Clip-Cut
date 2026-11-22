import numpy as np
import soundfile as sf
from pathlib import Path
from typing import List, Dict, Any

class AudioAnalysisService:
    @staticmethod
    def analyze_audio(wav_path: Path, window_size_sec: float = 0.5, hop_size_sec: float = 0.25) -> List[Dict[str, Any]]:
        """
        Analyzes audio WAV file for loudness peaks, sudden volume surges,
        screams, laughter, and high-energy excitement.
        Returns a time-series list of audio metrics across the entire file.
        """
        # Read 16kHz mono audio
        data, sample_rate = sf.read(str(wav_path))
        if data.ndim > 1:
            data = np.mean(data, axis=1)

        total_samples = len(data)
        duration = total_samples / sample_rate

        window_samples = int(window_size_sec * sample_rate)
        hop_samples = int(hop_size_sec * sample_rate)

        if window_samples <= 0 or hop_samples <= 0 or total_samples < window_samples:
            return [{"timestamp": 0.0, "score": 0.5, "rms": 0.0, "surge": 0.0}]

        # Compute RMS energy per window
        rms_values = []
        timestamps = []
        zcr_values = []

        for start in range(0, total_samples - window_samples + 1, hop_samples):
            window = data[start : start + window_samples]
            rms = np.sqrt(np.mean(window**2))
            
            # Zero crossing rate (indicator of noisy speech/screaming/cheers)
            zcr = np.mean(np.abs(np.diff(np.sign(window)))) / 2.0
            
            rms_values.append(rms)
            zcr_values.append(zcr)
            timestamps.append(start / sample_rate + (window_size_sec / 2.0))

        rms_arr = np.array(rms_values, dtype=np.float32)
        zcr_arr = np.array(zcr_values, dtype=np.float32)

        # Baseline noise floor estimation (10th percentile)
        noise_floor = np.percentile(rms_arr, 10)
        usable_rms = np.maximum(rms_arr - noise_floor, 0.0)

        # Normalize RMS (0 to 1)
        max_rms = np.percentile(usable_rms, 98) or 1e-6
        norm_rms = np.clip(usable_rms / max_rms, 0.0, 1.0)

        # Detect sudden volume surges / delta spikes (screams, sudden yelling)
        # Using forward difference with a rolling local mean
        local_window = int(4.0 / hop_size_sec)  # 4 second local baseline
        rolling_mean = np.convolve(usable_rms, np.ones(local_window) / local_window, mode='same')
        
        # Surge is when current volume is significantly higher than recent baseline
        surge_ratio = np.where(rolling_mean > 1e-5, usable_rms / (rolling_mean + 1e-5), 1.0)
        norm_surge = np.clip((surge_ratio - 1.0) / 4.0, 0.0, 1.0)

        # High-frequency energy / zero-crossing activity
        norm_zcr = np.clip(zcr_arr / (np.percentile(zcr_arr, 95) or 1e-4), 0.0, 1.0)

        # Combined Audio Excitement Score:
        # 50% absolute loudness + 35% sudden surge + 15% high-frequency vocal friction/cheer
        combined_scores = (0.50 * norm_rms) + (0.35 * norm_surge) + (0.15 * norm_zcr)
        combined_scores = np.clip(combined_scores, 0.0, 1.0)

        # Format output timeline
        results = []
        for i in range(len(timestamps)):
            results.append({
                "timestamp": round(float(timestamps[i]), 3),
                "score": round(float(combined_scores[i]), 4),
                "rms": round(float(norm_rms[i]), 4),
                "surge": round(float(norm_surge[i]), 4),
                "zcr": round(float(norm_zcr[i]), 4),
            })

        return results
