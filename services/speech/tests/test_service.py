import io
import sys
import unittest
import wave
from pathlib import Path

from jsonschema import ValidationError

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.interfaces import ASREngine, VoiceActivityDetector  # noqa: E402
from sanctum_speech.pipeline import TranscriptionPipeline  # noqa: E402
from sanctum_speech.service import TranscriptionService  # noqa: E402
from sanctum_speech.types import AudioInterval, TranscriptSegment, TranscriptionResult  # noqa: E402


def make_wav():
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 16000)
    return output.getvalue()


class WholeClipVAD(VoiceActivityDetector):
    def speech_intervals(self, audio):
        return (AudioInterval(0, audio.duration_seconds),)


class HelloASR(ASREngine):
    def transcribe(self, audio, *, language=None, prompt=None):
        return TranscriptionResult(
            "hello",
            (TranscriptSegment(0, audio.duration_seconds, "hello"),),
            "en",
            audio.duration_seconds,
        )


class TranscriptionServiceTests(unittest.TestCase):
    def setUp(self):
        self.service = TranscriptionService(
            TranscriptionPipeline(WholeClipVAD(), HelloASR()), model_id="local-speech-v1"
        )
        self.request = {
            "model": "local-speech-v1",
            "language": "en-US",
            "response_format": "verbose_json",
            "context": {
                "workspace_id": "workspace-1",
                "data_class": "confidential",
                "trace_id": "a" * 32,
                "policy_context": {"cloud_enabled": False},
            },
        }

    def test_upload_runs_local_pipeline_and_returns_contract_response(self):
        content_type, response = self.service.transcribe_upload(self.request, make_wav())
        self.assertEqual(content_type, "application/json")
        self.assertEqual(response["text"], "hello")
        self.assertEqual(response["segments"][0]["text"], "hello")

    def test_text_and_vtt_responses_are_supported(self):
        for response_format, expected_type in (
            ("text", "text/plain; charset=utf-8"),
            ("vtt", "text/vtt; charset=utf-8"),
        ):
            request = {**self.request, "response_format": response_format}
            content_type, _ = self.service.transcribe_upload(request, make_wav())
            self.assertEqual(content_type, expected_type)

    def test_rejects_invalid_context_unknown_fields_and_remote_model_names(self):
        invalid = (
            {**self.request, "extra": "ignored fields are forbidden"},
            {**self.request, "model": "remote-model"},
            {
                **self.request,
                "context": {**self.request["context"], "policy_context": {"cloud_enabled": True}},
            },
        )
        for request in invalid:
            with self.subTest(request=request), self.assertRaises((ValueError, ValidationError)):
                self.service.transcribe_upload(request, make_wav())

    def test_rejects_oversized_upload_before_pipeline(self):
        service = TranscriptionService(
            TranscriptionPipeline(WholeClipVAD(), HelloASR()),
            model_id="local-speech-v1",
            max_upload_bytes=32,
        )
        with self.assertRaises(ValueError):
            service.transcribe_upload(self.request, make_wav())


if __name__ == "__main__":
    unittest.main()
