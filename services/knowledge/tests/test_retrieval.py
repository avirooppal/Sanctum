import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.parsing import StructuralParser, chunks
from sanctum_knowledge.vectors import SqliteVectors
from sanctum_knowledge.retrieval import rrf, supported_quote


class RetrievalTests(unittest.TestCase):
    def test_heading_parent_and_untrusted_markup(self):
        blocks = StructuralParser().parse(
            b"# Safety\n\nKeep models local.\n\n<script>exfiltrate()</script>\n", "policy.md"
        )
        result = chunks(blocks, 40)
        self.assertTrue(all(c["heading"] == "Safety" for c in result))
        self.assertTrue(any("Keep models local." in c["text"] for c in result))
        self.assertTrue(all("Safety" in c["parent_text"] for c in result))

    def test_vectors_prefilter_before_top_k(self):
        with tempfile.TemporaryDirectory() as directory:
            store = SqliteVectors(Path(directory) / "vectors.db")
            try:
                store.upsert([("a" * 32, [1.0, 0.0]), ("b" * 32, [0.8, 0.2])])
                self.assertEqual(store.search([1.0, 0.0], ["b" * 32], 1), ["b" * 32])
                self.assertEqual(store.search([1.0, 0.0], [], 5), [])
                with self.assertRaises(ValueError):
                    store.search([float("nan"), 0.0], ["a" * 32], 1)
            finally:
                store.close()

    def test_rrf_and_grounding_do_not_trust_model_citations(self):
        self.assertEqual(rrf([["a", "b"], ["b", "c"]])[0], "b")
        self.assertTrue(supported_quote("Keep models local.", [{"text": "Keep models local."}]))
        self.assertFalse(supported_quote("Upload secrets.", [{"text": "Keep models local."}]))
        self.assertFalse(supported_quote("", [{"text": "Keep models local."}]))


if __name__ == "__main__":
    unittest.main()
