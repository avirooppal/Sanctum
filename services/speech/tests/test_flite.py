import subprocess
import json
import sys
import unittest
import wave
from jsonschema import Draft202012Validator
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_speech.backends.flite import FliteTTS


class FliteTests(unittest.TestCase):
    def test_tts_profile_contract_rejects_voice_urls_and_unknown_fields(self):
        root = Path(__file__).resolve().parents[3]
        schema = json.loads((root / "docs/contracts/tts-profile-v1.schema.json").read_text())
        validator = Draft202012Validator(schema)
        profile = {
            "schema_version": "1.0",
            "id": "tts",
            "engine": "flite",
            "egress": "denied",
            "executable_path": "/flite",
            "executable_sha256": "a" * 64,
            "voices": {"local": "slt"},
            "timeout_seconds": 120,
        }
        validator.validate(profile)
        self.assertFalse(
            validator.is_valid({**profile, "voices": {"local": "https://remote/voice"}})
        )
        self.assertFalse(validator.is_valid({**profile, "cloud_fallback": True}))

    def test_text_is_a_private_file_and_speed_is_forwarded(self):
        paths = []

        def run(command, **options):
            self.assertFalse(options["shell"])
            text_file = Path(command[command.index("-f") + 1])
            paths.append(text_file)
            self.assertEqual(text_file.read_text(), "--untrusted text")
            self.assertIn("duration_stretch=0.5", command)
            with wave.open(command[command.index("-o") + 1], "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(b"\0\0" * 1600)
            return subprocess.CompletedProcess(command, 0)

        engine = FliteTTS(Path("/flite"), {"voice-id": "slt"}, run_process=run)
        result = engine.synthesize("--untrusted text", voice="voice-id", speed=2)
        self.assertEqual(result.sample_rate, 16000)
        self.assertEqual(result.duration_seconds, 0.1)
        self.assertFalse(paths[0].exists())

    def test_rejects_unregistered_voice_and_invalid_parameters(self):
        engine = FliteTTS(Path("/flite"), {"voice-id": "slt"})
        for options in [
            {"voice": "https://remote/voice"},
            {"voice": "voice-id", "speed": 0},
            {"voice": "voice-id", "speed": float("nan")},
            {"voice": "voice-id", "sample_rate": 48000},
        ]:
            with self.assertRaises(ValueError):
                engine.synthesize("hello", **options)

    def test_profile_must_deny_egress_and_pin_artifact(self):
        with self.assertRaises(ValueError):
            FliteTTS.from_profile({"egress": "allowed"})
