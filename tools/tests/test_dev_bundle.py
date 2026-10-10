import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "build_dev_bundle", Path(__file__).resolve().parents[1] / "build_dev_bundle.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DevBundleTests(unittest.TestCase):
    def test_fresh_destination_and_refusal_to_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ["profiles", "apps/web/dist", ".sanctum/artifacts", ".sanctum/engines"]:
                (root / relative).mkdir(parents=True)
                (root / relative / "fixture").write_text(relative)
            (root / "target/debug").mkdir(parents=True)
            (root / "target/debug/sanctum-runtime").write_text("fixture")
            (root / "LICENSE").write_text("MIT")
            destination = root / "output"
            module.build_bundle(root, destination)
            self.assertEqual((destination / "bin/sanctum-runtime").read_text(), "fixture")
            with self.assertRaises(ValueError):
                module.build_bundle(root, destination)
            with self.assertRaises(ValueError):
                module.build_bundle(root, root / ".sanctum/artifacts/nested")
