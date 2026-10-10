import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine_storms import compare


class LeakGateTests(unittest.TestCase):
    def test_rejects_each_resource_leak_and_missing_process(self):
        baseline = {"gateway": {"pid": 1, "fds": 5, "sockets": 2, "threads": 13, "rss_kib": 8192}}
        compare(baseline, copy.deepcopy(baseline))
        for field, delta in [("fds", 1), ("sockets", 1), ("threads", 3), ("rss_kib", 16385)]:
            changed = copy.deepcopy(baseline)
            changed["gateway"][field] += delta
            with self.subTest(field=field), self.assertRaises(AssertionError):
                compare(baseline, changed)
        with self.assertRaises(AssertionError):
            compare(baseline, {})
