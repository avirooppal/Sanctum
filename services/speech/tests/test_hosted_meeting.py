import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

from jsonschema import ValidationError

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.hosted_meeting import capture_meeting  # noqa: E402


class HostedMeetingTests(unittest.TestCase):
    def setUp(self):
        self.entry = next(
            entry
            for entry in json.loads((ROOT / "profiles/registry.json").read_text())["models"]
            if "text" in entry["capabilities"]
        )
        self.models = Mock()
        self.models.config = {
            "chat": {"id": self.entry["id"], "artifact": {"sha256": self.entry["sha256"]}}
        }
        self.models.call.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({"summary": "Local summary", "action_items": []})
                    }
                }
            ]
        }
        self.knowledge = Mock()
        self.knowledge.ingest.return_value = {"id": "document"}
        self.request = {
            "meeting_id": "meeting-1",
            "title": "Review",
            "transcript": "Untrusted transcript.",
        }

    def test_authorizes_before_model_and_stores_restricted_notes(self):
        events = []
        self.knowledge.authorize_ingest.side_effect = lambda *_args: events.append("authorize")
        original = self.models.call.return_value
        self.models.call.side_effect = lambda *_args: (events.append("model"), original)[1]
        result = capture_meeting(self.knowledge, self.models, "owner", "workspace", self.request)
        self.assertEqual(events, ["authorize", "model"])
        self.assertEqual(result["document"]["id"], "document")
        self.assertEqual(self.knowledge.ingest.call_args.args[-1], "restricted")
        payload = self.models.call.call_args.args[2]
        self.assertIn("untrusted", payload["messages"][0]["content"])
        self.assertEqual(
            json.loads(payload["messages"][1]["content"])["untrusted_transcript"],
            self.request["transcript"],
        )

    def test_denied_workspace_never_reaches_model(self):
        self.knowledge.authorize_ingest.side_effect = PermissionError("denied")
        with self.assertRaises(PermissionError):
            capture_meeting(self.knowledge, self.models, "owner", "other", self.request)
        self.models.call.assert_not_called()
        self.knowledge.ingest.assert_not_called()

    def test_rejects_identity_spoof_and_unregistered_model_hash(self):
        with self.assertRaises(ValidationError):
            capture_meeting(
                self.knowledge, self.models, "owner", "workspace", {**self.request, "user": "other"}
            )
        self.models.config["chat"]["artifact"]["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            capture_meeting(self.knowledge, self.models, "owner", "workspace", self.request)
        self.models.call.assert_not_called()
