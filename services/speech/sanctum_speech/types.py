"""Engine-independent speech value types."""

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class AudioInterval:
    start: float
    end: float

    def __post_init__(self):
        if not math.isfinite(self.start) or not math.isfinite(self.end):
            raise ValueError("audio interval times must be finite")
        if self.start < 0 or self.end <= self.start:
            raise ValueError("audio interval must have a positive duration")


@dataclass(frozen=True)
class AudioBuffer:
    """Interleaved signed 16-bit little-endian PCM, independent of engine format."""

    pcm_s16le: bytes
    sample_rate: int
    channels: int = 1

    def __post_init__(self):
        if not isinstance(self.pcm_s16le, bytes):
            raise TypeError("audio payload must be bytes")
        if type(self.sample_rate) is not int or not 8000 <= self.sample_rate <= 48000:
            raise ValueError("sample rate must be between 8 kHz and 48 kHz")
        if type(self.channels) is not int or self.channels not in (1, 2):
            raise ValueError("audio must have one or two channels")
        if len(self.pcm_s16le) % (2 * self.channels):
            raise ValueError("PCM payload must contain complete sample frames")

    @property
    def frame_count(self):
        return len(self.pcm_s16le) // (2 * self.channels)

    @property
    def duration_seconds(self):
        return self.frame_count / self.sample_rate

    def crop(self, interval: AudioInterval):
        duration = self.duration_seconds
        if interval.end > duration + 1 / self.sample_rate:
            raise ValueError("audio interval exceeds buffer duration")
        start_frame = round(interval.start * self.sample_rate)
        end_frame = min(self.frame_count, round(interval.end * self.sample_rate))
        if end_frame <= start_frame:
            raise ValueError("audio interval contains no complete sample frame")
        frame_size = 2 * self.channels
        return AudioBuffer(
            self.pcm_s16le[start_frame * frame_size : end_frame * frame_size],
            self.sample_rate,
            self.channels,
        )


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    text: str
    speaker_id: str | None = None

    def __post_init__(self):
        if not math.isfinite(self.start) or not math.isfinite(self.end):
            raise ValueError("transcript timestamps must be finite")
        if self.start < 0 or self.end <= self.start:
            raise ValueError("transcript segment must have a positive duration")
        if not isinstance(self.text, str):
            raise TypeError("transcript text must be a string")
        if self.speaker_id is not None and not self.speaker_id:
            raise ValueError("speaker ID cannot be empty")


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    segments: tuple[TranscriptSegment, ...]
    language: str | None = None
    duration: float | None = None
