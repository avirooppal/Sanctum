import base64
import sys
import unittest
from pathlib import Path

from jsonschema import ValidationError

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.realtime_session import RealtimeDictationSession  # noqa: E402
from sanctum_speech.types import TranscriptSegment, TranscriptionResult  # noqa: E402


class FakeASR:
    def __init__(self):
        self.calls = []

    def transcribe(self, audio, *, language=None, prompt=None):
        self.calls.append((audio, language, prompt))
        return TranscriptionResult(
            "spoken words",
            (TranscriptSegment(0, audio.duration_seconds, "spoken words"),),
            language,
            audio.duration_seconds,
        )


class RealtimeDictationSessionTests(unittest.TestCase):
    def setUp(self):
        self.asr = FakeASR()
        self.context = {
            "workspace_id": "workspace-1",
            "data_class": "confidential",
            "trace_id": "a" * 32,
            "policy_context": {"cloud_enabled": False},
        }
        self.session = RealtimeDictationSession(self.asr, context=self.context, language="en-US")

    def test_chunk_append_commit_returns_final_local_transcript(self):
        encoded = base64.b64encode(b"\0\0" * 16000).decode("ascii")
        self.assertIsNone(
            self.session.handle(
                {
                    "type": "input_audio_buffer.append",
                    "audio": encoded,
                    "sample_rate": 16000,
                    "channels": 1,
                }
            )
        )
        result = self.session.handle({"type": "input_audio_buffer.commit"})
        self.assertEqual(
            result,
            {
                "type": "transcript.delta",
                "text": "spoken words",
                "final": True,
                "start": 0,
                "end": 1.0,
            },
        )
        self.assertEqual(len(self.asr.calls), 1)
        self.assertEqual(self.asr.calls[0][1], "en-US")

    def test_cancel_clears_buffer_without_calling_asr(self):
        self.session.handle(
            {
                "type": "input_audio_buffer.append",
                "audio": "AQIDBA==",
                "sample_rate": 16000,
                "channels": 1,
            }
        )
        result = self.session.handle({"type": "response.cancel", "reason": "user_cancel"})
        self.assertIsNone(result)
        self.assertEqual(self.session.buffered_bytes, 0)
        self.assertEqual(self.asr.calls, [])

    def test_rejects_cloud_context_and_client_output_events(self):
        with self.assertRaises(ValidationError):
            RealtimeDictationSession(
                self.asr, context={**self.context, "policy_context": {"cloud_enabled": True}}
            )
        with self.assertRaises(ValueError):
            self.session.handle(
                {
                    "type": "response.audio.delta",
                    "audio": "AQID",
                    "sample_rate": 16000,
                    "sequence": 0,
                }
            )


if __name__ == "__main__":
    unittest.main()
