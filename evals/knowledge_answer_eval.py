"""Measure grounded answer citations without repeating dense/hybrid ablations."""

import argparse
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--retrieval-results", type=Path, required=True)
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--mode", choices=("hybrid", "vector"), default="hybrid")
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
        with opener.open(request, timeout=360) as response:
            return json.load(response)

    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    sys.path.insert(0, str(ROOT / "services/knowledge"))
    from sanctum_knowledge.parsing import StructuralParser, chunks

    source_docs = {document["name"]: document for document in dataset["documents"]}
    parse = StructuralParser()
    for case in dataset["questions"]:
        document = source_docs.get(case["source"])
        if document is None or not any(
            case["answer"] in chunk["text"]
            for chunk in chunks(parse.parse(document["content"].encode(), document["name"]))
        ):
            raise ValueError(f"label {case['id']} is not an exact parsed source quote")
    digest = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    retrieval = json.loads(args.retrieval_results.read_text(encoding="utf-8"))
    if (
        retrieval.get("dataset_sha256") != digest
        or retrieval.get("questions") != len(dataset["questions"])
        or retrieval.get("workspace_id") != args.workspace_id
    ):
        raise ValueError("retrieval result must match the same frozen dataset")
    suffix = "-grounded-answers" if args.mode == "hybrid" else "-vector-grounded-answers"
    output = ROOT / f"evals/results/{dataset['suite']}{suffix}.json"
    records = []
    if args.resume and output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if (
            previous.get("dataset_sha256") != digest
            or previous.get("workspace_id") != args.workspace_id
            or previous.get("retrieval_mode") != args.mode
        ):
            raise ValueError("answer checkpoint does not match this dataset and workspace")
        if previous.get("complete"):
            raise ValueError("answer evaluation is already complete")
        records = previous.get("records", [])
    expected_ids = [case["id"] for case in dataset["questions"][: len(records)]]
    if [row.get("id") for row in records] != expected_ids:
        raise ValueError("answer checkpoint is not a dataset prefix")
    started = time.perf_counter()
    for case in dataset["questions"][len(records) :]:
        answer = call(
            f"/v1/workspaces/{args.workspace_id}/ask",
            {"query": case["question"], "mode": args.mode, "k": 5},
        )
        supported = any(
            citation["source"] == case["source"] and case["answer"] in citation["quote"]
            for citation in answer["citations"]
        )
        records.append(
            {
                "id": case["id"],
                "answer": answer,
                "citation_supported": supported,
                "answer_contains_expected": case["answer"] in answer["answer"],
            }
        )
        output.write_text(
            json.dumps(
                {
                    "suite": dataset["suite"],
                    "dataset_sha256": digest,
                    "workspace_id": args.workspace_id,
                    "retrieval_mode": args.mode,
                    "questions": len(dataset["questions"]),
                    "processed": len(records),
                    "complete": False,
                    "records": records,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"answered {len(records)}/{len(dataset['questions'])}", flush=True)
    empty_workspace = call("/v1/workspaces", {"name": "Grounded answer abstention eval"})["id"]
    abstention = call(f"/v1/workspaces/{empty_workspace}/ask", {"query": "Unsupported fact?"})
    result = {
        "suite": dataset["suite"],
        "dataset_sha256": digest,
        "workspace_id": args.workspace_id,
        "retrieval_mode": args.mode,
        "questions": len(records),
        "complete": True,
        "retrieval_reference": str(args.retrieval_results.resolve().relative_to(ROOT.resolve())),
        "exact_citation_support": sum(row["citation_supported"] for row in records) / len(records),
        "answers_contain_expected": sum(row["answer_contains_expected"] for row in records)
        / len(records),
        "unsupported_query_abstained": bool(
            abstention["abstained"] and not abstention["citations"]
        ),
        "seconds": round(time.perf_counter() - started, 3),
        "seconds_scope": "resumed_segment_only" if args.resume and records else "answer_loop",
        "human_spot_check": "pending",
        "local_judge": "pending",
        "records": records,
    }
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()
