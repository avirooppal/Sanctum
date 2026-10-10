"""Replaceable local speech-engine contracts."""

from typing import Protocol, Sequence

from .types import AudioBuffer, AudioInterval, TranscriptSegment, TranscriptionResult


class VoiceActivityDetector(Protocol):
    def speech_intervals(self, audio: AudioBuffer) -> Sequence[AudioInterval]: ...


class ASREngine(Protocol):
    def transcribe(
        self, audio: AudioBuffer, *, language: str | None = None, prompt: str | None = None
    ) -> TranscriptionResult: ...


class Diarizer(Protocol):
    def assign(
        self, audio: AudioBuffer, segments: Sequence[TranscriptSegment]
    ) -> Sequence[TranscriptSegment]: ...


class TTSEngine(Protocol):
    def synthesize(self, text: str, *, voice: str, sample_rate: int = 24000) -> AudioBuffer: ...
