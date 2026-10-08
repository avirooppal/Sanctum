import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sanctum.provisioning import provision, estimate


class ProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.entry = {
            "id": "test",
            "filename": "fixture.gguf",
            "size_bytes": 5,
            "sha256": hashlib.sha256(b"hello").hexdigest(),
            "source": "https://example.invalid/model",
            "kind": "model",
        }

    def test_offline_import_and_reuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "input"
            source.write_bytes(b"hello")
            result = provision(self.entry, root / "store", source, False)
            self.assertEqual(result.read_bytes(), b"hello")
            self.assertEqual(provision(self.entry, root / "store", None, False), result)

    def test_hash_mismatch_never_installs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "input"
            source.write_bytes(b"wrong")
            with self.assertRaises(ValueError):
                provision(self.entry, root / "store", source, False)
            self.assertFalse((root / "store/fixture.gguf").exists())
            self.assertEqual(list((root / "store").glob("*.part")), [])

    def test_network_is_explicit(self):
        with (
            tempfile.TemporaryDirectory() as tmp,
            patch("sanctum.provisioning.urllib.request.urlopen") as request,
        ):
            with self.assertRaises(ValueError):
                provision(self.entry, Path(tmp), None, False)
            request.assert_not_called()

    def test_filename_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                provision(dict(self.entry, filename="../escape"), Path(tmp), None, False)

    def test_speed_not_fabricated(self):
        result = estimate(self.entry, 8 * 1024**3)
        self.assertTrue(result["estimated_fit"])
        self.assertEqual(result["speed"], "unverified")
