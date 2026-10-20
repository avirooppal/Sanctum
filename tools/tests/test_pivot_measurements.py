"""A missing entry must never produce a deceptively small bundle measurement."""

import gzip
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from measure_pivot_baseline import inventory


class PivotMeasurementTests(unittest.TestCase):
    def test_initial_entry_excludes_unrequested_lazy_and_website_chunks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.html").write_text(
                '<script src="/app.js"></script><link rel="modulepreload" href="/shared.js">'
            )
            for name in ("app.js", "shared.js", "lazy.js", "website.js"):
                (root / name).write_bytes(name.encode())
            result = inventory(root)
            self.assertEqual(result["initial_js_files"], ["app.js", "shared.js"])
            self.assertEqual(
                result["initial_js_gzip_bytes"],
                sum(len(gzip.compress(name.encode(), mtime=0)) for name in ("app.js", "shared.js")),
            )
            self.assertIn("lazy.js", result["assets"])

    def test_missing_initial_chunk_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.html").write_text('<script src="/missing.js"></script>')
            with self.assertRaises(ValueError):
                inventory(root)

    def test_empty_entry_is_not_zero_byte_success(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.html").write_text("<html></html>")
            with self.assertRaises(ValueError):
                inventory(root)
