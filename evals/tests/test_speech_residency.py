import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from speech_residency import percentile, validate_residency


class SpeechResidencyTests(unittest.TestCase):
    def test_percentile_keeps_tail(self):
        self.assertEqual(percentile(list(range(1, 31)), 0.95), 29)

    def test_all_decodes_must_succeed(self):
        with self.assertRaises(ValueError):
            validate_residency({"decodes": [{"ok": True}]})
        with self.assertRaises(ValueError):
            validate_residency({"decodes": [{"ok": False}] * 3})
        validate_residency({"decodes": [{"ok": True}] * 3})
