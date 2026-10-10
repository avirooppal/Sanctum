import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_speech.backends.silero_cpp import SileroCppVAD
from sanctum_speech.types import AudioBuffer


class SileroCppTests(unittest.TestCase):
    def test_converts_centiseconds_and_uses_local_process(self):
        calls = []

        def run(command, **options):
            calls.append((command, options))
            return subprocess.CompletedProcess(
                command,
                0,
                "\nDetected 1 speech segments:\nSpeech segment 0: start = 25.00, end = 75.00\n",
            )

        vad = SileroCppVAD(Path("/vad"), Path("/model"), threads=2, run_process=run)
        intervals = vad.speech_intervals(AudioBuffer(b"\0\0" * 16000, 16000))
        self.assertEqual([(i.start, i.end) for i in intervals], [(0.25, 0.75)])
        self.assertFalse(calls[0][1]["shell"])
        self.assertTrue(calls[0][1]["check"])
        self.assertIn("--vad-model", calls[0][0])
        self.assertFalse(Path(calls[0][0][calls[0][0].index("--file") + 1]).exists())

    def test_silence_and_malformed_output(self):
        audio = AudioBuffer(b"\0\0" * 16000, 16000)
        for text, valid in [
            ("Detected 0 speech segments:\n", True),
            ("", False),
            ("Detected 1 speech segments:\n", False),
            ("Detected 1 speech segments:\nSpeech segment 0: start = 0.00, end = 200.00", False),
            (
                "Detected 2 speech segments:\nSpeech segment 0: start = 0.00, end = 70.00\nSpeech segment 1: start = 60.00, end = 80.00",
                False,
            ),
        ]:

            def run(command, **_):
                return subprocess.CompletedProcess(command, 0, text)

            vad = SileroCppVAD(Path("/vad"), Path("/model"), run_process=run)
            with self.subTest(text=text):
                if valid:
                    self.assertEqual(vad.speech_intervals(audio), ())
                else:
                    with self.assertRaises(ValueError):
                        vad.speech_intervals(audio)

    def test_rejects_unpinned_or_cloud_profile(self):
        for profile in [{"egress": "allowed"}, {"egress": "denied", "vad": {"engine": "none"}}]:
            with self.assertRaises(ValueError):
                SileroCppVAD.from_profile(profile)
