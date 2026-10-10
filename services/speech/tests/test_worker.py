import importlib.util
import json
import base64
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
spec = importlib.util.spec_from_file_location("speech_worker", ROOT / "services/speech/worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
from test_multipart import body  # noqa: E402
from sanctum_speech.types import AudioBuffer  # noqa: E402


class SpeechWorkerTests(unittest.TestCase):
    def test_synthesis_preserves_audio_and_rejects_forged_context(self):
        voice = "tts-flite-slt-reference"
        profile = {"id": voice, "voices": {voice: "slt"}}
        request = {"model": voice, "voice": voice, "input": "hello", "response_format": "pcm"}
        with patch.object(worker.FliteTTS, "from_profile") as factory:
            factory.return_value.synthesize.return_value = AudioBuffer(b"\1\0" * 1600, 16000)
            result = worker.process_synthesis(
                profile, voice, "application/json", "a" * 32, json.dumps(request).encode()
            )
            self.assertEqual(base64.b64decode(result["audio_base64"]), b"\1\0" * 1600)
            factory.reset_mock()
            request["context"] = {"workspace_id": "other"}
            with self.assertRaises(ValueError):
                worker.process_synthesis(
                    profile, voice, "application/json", "a" * 32, json.dumps(request).encode()
                )
            factory.assert_not_called()

    def test_direct_host_startup_refuses_before_processing(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "services/speech/worker.py")],
            capture_output=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"")

    def test_rejects_workspace_spoof_before_loading_engine(self):
        forged = json.dumps({"workspace_id": "another-tenant"}).encode()
        with patch.object(worker, "load_asr") as engine:
            with self.assertRaises(ValueError):
                worker.process(
                    {},
                    "asr",
                    "multipart/form-data; boundary=sample",
                    "a" * 32,
                    body([("file", b"x"), ("context", forged)]),
                )
            engine.assert_not_called()

    def test_worker_rejects_unregistered_weights_before_launch(self):
        profile = {
            "schema_version": "1.0",
            "id": "asr",
            "egress": "denied",
            "vad": {"engine": "none"},
            "asr": {
                "engine": "whisper.cpp",
                "model_path": "/model",
                "model_sha256": "a" * 64,
                "executable_path": "/whisper",
                "executable_sha256": "b" * 64,
                "threads": 1,
                "timeout_seconds": 120,
            },
        }
        with patch.object(worker, "load_asr") as engine:
            with self.assertRaises(ValueError):
                worker.process(
                    profile,
                    "asr",
                    "multipart/form-data; boundary=sample",
                    "a" * 32,
                    body([("file", b"x")]),
                )
            engine.assert_not_called()
