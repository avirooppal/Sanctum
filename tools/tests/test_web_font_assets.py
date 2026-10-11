import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "web_font_assets", Path(__file__).resolve().parents[1] / "web_font_assets.py"
)
assert SPEC and SPEC.loader
assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets)


class WebFontAssetTests(unittest.TestCase):
    def fixture(self, root):
        font = root / "apps/web/public/fonts/Fixture.ttf"
        notice = root / "apps/web/public/licenses/fonts/fixture-OFL.txt"
        font.parent.mkdir(parents=True)
        notice.parent.mkdir(parents=True)
        font.write_bytes(b"test fixture bytes, not a real font")
        notice.write_bytes(b"SIL OPEN FONT LICENSE Version 1.1")
        return {
            "scope": "web-font",
            "license": "OFL-1.1",
            "asset_path": str(font.relative_to(root)),
            "asset_sha256": hashlib.sha256(font.read_bytes()).hexdigest(),
            "notice_path": str(notice.relative_to(root)),
            "notice_sha256": hashlib.sha256(notice.read_bytes()).hexdigest(),
        }

    def test_admitted_files_and_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertEqual(assets.verify(root, [self.fixture(root)]), 1)

    def test_tamper_is_not_a_passing_license_gate(self):
        for field in ["asset_path", "notice_path"]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                record = self.fixture(root)
                (root / record[field]).write_bytes(b"changed")
                with self.assertRaises(ValueError):
                    assets.verify(root, [record])

    def test_non_ofl_and_unregistered_assets_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            record = self.fixture(root)
            record["license"] = "personal-use-only"
            with self.assertRaises(ValueError):
                assets.verify(root, [record])
            record["license"] = "OFL-1.1"
            (root / "apps/web/public/fonts/unregistered.woff2").write_bytes(b"unknown")
            with self.assertRaises(ValueError):
                assets.verify(root, [record])

    def test_path_escape_fails_before_read(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            record = self.fixture(root)
            record["asset_path"] = "apps/web/public/fonts/../../../../../../secret.ttf"
            with self.assertRaises(ValueError):
                assets.verify(root, [record])


if __name__ == "__main__":
    unittest.main()
