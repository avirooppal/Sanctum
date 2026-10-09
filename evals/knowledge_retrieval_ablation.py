"""Fast dense-versus-hybrid retrieval-only pass against an indexed workspace."""

import argparse
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--workspace-id")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def call(path, body):
        request = urllib.request.Request(
            args.base_url + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        with opener.open(request, timeout=180) as response:
            return json.load(response)

    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    workspace_id = args.workspace_id
    if workspace_id is None:
        candidates = [
            workspace
            for workspace in call("/v1/workspaces", None)["data"]
            if workspace["name"] == "Frozen Phase 2 eval"
        ]
        if not candidates:
            raise ValueError("no frozen evaluation workspace is available")
        workspace_id = candidates[-1]["id"]
    rows = []
    for case in dataset["questions"]:
        ranks = {}
        for mode in ("vector", "hybrid"):
            hits = call(
                f"/v1/workspaces/{workspace_id}/search",
                {"query": case["question"], "k": 5, "mode": mode},
            )["hits"]
            ranks[mode] = next(
                (
                    index + 1
                    for index, hit in enumerate(hits)
                    if hit["source"] == case["source"] and case["answer"] in hit["text"]
                ),
                None,
            )
        rows.append({"id": case["id"], **ranks})
        print(f"completed {len(rows)}/{len(dataset['questions'])}", flush=True)
    count = len(rows)
    vector = sum(row["vector"] is not None for row in rows)
    hybrid = sum(row["hybrid"] is not None for row in rows)
    result = {
        "suite": dataset["suite"] + "-retrieval-only",
        "dataset_sha256": hashlib.sha256(args.dataset.read_bytes()).hexdigest(),
        "workspace_id": workspace_id,
        "questions": count,
        "recall_at_5": {
            "vector": vector / count,
            "hybrid": hybrid / count,
            "absolute_gain": (hybrid - vector) / count,
        },
        "records": rows,
        "answers_evaluated": False,
    }
    output = ROOT / f"evals/results/{result['suite']}.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()
