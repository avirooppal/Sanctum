"""Local, engine-agnostic file transcription orchestration."""

from dataclasses import replace

from .interfaces import ASREngine, Diarizer, VoiceActivityDetector
from .types import AudioBuffer, AudioInterval, TranscriptSegment, TranscriptionResult


class TranscriptionPipeline:
    def __init__(
        self,
        vad: VoiceActivityDetector,
        asr: ASREngine,
        diarizer: Diarizer | None = None,
    ):
        self.vad = vad
        self.asr = asr
        self.diarizer = diarizer

    def transcribe(
        self,
        audio: AudioBuffer,
        *,
        language: str | None = None,
        prompt: str | None = None,
        diarize: bool = False,
    ) -> TranscriptionResult:
        intervals = tuple(self.vad.speech_intervals(audio))
        previous_end = 0.0
        for interval in intervals:
            if not isinstance(interval, AudioInterval):
                raise TypeError("VAD must return AudioInterval values")
            if interval.start < previous_end:
                raise ValueError("VAD intervals must be sorted and non-overlapping")
            if interval.end > audio.duration_seconds + 1 / audio.sample_rate:
                raise ValueError("VAD interval exceeds audio duration")
            previous_end = interval.end

        if diarize and self.diarizer is None:
            raise ValueError("diarization requested without a configured local diarizer")

        segments: list[TranscriptSegment] = []
        detected_languages = []
        for interval in intervals:
            local_audio = audio.crop(interval)
            result = self.asr.transcribe(local_audio, language=language, prompt=prompt)
            if not isinstance(result, TranscriptionResult):
                raise TypeError("ASR engine must return TranscriptionResult")
            if result.language:
                detected_languages.append(result.language)
            for segment in result.segments:
                if segment.end > local_audio.duration_seconds + 1 / audio.sample_rate:
                    raise ValueError("ASR segment exceeds its audio interval")
                segments.append(
                    replace(
                        segment,
                        start=segment.start + interval.start,
                        end=segment.end + interval.start,
                    )
                )

        if diarize:
            assigned = tuple(self.diarizer.assign(audio, tuple(segments)))
            if len(assigned) != len(segments):
                raise ValueError("diarizer must return one labeled segment per input segment")
            for before, after in zip(segments, assigned, strict=True):
                if (before.start, before.end, before.text) != (after.start, after.end, after.text):
                    raise ValueError("diarizer must preserve transcript text and timestamps")
                if after.speaker_id is None:
                    raise ValueError("diarizer returned an unlabeled segment")
            segments = list(assigned)

        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        detected_language = detected_languages[0] if detected_languages else language
        return TranscriptionResult(
            text=text,
            segments=tuple(segments),
            language=detected_language,
            duration=audio.duration_seconds,
        )
