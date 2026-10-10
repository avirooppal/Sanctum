"""Run the configured local faithfulness judge over a completed RAG suite."""

import argparse
import hashlib
import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--answers", type=Path, required=True)
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--mode", choices=("hybrid", "vector"), default="hybrid")
    parser.add_argument("--run-tag", default="")
    parser.add_argument("--resume", action="store_true")
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
        for attempt in range(3):
            try:
                with opener.open(request, timeout=360) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code not in {400, 408, 429, 500, 502, 503, 504} or attempt == 2:
                    raise
                time.sleep(attempt + 1)

    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    answers = json.loads(args.answers.read_text(encoding="utf-8"))
    digest = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    if answers.get("dataset_sha256") != digest or not answers.get("complete"):
        raise ValueError("answer result must be complete and match the dataset hash")
    if args.run_tag and not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", args.run_tag):
        raise ValueError("run tag must be 1-32 letters, digits, underscores, or hyphens")
    suffix = "-judge" if args.mode == "hybrid" else "-vector-judge"
    if args.run_tag:
        suffix += f"-{args.run_tag}"
    output = ROOT / f"evals/results/{dataset['suite']}{suffix}.json"
    if answers.get("retrieval_mode", "hybrid") != args.mode:
        raise ValueError("answer result retrieval mode does not match requested judge mode")
    records = []
    if args.resume and output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if (
            previous.get("dataset_sha256") != digest
            or previous.get("workspace_id") != args.workspace_id
            or previous.get("retrieval_mode", "hybrid") != args.mode
        ):
            raise ValueError("judge checkpoint does not match dataset and workspace")
        if previous.get("complete"):
            raise ValueError("judge suite is already complete")
        records = previous.get("records", [])
    if [row.get("id") for row in records] != [
        case["id"] for case in dataset["questions"][: len(records)]
    ]:
        raise ValueError("judge checkpoint is not a dataset prefix")
    answers_by_id = {record["id"]: record for record in answers["records"]}
    started = time.perf_counter()
    for case in dataset["questions"][len(records) :]:
        candidate = answers_by_id[case["id"]]["answer"]["answer"]
        judgment = call(
            f"/v1/workspaces/{args.workspace_id}/ask",
            {"query": case["question"], "mode": args.mode, "judge_answer": candidate},
        )
        row = {"id": case["id"], **judgment}
        records.append(row)
        partial = {
            "suite": dataset["suite"],
            "dataset_sha256": digest,
            "workspace_id": args.workspace_id,
            "retrieval_mode": args.mode,
            "questions": len(dataset["questions"]),
            "processed": len(records),
            "complete": False,
            "records": records,
        }
        output.write_text(json.dumps(partial, indent=2) + "\n", encoding="utf-8")
        print(f"judged {len(records)}/{len(dataset['questions'])}", flush=True)
    passed = sum(bool(row["supported"]) for row in records)
    result = {
        "suite": dataset["suite"],
        "dataset_sha256": digest,
        "workspace_id": args.workspace_id,
        "retrieval_mode": args.mode,
        "questions": len(records),
        "complete": True,
        "local_judge_supported_rate": passed / len(records),
        "seconds": round(time.perf_counter() - started, 3),
        "seconds_scope": "resumed_segment_only" if args.resume and records else "judge_loop",
        "human_spot_check": "pending",
        "records": records,
    }
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()
