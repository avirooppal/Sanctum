"""Real authenticated ingest -> retrieve -> cited answer integration gate."""

import argparse
import base64
import json
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def call(path, body):
        req = urllib.request.Request(
            args.base_url + path,
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        with opener.open(req, timeout=180) as response:
            return json.load(response)

    workspace = call("/v1/workspaces", {"name": "Knowledge integration"})["id"]
    document = call(
        f"/v1/workspaces/{workspace}/documents",
        dict(
            name="lighthouse.md",
            content_base64=base64.b64encode(
                b"# Harbour guide\n\nThe lighthouse color is amber.\n"
            ).decode(),
            readers=[],
            data_class="internal",
        ),
    )
    hits = call(f"/v1/workspaces/{workspace}/search", {"query": "What color is the lighthouse?"})[
        "hits"
    ]
    assert hits and hits[0]["document_id"] == document["id"]
    answer = call(f"/v1/workspaces/{workspace}/ask", {"query": "What color is the lighthouse?"})
    assert not answer["abstained"] and answer["citations"] and "amber" in answer["answer"].lower()
    blank = call("/v1/workspaces", {"name": "Empty integration"})["id"]
    abstention = call(f"/v1/workspaces/{blank}/ask", {"query": "What color is the lighthouse?"})
    assert abstention["abstained"] and not abstention["citations"]
    evidence = {
        "suite": "real-knowledge-smoke",
        "passed": ["upload", "acl_retrieval", "cited_answer", "empty_abstention"],
        "answer": answer,
    }
    Path("evals/results/phase2-smoke.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    main()
