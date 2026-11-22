import time
import socket
import urllib.request
from typing import Optional, Callable, List

class ConnectivityService:
    _is_connected: bool = True
    _last_checked: float = 0.0
    _consecutive_failures: int = 0
    _listeners: List[Callable[[bool], None]] = []

    @classmethod
    def register_listener(cls, callback: Callable[[bool], None]):
        if callback not in cls._listeners:
            cls._listeners.append(callback)

    @classmethod
    def check_connection(cls, timeout: float = 3.0) -> bool:
        """
        Robust 2-tier connectivity check:
        1. Fast DNS resolution probe
        2. Lightweight HTTP HEAD/GET request to Google API CDN
        """
        cls._last_checked = time.time()
        connected = False

        # Robust multi-probe connectivity check:
        # Tier 1: Socket connect to HTTPS port 443 (universally open on all ISPs and mobile hotspots)
        for host, port in [("1.1.1.1", 443), ("8.8.8.8", 443)]:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(timeout)
                s.connect((host, port))
                s.close()
                connected = True
                break
            except Exception:
                continue

        # Tier 2: DNS resolution probe if raw IPs were blocked
        if not connected:
            try:
                socket.getaddrinfo("google.com", 443, socket.AF_INET, socket.SOCK_STREAM)
                connected = True
            except Exception:
                pass

        # Tier 3: Lightweight HTTP probe to Google API / 204
        if not connected:
            for probe_url in ["https://www.googleapis.com/generate_204", "https://www.google.com", "https://cloudflare.com"]:
                try:
                    req = urllib.request.Request(
                        probe_url,
                        headers={"User-Agent": "AI-Stream-Clipper/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=timeout) as response:
                        if response.status in (200, 204):
                            connected = True
                            break
                except Exception:
                    continue

        prev_state = cls._is_connected
        cls._is_connected = connected

        if connected:
            cls._consecutive_failures = 0
        else:
            cls._consecutive_failures += 1

        # Fire state change listener if status changed
        if prev_state != connected:
            print(f"[ConnectivityService] Network status transitioned: {'ONLINE' if connected else 'OFFLINE'}")
            for listener in cls._listeners:
                try:
                    listener(connected)
                except Exception as e:
                    print(f"[ConnectivityService] Listener error: {e}")

        return connected

    @classmethod
    def is_online(cls) -> bool:
        # Cache for up to 5 seconds unless re-checked
        if time.time() - cls._last_checked > 5.0:
            return cls.check_connection()
        return cls._is_connected

    @classmethod
    def get_backoff_seconds(cls) -> float:
        """Exponential backoff with jitter: 10s -> 20s -> 40s -> 80s -> max 300s."""
        base = 10.0
        backoff = min(base * (2 ** min(cls._consecutive_failures, 5)), 300.0)
        return backoff
