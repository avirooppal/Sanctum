import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from watch import MAX_FILE_SIZE, scan_files, changed_files, sync_once


class FolderWatchTests(unittest.TestCase):
    def test_scan_is_root_confined_and_tracks_content_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nested").mkdir()
            (root / "nested" / "guide.md").write_text("# Local notes\n", encoding="utf-8")
            (root / "ignored.txt").write_text("not imported", encoding="utf-8")
            (root / ".private").mkdir()
            (root / ".private" / "secret.md").write_text("skip hidden", encoding="utf-8")
            files = scan_files(root)
            self.assertEqual([item["relative_path"] for item in files], ["nested/guide.md"])
            changed, state = changed_files(files, {})
            self.assertEqual(len(changed), 1)
            self.assertEqual(state["nested/guide.md"], files[0]["sha256"])
            self.assertEqual(changed_files(files, state)[0], [])

    def test_symbolic_links_are_not_followed(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root, external = Path(directory), Path(outside)
            (external / "secret.md").write_text("outside", encoding="utf-8")
            try:
                (root / "link.md").symlink_to(external / "secret.md")
            except OSError as error:
                self.skipTest(f"symlink creation unavailable: {error}")
            self.assertEqual(scan_files(root), [])

    def test_gateway_and_workspace_are_restricted_before_network_access(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            token = root / "token"
            token.write_text("local-token", encoding="utf-8")
            config = {
                "root": str(root),
                "workspace_id": "a" * 32,
                "token_file": str(token),
                "state_file": str(root / "state.json"),
                "gateway": "http://example.invalid:8765",
            }
            with self.assertRaisesRegex(ValueError, "loopback"):
                sync_once(config)
            config["gateway"] = "http://127.0.0.1:8765"
            config["workspace_id"] = "../other"
            with self.assertRaisesRegex(ValueError, "workspace"):
                sync_once(config)

    def test_oversized_files_are_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "large.md"
            with path.open("wb") as handle:
                handle.truncate(MAX_FILE_SIZE + 1)
            self.assertEqual(scan_files(Path(directory)), [])


if __name__ == "__main__":
    unittest.main()
