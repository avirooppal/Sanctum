import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
sys.path.insert(0, str(ROOT / "services/knowledge"))
from sanctum_speech.meeting import MeetingKnowledgeService  # noqa: E402
from sanctum_knowledge.parsing import StructuralParser  # noqa: E402
from sanctum_knowledge.retrieval import Knowledge  # noqa: E402
from sanctum_knowledge.store import Catalog  # noqa: E402
from sanctum_knowledge.vectors import SqliteVectors  # noqa: E402


class FakeSummarizer:
    egress = "denied"

    def __init__(self, notes):
        self.notes = notes

    def summarize(self, transcript):
        return self.notes


class FakeKnowledge:
    def __init__(self):
        self.calls = []

    def ingest(self, user, workspace, name, content, readers, data_class):
        self.calls.append((user, workspace, name, content, readers, data_class))
        return {"id": "doc-1", "name": name}


def summarizer_registry_entry():
    return {
        "id": "local-summary-model",
        "license": "MIT",
        "license_url": "https://example.invalid/license",
        "verified_at": "2026-10-10",
        "sha256": "b" * 64,
        "format": "gguf",
        "capabilities": ["text"],
        "source": "https://example.invalid/model",
        "revision": "fixture-revision",
    }


class MeetingKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.transcript = "Riya will send the launch checklist by Friday."
        self.notes = {
            "summary": "The team discussed launch readiness.",
            "action_items": [
                {
                    "description": "Send the launch checklist",
                    "owner": "Riya",
                    "due_date": "Friday",
                    "evidence_quote": "Riya will send the launch checklist by Friday.",
                }
            ],
        }
        self.knowledge = FakeKnowledge()

    def test_captures_meeting_notes_into_selected_workspace_with_acl_and_classification(self):
        service = MeetingKnowledgeService(
            FakeSummarizer(self.notes),
            self.knowledge,
            model_registry_entry=summarizer_registry_entry(),
        )
        document = service.capture(
            user="owner-1",
            workspace="workspace-1",
            meeting_id="weekly-sync-01",
            title="Weekly Sync",
            transcript=self.transcript,
            readers=["member-2"],
            data_class="confidential",
        )
        self.assertEqual(document["document"]["id"], "doc-1")
        user, workspace, name, content, readers, data_class = self.knowledge.calls[0]
        self.assertEqual(
            (user, workspace, name, readers, data_class),
            ("owner-1", "workspace-1", "meeting-weekly-sync-01.md", ["member-2"], "confidential"),
        )
        text = content.decode("utf-8")
        self.assertIn("The team discussed launch readiness.", text)
        self.assertIn("Riya will send the launch checklist by Friday.", text)

    def test_rejects_action_item_without_verbatim_transcript_support(self):
        notes = {
            **self.notes,
            "action_items": [
                {**self.notes["action_items"][0], "evidence_quote": "Unrelated invented quote"}
            ],
        }
        service = MeetingKnowledgeService(
            FakeSummarizer(notes),
            self.knowledge,
            model_registry_entry=summarizer_registry_entry(),
        )
        with self.assertRaises(ValueError):
            service.capture(
                user="owner",
                workspace="w",
                meeting_id="sync",
                title="Sync",
                transcript=self.transcript,
                readers=[],
                data_class="internal",
            )
        self.assertEqual(self.knowledge.calls, [])

    def test_rejects_cloud_summarizer_and_invalid_or_oversized_inputs(self):
        with self.assertRaises(ValueError):
            MeetingKnowledgeService(
                type("Cloud", (), {"egress": "allowed"})(),
                self.knowledge,
                model_registry_entry=summarizer_registry_entry(),
            )
        service = MeetingKnowledgeService(
            FakeSummarizer(self.notes),
            self.knowledge,
            model_registry_entry=summarizer_registry_entry(),
            max_transcript_chars=8,
        )
        with self.assertRaises(ValueError):
            service.capture(
                user="owner",
                workspace="w",
                meeting_id="sync",
                title="Sync",
                transcript=self.transcript,
                readers=[],
                data_class="internal",
            )
        with self.assertRaises(ValueError):
            MeetingKnowledgeService(
                FakeSummarizer({"unexpected": True}),
                self.knowledge,
                model_registry_entry={**summarizer_registry_entry(), "license": "CC-BY-NC-4.0"},
            )

    def test_ingests_meeting_into_real_knowledge_catalog_with_acl_filtering(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = Catalog(root / "catalog.sqlite3")
            vectors = SqliteVectors(root / "vectors.sqlite3")

            class LocalModels:
                def embed(self, texts):
                    return [[1.0, 0.0] for _ in texts]

                def rank(self, query, texts):
                    return [(index, 1.0) for index in range(len(texts))]

            models = LocalModels()
            knowledge = Knowledge(catalog, StructuralParser(), models, vectors, models)
            workspace = catalog.workspace("alice", "meetings")
            catalog.add_member("alice", workspace, "bob")
            service = MeetingKnowledgeService(
                FakeSummarizer(self.notes),
                knowledge,
                model_registry_entry=summarizer_registry_entry(),
            )
            try:
                service.capture(
                    user="alice",
                    workspace=workspace,
                    meeting_id="weekly-sync",
                    title="Weekly Sync",
                    transcript=self.transcript,
                    readers=[],
                    data_class="confidential",
                )
                self.assertTrue(knowledge.search("alice", workspace, "launch checklist"))
                self.assertEqual(knowledge.search("bob", workspace, "launch checklist"), [])
            finally:
                vectors.close()
                catalog.close()


if __name__ == "__main__":
    unittest.main()
