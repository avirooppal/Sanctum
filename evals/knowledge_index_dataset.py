"""Create and populate a confined workspace for a frozen retrieval-only suite."""

import argparse
import base64
import json
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = args.token_file.read_text(encoding="utf-8").strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def call(path, body):
        request = urllib.request.Request(
            args.base_url + path,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with opener.open(request, timeout=180) as response:
            return json.load(response)

    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    workspace = call("/v1/workspaces", {"name": "Frozen Phase 2 eval"})["id"]
    for document in dataset["documents"]:
        call(
            f"/v1/workspaces/{workspace}/documents",
            {
                "name": document["name"],
                "content_base64": base64.b64encode(document["content"].encode()).decode(),
                "readers": [],
                "data_class": "internal",
            },
        )
    result = {
        "suite": dataset["suite"],
        "workspace_id": workspace,
        "documents": len(dataset["documents"]),
        "questions": len(dataset["questions"]),
        "indexed": True,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
