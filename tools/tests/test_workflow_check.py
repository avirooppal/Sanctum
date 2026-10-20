import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from workflow_check import check

ROOT = Path(__file__).resolve().parents[2]


class WorkflowCheckTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in [
            "docs/WORKFLOW.md",
            "docs/WORKFLOW_GAPS.md",
            "docs/RELEASE_CHECKLIST.md",
            "docs/adr/0071-canonical-owner-journeys.md",
            "tools/smoke_all.py",
            "evals/journeys/manifest.json",
            "evals/journeys/test_journeys.py",
        ]:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)

    def edit(self, name, transform):
        path = self.root / name
        path.write_text(transform(path.read_text(encoding="utf-8")), encoding="utf-8")

    def test_current_registry_is_consistent(self):
        self.assertEqual(check(self.root), [])

    def test_journey_without_test_fails(self):
        self.edit(
            "evals/journeys/test_journeys.py",
            lambda s: s.replace('@journey("J12")', '@journey("J99")'),
        )
        self.assertTrue(check(self.root))

    def test_unannotated_acceptance_test_fails(self):
        self.edit(
            "evals/journeys/test_journeys.py",
            lambda s: s + "\ndef test_orphan(context):\n    return context\n",
        )
        self.assertTrue(check(self.root))

    def test_missing_gap_step_fails(self):
        self.edit("docs/WORKFLOW_GAPS.md", lambda s: s.replace("| J4.2 |", "| REMOVED |"))
        self.assertTrue(check(self.root))

    def test_release_status_drift_fails(self):
        self.edit(
            "docs/RELEASE_CHECKLIST.md",
            lambda s: s.replace("| J1 | PENDING |", "| J1 | VERIFIED |"),
        )
        self.assertTrue(check(self.root))

    def test_duplicate_test_id_fails(self):
        self.edit(
            "evals/journeys/test_journeys.py",
            lambda s: s.replace('@journey("J12")', '@journey("J11")'),
        )
        self.assertTrue(check(self.root))

    def test_budget_drift_fails(self):
        self.edit(
            "evals/journeys/manifest.json", lambda s: s.replace('"clicks": 6', '"clicks": 99', 1)
        )
        self.assertTrue(check(self.root))

    def test_unmapped_smoke_stage_fails(self):
        self.edit(
            "tools/smoke_all.py",
            lambda s: s.replace('"chat": ["J2", "J3"]', '"orphan_stage": ["J3"]'),
        )
        self.assertTrue(check(self.root))

    def test_unmapped_regression_test_fails(self):
        path = self.root / "services/unmapped/tests/test_orphan.py"
        path.parent.mkdir(parents=True)
        path.write_text("pass\n", encoding="utf-8")
        self.assertTrue(check(self.root))
