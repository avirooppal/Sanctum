"""The source inventory is evidence, not an upstream code execution path."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "ui_inventory", Path(__file__).resolve().parents[1] / "ui_inventory.py"
)
assert SPEC and SPEC.loader
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)


class UIInventoryTests(unittest.TestCase):
    def test_records_candidates_and_exact_asset_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "web/src/page.tsx"
            source.parent.mkdir(parents=True)
            source.write_text(
                'const x = fetch("https://example.test");\nwindow.electron.send(x);\n',
                encoding="utf-8",
            )
            asset = root / "web/logo.svg"
            asset.write_bytes(b"<svg/>")
            result = inventory.collect(root, ["web/src/page.tsx", "web/logo.svg"])
            self.assertEqual(
                result,
                inventory.collect(root, list(reversed(["web/src/page.tsx", "web/logo.svg"]))),
            )
            self.assertEqual(result[0]["disposition"], "excluded pending asset audit")
            self.assertEqual(len(result[0]["sha256"]), 64)
            self.assertEqual(result[1]["signals"]["network"][0]["line"], 1)
            self.assertEqual(result[1]["signals"]["ipc"][0]["line"], 2)

    def test_dependency_versions_and_out_of_scope_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "web").mkdir()
            (root / "web/package.json").write_text(
                '{"dependencies":{"react":"19.2.7"}}', encoding="utf-8"
            )
            rows = inventory.collect(root, ["website/absent", "web/package.json"])
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["dependencies"]["dependencies"]["react"], "19.2.7")

    def test_rejects_path_escape_and_mismatched_pin(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                inventory.collect(Path(folder), ["web/../../secret"])
        with self.assertRaises(ValueError):
            inventory.validate_pin("a" * 40, "b" * 40)


if __name__ == "__main__":
    unittest.main()
