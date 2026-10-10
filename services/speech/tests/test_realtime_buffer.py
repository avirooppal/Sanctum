import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.realtime import RealtimeAudioBuffer  # noqa: E402


class RealtimeAudioBufferTests(unittest.TestCase):
    def test_appends_and_commits_audio_as_engine_neutral_pcm(self):
        buffer = RealtimeAudioBuffer(max_bytes=8)
        buffer.append("AQIDBA==", sample_rate=16000, channels=1)
        buffer.append("BQYHCA==", sample_rate=16000, channels=1)
        audio = buffer.commit()
        self.assertEqual(audio.pcm_s16le, bytes(range(1, 9)))
        self.assertEqual(audio.duration_seconds, 8 / 32000)
        self.assertEqual(buffer.buffered_bytes, 0)

    def test_rejects_bad_base64_and_format_changes_without_corrupting_buffer(self):
        buffer = RealtimeAudioBuffer(max_bytes=8)
        buffer.append("AQIDBA==", sample_rate=16000, channels=1)
        for args in (("%%%", 16000, 1), ("AQIDBA==", 24000, 1), ("AQIDBA==", 16000, 2)):
            with self.assertRaises(ValueError):
                buffer.append(args[0], sample_rate=args[1], channels=args[2])
        self.assertEqual(buffer.buffered_bytes, 4)
        self.assertEqual(buffer.commit().pcm_s16le, bytes((1, 2, 3, 4)))

    def test_rejects_aggregate_limit_and_requires_complete_pcm_frames(self):
        buffer = RealtimeAudioBuffer(max_bytes=6)
        buffer.append("AQIDBA==", sample_rate=16000, channels=1)
        with self.assertRaises(ValueError):
            buffer.append("BQYH", sample_rate=16000, channels=1)
        self.assertEqual(buffer.buffered_bytes, 4)
        with self.assertRaises(ValueError):
            RealtimeAudioBuffer(max_bytes=3).append("AQID", sample_rate=16000, channels=1)

    def test_commit_rejects_empty_buffer(self):
        with self.assertRaises(ValueError):
            RealtimeAudioBuffer(max_bytes=8).commit()

    def test_configured_limit_has_a_hard_ceiling(self):
        with self.assertRaises(ValueError):
            RealtimeAudioBuffer(max_bytes=256 * 1024 * 1024 + 1)


if __name__ == "__main__":
    unittest.main()
