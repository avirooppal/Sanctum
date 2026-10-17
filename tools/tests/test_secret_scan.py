import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from secret_scan import redact, scan


class SecretScanTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        self.secret = "sk-" + "or-v1-" + "a" * 64

    def test_redacts_provider_error_without_echo(self):
        self.assertEqual(redact("Provider rejected " + self.secret), "Provider rejected [REDACTED]")

    def test_scans_tracked_and_untracked_results(self):
        (self.root / "tracked.txt").write_text(self.secret, encoding="utf-8")
        subprocess.run(["git", "-C", str(self.root), "add", "tracked.txt"], check=True)
        results = self.root / "evals/results"
        results.mkdir(parents=True)
        (results / "untracked.log").write_text(self.secret, encoding="utf-8")
        findings = scan(self.root)
        self.assertEqual(len(findings), 2)
        self.assertNotIn(self.secret, str(findings))

    def test_prefix_prose_and_ignored_credentials_are_not_scanned(self):
        path = self.root / "guide.txt"
        path.write_text("The key prefix is sk-or-v1-", encoding="utf-8")
        subprocess.run(["git", "-C", str(self.root), "add", "guide.txt"], check=True)
        (self.root / "owner.env").write_text(self.secret, encoding="utf-8")
        self.assertEqual(scan(self.root), [])
