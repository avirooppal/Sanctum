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


if __name__ == "__main__":
    unittest.main()
