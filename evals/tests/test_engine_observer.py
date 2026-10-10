import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine_observer import active_slots


class ObserverValidationTests(unittest.TestCase):
    def test_missing_or_malformed_counters_never_mean_idle(self):
        self.assertEqual(active_slots([{"is_processing": True}, {"is_processing": False}]), 1)
        for value in [{}, [], [{"state": "unknown"}], [{"is_processing": "false"}], [None]]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                active_slots(value)
