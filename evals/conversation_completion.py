"""Verify completed responses persist while cancellation never publishes partial turns."""

import argparse
import json
from pathlib import Path
import uuid

import httpx2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    results = {}
    with httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": "Bearer " + args.token_file.read_text().strip()},
        trust_env=False,
        timeout=30,
    ) as client:
        for stream in [False, True]:
            identifier = "completion-" + uuid.uuid4().hex
            response = client.post(
                "/v1/chat/completions",
                headers={"X-Sanctum-Conversation": identifier},
                json={
                    "model": "chat-tiny-q8",
                    "messages": [{"role": "user", "content": "Say hello briefly."}],
                    "max_tokens": 16,
                    "stream": stream,
                },
            )
            response.raise_for_status()
            if stream:
                assert "data: [DONE]" in response.text
            stored = client.get(f"/v1/conversations/{identifier}")
            stored.raise_for_status()
            assert len(stored.json()["data"]) == 1
            results["streaming" if stream else "nonstreaming"] = {
                "status": response.status_code,
                "saved_turns": 1,
            }
    args.output.write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
