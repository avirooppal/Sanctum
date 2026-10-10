import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.responses import format_transcription  # noqa: E402
from sanctum_speech.types import TranscriptSegment, TranscriptionResult  # noqa: E402


class TranscriptionResponseTests(unittest.TestCase):
    def setUp(self):
        self.result = TranscriptionResult(
            "hello world",
            (
                TranscriptSegment(0.25, 1.5, "hello"),
                TranscriptSegment(1.5, 2.0, "world", "speaker-1"),
            ),
            "en",
            2.0,
        )

    def test_json_and_text_formats_match_openai_contract(self):
        media_type, body = format_transcription(self.result, "json")
        self.assertEqual(media_type, "application/json")
        self.assertEqual(body, {"text": "hello world"})
        self.assertEqual(
            format_transcription(self.result, "text"), ("text/plain; charset=utf-8", "hello world")
        )

    def test_verbose_json_includes_timed_speaker_segments(self):
        media_type, body = format_transcription(self.result, "verbose_json")
        self.assertEqual(media_type, "application/json")
        self.assertEqual(body["language"], "en")
        self.assertEqual(body["duration"], 2.0)
        self.assertEqual(
            body["segments"][1],
            {"start": 1.5, "end": 2.0, "text": "world", "speaker_id": "speaker-1"},
        )

    def test_vtt_uses_stable_millisecond_timestamps(self):
        media_type, body = format_transcription(self.result, "vtt")
        self.assertEqual(media_type, "text/vtt; charset=utf-8")
        self.assertEqual(
            body,
            "WEBVTT\n\n00:00:00.250 --> 00:00:01.500\nhello\n\n00:00:01.500 --> 00:00:02.000\nworld\n",
        )

    def test_unsupported_format_is_rejected(self):
        with self.assertRaises(ValueError):
            format_transcription(self.result, "srt")


if __name__ == "__main__":
    unittest.main()
