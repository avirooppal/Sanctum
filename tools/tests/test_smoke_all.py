import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from smoke_all import preserve_result


class SmokeResultTests(unittest.TestCase):
    def test_historical_bytes_restored_and_new_result_retained(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path(directory) / "historical.json"
            new = Path(directory) / "current.json"
            old.write_bytes(b"original\r\n")
            with preserve_result(old, new):
                old.write_bytes(b"measured\n")
            self.assertEqual(old.read_bytes(), b"original\r\n")
            self.assertEqual(new.read_bytes(), b"measured\n")

    def test_failed_stage_cannot_copy_old_measurement_as_current(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path(directory) / "historical.json"
            new = Path(directory) / "current.json"
            old.write_bytes(b"original\n")
            with self.assertRaises(RuntimeError):
                with preserve_result(old, new):
                    raise RuntimeError("failed stage")
            self.assertFalse(new.exists())
            self.assertEqual(old.read_bytes(), b"original\n")
