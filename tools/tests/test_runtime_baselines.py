import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "runtime_baselines", Path(__file__).resolve().parents[1] / "runtime_baselines.py"
)
assert SPEC and SPEC.loader
baseline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(baseline)


class RuntimeBaselineTests(unittest.TestCase):
    def test_summary_retains_range_and_count(self):
        self.assertEqual(
            baseline.summary([1, 2, 3, 4, 10]),
            {"runs": 5, "median": 3, "min": 1, "max": 10, "spread": 9},
        )

    def test_empty_samples_are_not_zero(self):
        with self.assertRaises(ValueError):
            baseline.summary([])

    def test_process_name_with_spaces_and_parenthesis(self):
        fields = ["S", "1"] + ["0"] * 9 + ["20", "30"] + ["0"] * 11
        fields[21] = "100"
        parsed = baseline.parse_stat("27 (worker ) name) " + " ".join(fields), 4096)
        self.assertEqual(parsed, {"ppid": 1, "cpu_ticks": 50, "rss_bytes": 409600})

    def test_cpu_is_one_core_percent(self):
        self.assertEqual(baseline.cpu_percent(100, 250, 100, 60), 2.5)

    def test_zero_sample_duration_is_rejected(self):
        with self.assertRaises(ValueError):
            baseline.cpu_percent(100, 250, 100, 0)
