import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "web_license_scan", Path(__file__).resolve().parents[1] / "web_license_scan.py"
)
scan = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scan)


class WebLicenseAdmissionTests(unittest.TestCase):
    def run_license(self, license_name):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "profiles").mkdir()
            (root / "apps/web").mkdir(parents=True)
            package = {"version": "2.8.1", "license": license_name, "integrity": "reviewed-fixture"}
            (root / "apps/web/package-lock.json").write_text(
                json.dumps({"packages": {"node_modules/tslib": package}})
            )
            entry = {"name": "tslib", "scope": "web", **package}
            (root / "profiles/registry.json").write_text(json.dumps({"dependencies": [entry]}))
            with patch.object(scan, "ROOT", root):
                scan.main()

    def test_reviewed_zero_clause_bsd_is_permissive(self):
        self.run_license("0BSD")

    def test_matching_registry_does_not_admit_proprietary_license(self):
        with self.assertRaises(ValueError):
            self.run_license("Proprietary")
