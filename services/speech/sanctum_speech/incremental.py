"""Bounded prefix re-decoding; revised snapshots, not native streaming inference."""

import math
import threading

from .types import AudioBuffer


class IncrementalASR:
    def __init__(self, engine, *, interval_seconds=2, max_seconds=30):
        if (
            not math.isfinite(interval_seconds)
            or not math.isfinite(max_seconds)
            or not 0 < interval_seconds <= max_seconds <= 30
        ):
            raise ValueError("interval and maximum must be finite, positive and at most 30 seconds")
        self.engine = engine
        self.interval_bytes = max(2, int(interval_seconds * 16000) * 2)
        self.max_bytes = int(max_seconds * 16000) * 2
        self._audio = bytearray()
        self._last_bytes = 0
        self._generation = 0
        self._revision = 0
        self._busy = False
        self._lock = threading.Lock()

    @property
    def buffered_bytes(self):
        with self._lock:
            return len(self._audio)

    def cancel(self):
        with self._lock:
            self._clear()

    def _clear(self):
        self._audio.clear()
        self._last_bytes = 0
        self._generation += 1

    def append(self, pcm_s16le: bytes):
        return self._process(pcm_s16le, final=False)

    def finish(self):
        return self._process(None, final=True)

    def _process(self, chunk, *, final):
        with self._lock:
            if self._busy:
                raise RuntimeError("inference already running for this session")
            if not final:
                if not isinstance(chunk, bytes) or not chunk or len(chunk) % 2:
                    raise ValueError("nonempty complete PCM16 frames required")
                if len(self._audio) + len(chunk) > self.max_bytes:
                    raise ValueError("session audio limit exceeded")
                self._audio.extend(chunk)
                if len(self._audio) - self._last_bytes < self.interval_bytes:
                    return None
            if not self._audio:
                raise ValueError("cannot finish empty audio")
            audio = AudioBuffer(pcm_s16le=bytes(self._audio), sample_rate=16000, channels=1)
            generation = self._generation
            self._busy = True
        try:
            result = self.engine.transcribe(audio)
            with self._lock:
                if generation != self._generation:
                    return None
                self._revision += 1
                self._last_bytes = len(self._audio)
                if final:
                    self._clear()
                return {
                    "revision": self._revision,
                    "text": result.text,
                    "final": final,
                    "audio_seconds": audio.duration_seconds,
                }
        except Exception:
            with self._lock:
                self._clear()
            raise
        finally:
            with self._lock:
                self._busy = False
