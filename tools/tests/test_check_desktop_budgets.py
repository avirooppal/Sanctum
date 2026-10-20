import tempfile
import unittest
from pathlib import Path

from tools.check_desktop_budgets import (
    INSTALLER_MAX_BYTES,
    UI_JS_MAX_GZIP_BYTES,
    calculate_gzipped_js_bytes,
    check_budgets,
)


class TestCheckDesktopBudgets(unittest.TestCase):
    def test_ui_js_budget_passing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            (tmp_path / "app.js").write_text(
                "console.log('hello world');\n" * 100, encoding="utf-8"
            )
            total_gz, files = calculate_gzipped_js_bytes(tmp_path)
            self.assertLess(total_gz, UI_JS_MAX_GZIP_BYTES)
            self.assertEqual(len(files), 1)

            ok, res = check_budgets(ui_dir=tmp_path)
            self.assertTrue(ok)
            self.assertTrue(res["ui_js_gzip"]["passed"])

    def test_ui_js_budget_exceeded(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            # Create a file whose gzipped size exceeds 100 KiB (random/uncompressible-like bytes)
            import os

            (tmp_path / "bloat.js").write_bytes(os.urandom(110 * 1024))
            ok, res = check_budgets(ui_dir=tmp_path)
            self.assertFalse(ok)
            self.assertFalse(res["ui_js_gzip"]["passed"])

    def test_installer_budget_passing_and_failing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            installer = tmp_path / "setup.exe"
            installer.write_bytes(b"A" * (10 * 1024 * 1024))  # 10 MiB <= 25 MiB
            ok, res = check_budgets(installer_path=installer)
            self.assertTrue(ok)
            self.assertTrue(res["installer_size"]["passed"])

            # Over 25 MiB
            installer_bloat = tmp_path / "big_setup.exe"
            installer_bloat.write_bytes(b"B" * (INSTALLER_MAX_BYTES + 1024))
            ok, res = check_budgets(installer_path=installer_bloat)
            self.assertFalse(ok)
            self.assertFalse(res["installer_size"]["passed"])

    def test_rss_and_cpu_budgets(self):
        # Passing values
        ok, res = check_budgets(
            gateway_rss_mb=30.0,
            tree_rss_mb=450.0,
            idle_cpu_pct=1.5,
        )
        self.assertTrue(ok)
        self.assertTrue(res["gateway_rss"]["passed"])
        self.assertTrue(res["tree_rss"]["passed"])
        self.assertTrue(res["idle_cpu"]["passed"])

        # Exceeding values
        ok, res = check_budgets(gateway_rss_mb=55.0)
        self.assertFalse(ok)
        self.assertFalse(res["gateway_rss"]["passed"])

        ok, res = check_budgets(tree_rss_mb=550.0)
        self.assertFalse(ok)
        self.assertFalse(res["tree_rss"]["passed"])

        ok, res = check_budgets(idle_cpu_pct=2.5)
        self.assertFalse(ok)
        self.assertFalse(res["idle_cpu"]["passed"])


if __name__ == "__main__":
    unittest.main()
