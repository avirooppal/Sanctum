import sys
from pathlib import Path
import threading
import unittest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_speech.incremental import IncrementalASR  # noqa: E402


class IncrementalTests(unittest.TestCase):
    def test_partial_snapshots_replace_and_finish_clears(self):
        class Engine:
            def transcribe(self, audio):
                return SimpleNamespace(text=str(audio.duration_seconds))

        session = IncrementalASR(Engine())
        self.assertIsNone(session.append(b"\0" * 32000))
        self.assertEqual(
            session.append(b"\0" * 32000),
            {
                "revision": 1,
                "text": "2.0",
                "final": False,
                "audio_seconds": 2.0,
            },
        )
        result = session.finish()
        self.assertTrue(result["final"])
        self.assertEqual(result["revision"], 2)
        self.assertEqual(session.buffered_bytes, 0)
        with self.assertRaises(ValueError):
            session.finish()

    def test_rejects_overflow_and_bad_frames_without_mutation(self):
        session = IncrementalASR(None)
        for chunk in [b"", b"1", b"\0" * 960002]:
            with self.assertRaises(ValueError):
                session.append(chunk)
        self.assertEqual(session.buffered_bytes, 0)
        for interval in [0, float("nan"), 31]:
            with self.assertRaises(ValueError):
                IncrementalASR(None, interval_seconds=interval)

    def test_cancel_suppresses_inflight_result_and_concurrent_decode(self):
        entered, release = threading.Event(), threading.Event()

        class Engine:
            def transcribe(self, audio):
                entered.set()
                release.wait(3)
                return SimpleNamespace(text="stale")

        session = IncrementalASR(Engine())
        output = []
        thread = threading.Thread(target=lambda: output.append(session.append(b"\0" * 64000)))
        thread.start()
        self.assertTrue(entered.wait(2))
        with self.assertRaises(RuntimeError):
            session.append(b"\0\0")
        session.cancel()
        release.set()
        thread.join(3)
        self.assertEqual(output, [None])
        self.assertEqual(session.buffered_bytes, 0)

    def test_engine_error_clears_audio(self):
        class Engine:
            def transcribe(self, audio):
                raise RuntimeError("engine failed")

        session = IncrementalASR(Engine())
        with self.assertRaises(RuntimeError):
            session.append(b"\0" * 64000)
        self.assertEqual(session.buffered_bytes, 0)
