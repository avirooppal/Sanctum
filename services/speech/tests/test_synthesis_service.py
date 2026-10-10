import io
import sys
import unittest
import wave
from pathlib import Path

from jsonschema import ValidationError

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.service import SpeechSynthesisService  # noqa: E402
from sanctum_speech.types import AudioBuffer  # noqa: E402


def voice_registry_entry(license_id="MIT"):
    return {
        "id": "voice-en",
        "license": license_id,
        "license_url": "https://example.invalid/voice-license",
        "verified_at": "2026-10-10",
        "sha256": "a" * 64,
        "format": "onnx",
        "capabilities": ["tts"],
        "source": "https://example.invalid/voice",
        "revision": "fixture-revision",
    }


class FakeTTS:
    def __init__(self):
        self.calls = []

    def synthesize(self, text, *, voice, sample_rate=24000, speed=1.0):
        self.calls.append((text, voice, sample_rate, speed))
        return AudioBuffer(b"\0\0" * 240, sample_rate=sample_rate, channels=1)


class SpeechSynthesisServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = FakeTTS()
        self.service = SpeechSynthesisService(
            self.engine,
            model_id="local-tts-v1",
            voices={"voice-en": voice_registry_entry()},
        )
        self.request = {
            "model": "local-tts-v1",
            "input": "Hello local speech.",
            "voice": "voice-en",
            "context": {
                "workspace_id": "workspace-1",
                "data_class": "internal",
                "trace_id": "b" * 32,
                "policy_context": {"cloud_enabled": False},
            },
        }

    def test_returns_pcm_and_wav_from_configured_local_voice(self):
        content_type, pcm = self.service.synthesize({**self.request, "response_format": "pcm"})
        self.assertEqual(content_type, "audio/pcm")
        self.assertEqual(pcm, b"\0\0" * 240)
        wav_type, encoded = self.service.synthesize(
            {**self.request, "response_format": "wav", "speed": 1.25}
        )
        self.assertEqual(wav_type, "audio/wav")
        with wave.open(io.BytesIO(encoded), "rb") as wav:
            self.assertEqual(
                (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()), (24000, 1, 2)
            )
        self.assertEqual(self.engine.calls[-1], ("Hello local speech.", "voice-en", 24000, 1.25))

    def test_rejects_unknown_voice_model_extra_fields_and_cloud_policy(self):
        invalid = (
            {**self.request, "voice": "not-configured"},
            {**self.request, "model": "remote-model"},
            {**self.request, "unexpected": True},
            {
                **self.request,
                "context": {**self.request["context"], "policy_context": {"cloud_enabled": True}},
            },
        )
        for request in invalid:
            with self.subTest(request=request), self.assertRaises((ValueError, ValidationError)):
                self.service.synthesize(request)

    def test_rejects_invalid_voice_registry_and_oversized_audio(self):
        with self.assertRaises(ValueError):
            SpeechSynthesisService(self.engine, model_id="tts", voices={"v": ""})
        with self.assertRaises(ValueError):
            SpeechSynthesisService(
                self.engine, model_id="tts", voices={"v": voice_registry_entry("CC-BY-4.0")}
            )
        service = SpeechSynthesisService(
            self.engine,
            model_id="local-tts-v1",
            voices={"voice-en": voice_registry_entry()},
            max_audio_bytes=16,
        )
        with self.assertRaises(ValueError):
            service.synthesize(self.request)


if __name__ == "__main__":
    unittest.main()
