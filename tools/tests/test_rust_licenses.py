import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "rust_license_scan", Path(__file__).parents[1] / "rust_license_scan.py"
)
scanner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scanner)


class RustLicenseTests(unittest.TestCase):
    def test_missing_registry_entry_is_rejected(self):
        with patch.object(scanner.json, "loads", return_value={"dependencies": []}):
            with self.assertRaises(KeyError):
                scanner.scan(
                    {
                        "packages": [
                            {
                                "name": "unreviewed",
                                "version": "1",
                                "source": "registry",
                                "license": "MIT",
                            }
                        ]
                    }
                )

    def test_nonpermissive_license_is_rejected(self):
        entry = {"name": "bad", "version": "1", "scope": "rust", "license": "GPL-3.0"}
        with patch.object(scanner.json, "loads", return_value={"dependencies": [entry]}):
            with self.assertRaises(ValueError):
                scanner.scan({"packages": [dict(entry, source="registry")]})
