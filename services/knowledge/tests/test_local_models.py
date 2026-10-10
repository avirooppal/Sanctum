import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.local_models import LocalModels


class LocalModelTests(unittest.TestCase):
    def test_answer_uses_heading_context_but_cites_child_text(self):
        models = LocalModels({})
        models.call = lambda *_args: self.fail("exact identifier path should be extractive")
        hit = {
            "chunk_id": "a" * 32,
            "document_id": "b" * 32,
            "source": "register.md",
            "page": None,
            "text": "Assigned sealant: sodium silicate.",
            "parent_text": "Ledger key QX-417\nAssigned sealant: sodium silicate.",
        }
        result = models.answer("What is assigned to QX-417?", [hit])
        self.assertIn("Ledger key QX-417", result["citations"][0]["context"])
        self.assertEqual(result["citations"][0]["quote"], hit["text"])

    def test_nonverbatim_model_quote_falls_back_to_selected_chunk(self):
        models = LocalModels({})
        models.call = lambda *_args: {
            "choices": [
                {"message": {"content": json.dumps({"quote": "a paraphrase", "id": "a" * 32})}}
            ]
        }
        hit = {
            "chunk_id": "a" * 32,
            "document_id": "b" * 32,
            "source": "register.md",
            "page": 3,
            "text": "Assigned relay rating: 24 volt DC.",
            "parent_text": "Ledger key RW-192\nAssigned relay rating: 24 volt DC.",
        }
        result = models.answer("What is the relay rating for RW-192?", [hit])
        self.assertEqual(result["answer"], hit["text"])
        self.assertEqual(result["citations"][0]["quote"], hit["text"])

    def test_unknown_selected_chunk_abstains(self):
        models = LocalModels({})
        models.call = lambda *_args: {
            "choices": [{"message": {"content": json.dumps({"quote": "text", "id": "x" * 32})}}]
        }
        hit = {
            "chunk_id": "a" * 32,
            "document_id": "b" * 32,
            "source": "register.md",
            "page": None,
            "text": "Known source text.",
        }
        result = models.answer("Question?", [hit])
        self.assertTrue(result["abstained"])
        self.assertFalse(result["citations"])

    def test_judge_treats_evidence_as_untrusted_and_checks_local_result(self):
        models = LocalModels({})
        captured = {}

        def call(role, endpoint, payload):
            captured.update(payload)
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"supported": True, "rationale": "The quote states the value."}
                            )
                        }
                    }
                ]
            }

        models.call = call
        hit = {
            "chunk_id": "a" * 32,
            "source": "register.md",
            "text": "Assigned relay rating: 24 volt DC.",
            "parent_text": "Ledger key RW-192\nAssigned relay rating: 24 volt DC.",
        }
        judgment = models.judge("What is the relay rating?", [hit], hit["text"])
        system = captured["messages"][0]["content"]
        self.assertIn("untrusted data", system)
        self.assertEqual(judgment["supported"], True)
        self.assertEqual(
            models.judge("Unsupported?", [], "I could not find supporting evidence.")["supported"],
            True,
        )

    def test_exact_identifier_in_heading_filters_near_duplicate_evidence(self):
        models = LocalModels({})
        models.call = lambda *_args: self.fail("exact identifier path should be extractive")
        decoy = {
            "chunk_id": "a" * 32,
            "document_id": "c" * 32,
            "source": "decoys.md",
            "page": None,
            "text": "Assigned pump rotation: variant 11.",
            "parent_text": "Batch token ID8C3CFE52E92832F305F2\nAssigned pump rotation: variant 11.",
        }
        target = {
            "chunk_id": "b" * 32,
            "document_id": "d" * 32,
            "source": "targets.md",
            "page": None,
            "text": "Assigned pump rotation: clockwise from drive end.",
            "parent_text": "Batch token ID8C3CFE52E92832F305F2\nAssigned pump rotation: clockwise from drive end.",
        }
        # Test a near-duplicate decoy with a different exact key.
        decoy["parent_text"] = decoy["parent_text"].replace(
            "ID8C3CFE52E92832F305F2", "ID00000000000000000000"
        )
        result = models.answer(
            "For batch token ID8C3CFE52E92832F305F2, what is the assigned pump rotation?",
            [decoy, target],
        )
        self.assertEqual(result["answer"], target["text"])
        self.assertEqual(result["citations"][0]["source"], "targets.md")
        self.assertIn("ID8C3CFE52E92832F305F2", result["citations"][0]["context"])


if __name__ == "__main__":
    unittest.main()
