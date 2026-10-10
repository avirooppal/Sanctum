"""Local meeting summaries and evidence-checked actions saved through Knowledge ACLs."""

import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator, ValidationError

ROOT = Path(__file__).resolve().parents[3]
NOTES_SCHEMA = json.loads(
    (ROOT / "docs/contracts/meeting-notes.schema.json").read_text(encoding="utf-8")
)
REGISTRY_SCHEMA = json.loads(
    (ROOT / "docs/contracts/registry.schema.json").read_text(encoding="utf-8")
)


class MeetingKnowledgeService:
    def __init__(
        self,
        summarizer,
        knowledge,
        *,
        model_registry_entry: dict,
        max_transcript_chars: int = 200_000,
    ):
        if getattr(summarizer, "egress", None) != "denied":
            raise ValueError("meeting summarizer must explicitly deny egress")
        if type(max_transcript_chars) is not int or not 1 <= max_transcript_chars <= 1_000_000:
            raise ValueError("max_transcript_chars must be between 1 and 1,000,000")
        registry_document = {
            "schema_version": "1.0",
            "models": [model_registry_entry],
            "dependencies": [],
        }
        try:
            Draft202012Validator(REGISTRY_SCHEMA).validate(registry_document)
        except ValidationError as error:
            raise ValueError(
                "meeting summarizer model must satisfy the model registry contract"
            ) from error
        if "text" not in model_registry_entry["capabilities"]:
            raise ValueError("meeting summarizer model must declare the text capability")
        Draft202012Validator.check_schema(NOTES_SCHEMA)
        self.summarizer = summarizer
        self.knowledge = knowledge
        self.max_transcript_chars = max_transcript_chars

    def capture(
        self,
        *,
        user: str,
        workspace: str,
        meeting_id: str,
        title: str,
        transcript: str,
        readers: list[str],
        data_class: str,
    ):
        if not user or not workspace:
            raise ValueError("user and workspace are required")
        if not isinstance(meeting_id, str) or not re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", meeting_id
        ):
            raise ValueError("meeting_id contains unsupported filename characters")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ValueError("title must contain 1 to 200 characters")
        if (
            not isinstance(transcript, str)
            or not transcript.strip()
            or len(transcript) > self.max_transcript_chars
        ):
            raise ValueError("transcript is empty or exceeds the configured size limit")
        if not isinstance(readers, list) or any(
            not isinstance(reader, str) or not reader for reader in readers
        ):
            raise ValueError("readers must be a list of non-empty user IDs")
        if len(readers) != len(set(readers)):
            raise ValueError("readers must be unique")
        if not isinstance(data_class, str) or data_class not in {
            "public",
            "internal",
            "confidential",
            "restricted",
        }:
            raise ValueError("unsupported data classification")

        self.knowledge.authorize_ingest(user, workspace, readers, data_class)
        notes = self.summarizer.summarize(transcript)
        Draft202012Validator(NOTES_SCHEMA).validate(notes)
        for item in notes["action_items"]:
            if item["evidence_quote"] not in transcript:
                raise ValueError(
                    "action item evidence_quote must appear verbatim in the transcript"
                )

        safe_title = " ".join(title.splitlines()).strip().replace("#", "\\#")
        lines = [
            f"# Meeting: {safe_title}",
            "",
            f"Meeting ID: {meeting_id}",
            "",
            "## Summary",
            "",
            notes["summary"],
            "",
            "## Action items",
            "",
        ]
        if notes["action_items"]:
            for item in notes["action_items"]:
                owner = item["owner"] or "Unassigned"
                due_date = item["due_date"] or "No due date"
                lines.extend(
                    [
                        f"- [ ] {item['description']} (Owner: {owner}; Due: {due_date})",
                        f"  Evidence from transcript: {item['evidence_quote']}",
                    ]
                )
        else:
            lines.append("No action items identified.")
        lines.extend(["", "## Transcript (untrusted transcription)", "", transcript, ""])
        content = "\n".join(lines).encode("utf-8")
        document = self.knowledge.ingest(
            user, workspace, f"meeting-{meeting_id}.md", content, readers.copy(), data_class
        )
        return {"document": document, "notes": notes}
