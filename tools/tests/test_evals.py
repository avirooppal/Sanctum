import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "eval_run", Path(__file__).parents[2] / "evals/run.py"
)
evaluation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evaluation)


class EvalTests(unittest.TestCase):
    def test_regression_and_missing_metrics_fail(self):
        gates = {"quality": {"direction": "higher", "regression_fraction": 0.05}}
        evaluation.check_regressions({"quality": 0.96}, {"quality": 1.0}, gates)
        for actual in [0.94, float("nan"), float("inf")]:
            with self.assertRaises(ValueError):
                evaluation.check_regressions({"quality": actual}, {"quality": 1.0}, gates)
        with self.assertRaises(KeyError):
            evaluation.check_regressions({}, {"quality": 1.0}, gates)

    def test_security_has_zero_tolerance(self):
        gates = {"leaks": {"direction": "lower", "regression_fraction": 0}}
        with self.assertRaises(ValueError):
            evaluation.check_regressions({"leaks": 1}, {"leaks": 0}, gates)
