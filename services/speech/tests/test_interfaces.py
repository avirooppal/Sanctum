import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sanctum_speech.pipeline import TranscriptionPipeline
from sanctum_speech.types import AudioBuffer, AudioInterval, TranscriptSegment, TranscriptionResult


class StubVAD:
    def __init__(self, intervals):
        self.intervals = intervals

    def speech_intervals(self, audio):
        return self.intervals


class StubASR:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def transcribe(self, audio, *, language=None, prompt=None):
        self.calls.append((audio, language, prompt))
        return self.result


class StubDiarizer:
    def assign(self, audio, segments):
        return [TranscriptSegment(s.start, s.end, s.text, "speaker-1") for s in segments]


class SpeechInterfaceTests(unittest.TestCase):
    def test_audio_buffer_duration_and_crop_are_sample_aligned(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x01" * 16000, sample_rate=16000)
        self.assertEqual(audio.duration_seconds, 1.0)
        cropped = audio.crop(AudioInterval(0.25, 0.75))
        self.assertEqual(cropped.duration_seconds, 0.5)
        self.assertEqual(len(cropped.pcm_s16le), 16000)

    def test_pipeline_applies_vad_and_offsets_asr_timestamps(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x00" * 32000, sample_rate=16000)
        asr = StubASR(TranscriptionResult("hello", (TranscriptSegment(0, 0.2, "hello"),)))
        pipeline = TranscriptionPipeline(StubVAD([AudioInterval(0.25, 0.75)]), asr)
        result = pipeline.transcribe(audio, language="en", prompt="project terms")
        self.assertEqual(result.text, "hello")
        self.assertEqual(result.duration, 2.0)
        self.assertEqual((result.segments[0].start, result.segments[0].end), (0.25, 0.45))
        self.assertEqual(asr.calls[0][0].duration_seconds, 0.5)
        self.assertEqual(asr.calls[0][1:], ("en", "project terms"))

    def test_diarization_is_optional_and_preserves_transcript_timing(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x00" * 16000, sample_rate=16000)
        asr = StubASR(TranscriptionResult("hello", (TranscriptSegment(0, 0.5, "hello"),)))
        pipeline = TranscriptionPipeline(StubVAD([AudioInterval(0, 1)]), asr, StubDiarizer())
        result = pipeline.transcribe(audio, diarize=True)
        self.assertEqual(result.segments[0].speaker_id, "speaker-1")
        self.assertEqual(result.segments[0].start, 0)

    def test_no_speech_does_not_call_asr(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x00" * 16000, sample_rate=16000)
        asr = StubASR(TranscriptionResult("", ()))
        result = TranscriptionPipeline(StubVAD([]), asr).transcribe(audio)
        self.assertEqual(result.text, "")
        self.assertEqual(asr.calls, [])

    def test_invalid_vad_interval_is_rejected_before_asr(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x00" * 16000, sample_rate=16000)
        asr = StubASR(TranscriptionResult("", ()))
        pipeline = TranscriptionPipeline(StubVAD([AudioInterval(0.5, 1.5)]), asr)
        with self.assertRaises(ValueError):
            pipeline.transcribe(audio)
        self.assertEqual(asr.calls, [])

    def test_diarization_requires_configured_engine(self):
        audio = AudioBuffer(pcm_s16le=b"\x00\x00" * 16000, sample_rate=16000)
        pipeline = TranscriptionPipeline(
            StubVAD([AudioInterval(0, 1)]), StubASR(TranscriptionResult("", ()))
        )
        with self.assertRaises(ValueError):
            pipeline.transcribe(audio, diarize=True)


if __name__ == "__main__":
    unittest.main()
