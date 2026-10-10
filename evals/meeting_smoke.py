"""Real transcript to local summary to Knowledge integration, not a quality benchmark."""

import argparse
import json
from pathlib import Path
import time
import uuid

import httpx2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--asr-result", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    transcript = json.loads(args.asr_result.read_text())["transcript"]
    with httpx2.Client(
        base_url="http://127.0.0.1:8768",
        trust_env=False,
        timeout=310,
        headers={"Authorization": f"Bearer {args.token_file.read_text().strip()}"},
    ) as client:
        workspace_response = client.post(
            "/v1/workspaces", json={"name": "Meeting smoke " + uuid.uuid4().hex}
        )
        workspace_response.raise_for_status()
        workspace = workspace_response.json()["id"]
        payload = {
            "meeting_id": uuid.uuid4().hex,
            "title": "Public-domain Kennedy speech fixture",
            "transcript": transcript,
        }
        start = time.perf_counter()
        response = client.post(f"/v1/workspaces/{workspace}/meetings", json=payload)
        response.raise_for_status()
        captured = response.json()
        elapsed = time.perf_counter() - start
        assert captured["document"]["id"]
        assert captured["notes"]["summary"].strip()
        assert all(
            item["evidence_quote"] in transcript for item in captured["notes"]["action_items"]
        )
        passed = ["local_summary_and_acl_ingestion", "verbatim_action_evidence"]
        query = client.post(
            f"/v1/workspaces/{workspace}/search", json={"query": "Americans country", "k": 5}
        )
        query.raise_for_status()
        assert any(hit["document_id"] == captured["document"]["id"] for hit in query.json()["hits"])
        passed.append("saved_notes_retrievable")
        denied = client.post(f"/v1/workspaces/{uuid.uuid4().hex}/meetings", json=payload)
        assert denied.status_code == 403
        passed.append("unauthorized_workspace")
        malformed = client.post("/v1/workspaces/not-a-member/meetings", json=payload)
        assert malformed.status_code == 400
        passed.append("malformed_workspace")
        spoof = client.post(
            f"/v1/workspaces/{workspace}/meetings", json={**payload, "user": "another-user"}
        )
        assert spoof.status_code == 400
        passed.append("identity_spoof")
        unauthorized = client.post(
            f"/v1/workspaces/{workspace}/meetings",
            json=payload,
            headers={"Authorization": "Bearer wrong"},
        )
        assert unauthorized.status_code == 401
        passed.append("authentication")
    record = {
        "suite": "real-local-meeting-knowledge",
        "passed": passed,
        "summary_and_ingest_seconds": elapsed,
        "notes": captured["notes"],
        "source_asr_result": args.asr_result.name,
        "semantic_quality_verified": False,
        "diarization_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
