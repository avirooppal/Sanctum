"""Bounded, format-consistent audio accumulation for realtime speech sessions."""

import base64
import binascii

from .types import AudioBuffer

DEFAULT_MAX_AUDIO_BYTES = 25 * 1024 * 1024
HARD_MAX_AUDIO_BYTES = 256 * 1024 * 1024


class RealtimeAudioBuffer:
    def __init__(self, *, max_bytes: int = DEFAULT_MAX_AUDIO_BYTES):
        if type(max_bytes) is not int or not 0 < max_bytes <= HARD_MAX_AUDIO_BYTES:
            raise ValueError("max_bytes must be a positive integer no larger than 256 MiB")
        self.max_bytes = max_bytes
        self._pcm = bytearray()
        self._buffered_bytes = 0
        self._sample_rate: int | None = None
        self._channels: int | None = None

    @property
    def buffered_bytes(self) -> int:
        return self._buffered_bytes

    def append(self, encoded_audio: str, *, sample_rate: int, channels: int = 1) -> None:
        if not isinstance(encoded_audio, str):
            raise ValueError("audio must be base64 text")
        remaining = self.max_bytes - self._buffered_bytes
        if len(encoded_audio) > 4 * ((min(remaining, 1024 * 1024) + 2) // 3):
            raise ValueError("encoded audio exceeds the remaining buffer or message limit")
        try:
            chunk = base64.b64decode(encoded_audio, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("audio must be valid base64") from error
        if not chunk:
            raise ValueError("audio chunk must not be empty")
        # AudioBuffer performs the canonical rate/channel/sample-frame checks.
        AudioBuffer(pcm_s16le=chunk, sample_rate=sample_rate, channels=channels)
        if self._sample_rate is not None and (
            sample_rate != self._sample_rate or channels != self._channels
        ):
            raise ValueError("audio format cannot change within a realtime buffer")
        if self._buffered_bytes + len(chunk) > self.max_bytes:
            raise ValueError("realtime audio buffer exceeds its configured byte limit")
        self._pcm.extend(chunk)
        self._buffered_bytes += len(chunk)
        self._sample_rate = sample_rate
        self._channels = channels

    def commit(self) -> AudioBuffer:
        if self._sample_rate is None or self._channels is None:
            raise ValueError("cannot commit an empty audio buffer")
        if not self._pcm:
            raise ValueError("cannot commit an empty realtime audio buffer")
        audio = AudioBuffer(
            pcm_s16le=bytes(self._pcm),
            sample_rate=self._sample_rate,
            channels=self._channels,
        )
        self._pcm.clear()
        self._buffered_bytes = 0
        self._sample_rate = None
        self._channels = None
        return audio

    def clear(self) -> None:
        self._pcm.clear()
        self._buffered_bytes = 0
        self._sample_rate = None
        self._channels = None
