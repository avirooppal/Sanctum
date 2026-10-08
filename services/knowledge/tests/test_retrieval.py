import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.parsing import StructuralParser, chunks
from sanctum_knowledge.retrieval import Knowledge, context_text, rrf, supported_quote
from sanctum_knowledge.store import Catalog
from sanctum_knowledge.vectors import SqliteVectors


class RetrievalTests(unittest.TestCase):
    def test_heading_parent_and_untrusted_markup(self):
        blocks = StructuralParser().parse(
            b"# Safety\n\nKeep models local.\n\n<script>exfiltrate()</script>\n", "policy.md"
        )
        result = chunks(blocks, 40)
        self.assertTrue(all(c["heading"] == "Safety" for c in result))
        self.assertTrue(any("Keep models local." in c["text"] for c in result))
        self.assertTrue(all("Safety" in c["parent_text"] for c in result))

    def test_parent_heading_flows_into_embedding_lexical_search_and_reranking(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = Catalog(root / "catalog.sqlite3")
            vectors = SqliteVectors(root / "vectors.sqlite3")

            class Models:
                embedded = []
                ranked = []

                def embed(self, texts):
                    self.embedded.extend(texts)
                    return [[1.0, 0.0] for _ in texts]

                def rank(self, query, texts):
                    self.ranked.extend(texts)
                    return [(index, 1.0) for index in range(len(texts))]

            models = Models()
            workspace = catalog.workspace("alice", "register")
            knowledge = Knowledge(catalog, StructuralParser(), models, vectors, models)
            try:
                knowledge.ingest(
                    "alice",
                    workspace,
                    "register.md",
                    b"# Register\n\n## Ledger key QX-417\nAssigned sealant: sodium silicate.\n",
                    [],
                    "internal",
                )
                self.assertIn("Ledger key QX-417", models.embedded[0])
                self.assertEqual(len(catalog.lexical("alice", workspace, "QX-417", 5)), 1)
                knowledge.search("alice", workspace, "QX-417 sealant", mode="hybrid")
                self.assertTrue(any("Ledger key QX-417" in text for text in models.ranked))
                hit = {"text": "fact", "parent_text": "heading\nfact"}
                self.assertEqual(context_text(hit), "heading\nfact")
            finally:
                vectors.close()
                catalog.close()

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
