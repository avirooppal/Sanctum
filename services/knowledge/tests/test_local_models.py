import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.local_models import LocalModels


class LocalModelTests(unittest.TestCase):
    def test_answer_uses_heading_context_but_cites_child_text(self):
        models = LocalModels({})
        captured = {}

        def call(role, endpoint, payload):
            captured.update(payload)
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"quote": "Assigned sealant: sodium silicate.", "id": "a" * 32}
                            )
                        }
                    }
                ]
            }

        models.call = call
        hit = {
            "chunk_id": "a" * 32,
            "document_id": "b" * 32,
            "source": "register.md",
            "page": None,
            "text": "Assigned sealant: sodium silicate.",
            "parent_text": "Ledger key QX-417\nAssigned sealant: sodium silicate.",
        }
        result = models.answer("What is assigned to QX-417?", [hit])
        evidence = json.loads(captured["messages"][1]["content"])["untrusted_evidence"][0]
        self.assertIn("Ledger key QX-417", evidence["context"])
        self.assertEqual(evidence["quote_text"], hit["text"])
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


if __name__ == "__main__":
    unittest.main()
