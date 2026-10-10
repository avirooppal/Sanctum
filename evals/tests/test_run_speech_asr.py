import hashlib
import json
import sys
import tempfile
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evals"))
sys.path.insert(0, str(ROOT / "services/speech"))
from run_speech_asr import run_benchmark  # noqa: E402
from sanctum_speech.types import TranscriptSegment, TranscriptionResult  # noqa: E402


class FakeASR:
    def transcribe(self, audio, *, language=None, prompt=None):
        return TranscriptionResult(
            "hello world",
            (TranscriptSegment(0, audio.duration_seconds, "hello world"),),
            language,
            audio.duration_seconds,
        )


class SpeechASRRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.audio_dir = self.root / "audio"
        self.audio_dir.mkdir()
        self.wav = self.audio_dir / "sample.wav"
        with wave.open(str(self.wav), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(16000)
            output.writeframes(b"\0\0" * 16000)
        self.manifest = {
            "suite": "fixture",
            "dataset_license": "CC0-1.0",
            "profile_id": "cpu",
            "hardware_tier": "T0",
            "wer_target": 0.1,
            "records": [
                {
                    "id": "one",
                    "audio_path": "audio/sample.wav",
                    "audio_sha256": hashlib.sha256(self.wav.read_bytes()).hexdigest(),
                    "language": "en-US",
                    "reference": "hello world",
                }
            ],
        }
        self.manifest_path = self.root / "manifest.json"
        self.manifest_path.write_text(json.dumps(self.manifest))
        self.profile_path = self.root / "profile.json"
        self.profile_path.write_text(
            json.dumps(
                {
                    "schema_version": "1.0",
                    "id": "cpu",
                    "asr": {
                        "engine": "whisper.cpp",
                        "model_path": str(self.root / "model.bin"),
                        "model_sha256": "a" * 64,
                        "executable_path": str(self.root / "whisper"),
                        "executable_sha256": "b" * 64,
                        "threads": 1,
                    },
                    "vad": {"engine": "none"},
                    "egress": "denied",
                }
            )
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_runs_hash_verified_local_wav_and_produces_asr_only_results(self):
        output = run_benchmark(
            self.manifest_path, self.profile_path, asr_factory=lambda _: FakeASR()
        )
        self.assertEqual(output["records"][0]["hypothesis"], "hello world")
        self.assertGreater(output["records"][0]["asr_seconds"], 0)
        self.assertNotIn("voice_turns", output)

    def test_rejects_path_escape(self):
        outside = self.root.parent / f"{self.root.name}-escape.wav"
        outside.write_bytes(self.wav.read_bytes())
        try:
            self.manifest["records"][0]["audio_path"] = f"../{outside.name}"
            self.manifest_path.write_text(json.dumps(self.manifest))
            with self.assertRaises(ValueError):
                run_benchmark(
                    self.manifest_path, self.profile_path, asr_factory=lambda _: FakeASR()
                )
        finally:
            outside.unlink(missing_ok=True)

    def test_rejects_hash_mismatch_and_invalid_wav(self):
        self.manifest["records"][0]["audio_sha256"] = "0" * 64
        self.manifest_path.write_text(json.dumps(self.manifest))
        with self.assertRaises(ValueError):
            run_benchmark(self.manifest_path, self.profile_path, asr_factory=lambda _: FakeASR())
        self.manifest["records"][0]["audio_sha256"] = hashlib.sha256(
            self.wav.read_bytes()
        ).hexdigest()
        self.wav.write_bytes(b"not wave")
        self.manifest["records"][0]["audio_sha256"] = hashlib.sha256(
            self.wav.read_bytes()
        ).hexdigest()
        self.manifest_path.write_text(json.dumps(self.manifest))
        with self.assertRaises(ValueError):
            run_benchmark(self.manifest_path, self.profile_path, asr_factory=lambda _: FakeASR())


if __name__ == "__main__":
    unittest.main()
