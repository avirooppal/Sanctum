import hashlib
import json
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from subprocess import CompletedProcess

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sanctum_speech.backends.whisper_cpp import WhisperCppASR  # noqa: E402
from sanctum_speech.types import AudioBuffer, TranscriptSegment  # noqa: E402


class WhisperCppAdapterTests(unittest.TestCase):
    def test_invokes_local_cli_without_shell_and_parses_json_timestamps(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root / "whisper-cli.exe"
            model = root / "model.bin"
            executable.touch()
            model.touch()
            captured = {}

            def runner(command, **kwargs):
                captured.update(command=command, kwargs=kwargs)
                audio_path = Path(command[command.index("-f") + 1])
                with wave.open(str(audio_path), "rb") as wav_file:
                    captured["wav"] = (wav_file.getframerate(), wav_file.getnframes())
                output_prefix = Path(command[command.index("-of") + 1])
                Path(f"{output_prefix}.json").write_text(
                    json.dumps(
                        {
                            "result": {"language": "en"},
                            "transcription": [
                                {"offsets": {"from": 100, "to": 500}, "text": " hello"},
                                {"offsets": {"from": 600, "to": 900}, "text": " world "},
                            ],
                        }
                    ),
                    encoding="utf-8",
                )
                return CompletedProcess(command, 0, "", "")

            profile = {
                "id": "local-cpu",
                "egress": "denied",
                "asr": {
                    "engine": "whisper.cpp",
                    "executable_path": str(executable),
                    "executable_sha256": hashlib.sha256(b"").hexdigest(),
                    "model_path": str(model),
                    "model_sha256": hashlib.sha256(b"").hexdigest(),
                    "threads": 3,
                    "timeout_seconds": 120,
                },
            }
            adapter = WhisperCppASR.from_profile(profile, run_process=runner)
            result = adapter.transcribe(
                AudioBuffer(b"\x00\x00" * 16000, 16000), language="en", prompt="names"
            )

            self.assertEqual(result.text, "hello world")
            self.assertEqual(
                result.segments,
                (TranscriptSegment(0.1, 0.5, "hello"), TranscriptSegment(0.6, 0.9, "world")),
            )
            self.assertEqual(result.language, "en")
            self.assertEqual(result.duration, 1.0)
            self.assertFalse(captured["kwargs"].get("shell", False))
            self.assertTrue(captured["kwargs"]["check"])
            self.assertEqual(captured["kwargs"]["timeout"], 120)
            self.assertIn("--prompt", captured["command"])
            self.assertEqual(captured["wav"], (16000, 16000))

    def test_profile_requires_local_executable_model_and_denied_egress(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root / "whisper-cli"
            model = root / "model.bin"
            executable.touch()
            model.touch()
            config = {
                "egress": "denied",
                "asr": {
                    "engine": "whisper.cpp",
                    "executable_path": str(executable),
                    "executable_sha256": hashlib.sha256(b"").hexdigest(),
                    "model_path": str(model),
                    "model_sha256": hashlib.sha256(b"").hexdigest(),
                    "threads": 2,
                },
            }
            self.assertIsInstance(WhisperCppASR.from_profile(config), WhisperCppASR)
            config["egress"] = "allowed"
            with self.assertRaises(ValueError):
                WhisperCppASR.from_profile(config)
            config["egress"] = "denied"
            config["asr"]["model_path"] = "Systran/model"
            with self.assertRaises(ValueError):
                WhisperCppASR.from_profile(config)

            config["asr"]["model_path"] = str(model)
            config["asr"]["model_sha256"] = "0" * 64
            with self.assertRaises(ValueError):
                WhisperCppASR.from_profile(config)

    def test_adapter_rejects_non_mono_16khz_audio(self):
        adapter = WhisperCppASR("whisper-cli", "model.bin")
        with self.assertRaises(ValueError):
            adapter.transcribe(AudioBuffer(b"\x00\x00", 8000))


if __name__ == "__main__":
    unittest.main()
