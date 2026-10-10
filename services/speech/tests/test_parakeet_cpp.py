import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_speech.backends.parakeet_cpp import ParakeetCppASR
from sanctum_speech.types import AudioBuffer


class ParakeetTests(unittest.TestCase):
    def test_reads_text_artifact_and_reports_coarse_timing(self):
        def run(command, **options):
            self.assertFalse(options["shell"])
            self.assertIn("--no-gpu", command)
            output = Path(command[command.index("--output-file") + 1] + ".txt")
            output.write_text("hello world\n")
            return subprocess.CompletedProcess(command, 0)

        engine = ParakeetCppASR(Path("/asr"), Path("/model"), run_process=run)
        result = engine.transcribe(AudioBuffer(b"\0\0" * 16000, 16000), language="en")
        self.assertEqual(result.text, "hello world")
        self.assertIsNone(result.language)
        self.assertEqual((result.segments[0].start, result.segments[0].end), (0, 1))

    def test_rejects_prompt_and_unsupported_audio_before_launch(self):
        def forbidden(*args, **kwargs):
            self.fail("invalid input launched inference")

        engine = ParakeetCppASR(Path("/asr"), Path("/model"), run_process=forbidden)
        with self.assertRaises(ValueError):
            engine.transcribe(AudioBuffer(b"\0\0" * 16000, 16000), prompt="vocabulary")
        with self.assertRaises(ValueError):
            engine.transcribe(AudioBuffer(b"\0\0" * 16000, 8000))

    def test_missing_or_cloud_profile_is_rejected(self):
        for profile in [
            {"egress": "allowed"},
            {"egress": "denied", "asr": {"engine": "whisper.cpp"}},
        ]:
            with self.assertRaises(ValueError):
                ParakeetCppASR.from_profile(profile)
