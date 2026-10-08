"""Frozen local retrieval ablation and answer/citation evidence (Linux runtime)."""

import argparse
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "evals/datasets/knowledge-qa.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    sys.path.insert(0, str(ROOT / "services/knowledge"))
    from sanctum_knowledge.parsing import StructuralParser, chunks

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

    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    dataset_hash = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    suite = dataset.get("suite", "synthetic-frozen-knowledge-v1")
    if not isinstance(suite, str) or not suite.replace("-", "").isalnum():
        raise ValueError("dataset suite must be a filename-safe identifier")
    source_docs = {document["name"]: document for document in dataset["documents"]}
    parser_impl = StructuralParser()
    for case in dataset["questions"]:
        document = source_docs.get(case["source"])
        if document is None or not any(
            case["answer"] in chunk["text"]
            for chunk in chunks(parser_impl.parse(document["content"].encode(), document["name"]))
        ):
            raise ValueError(f"label {case['id']} is not an exact quote in a parsed source chunk")
    output = ROOT / f"evals/results/{suite}.json"
    records = []
    if args.resume and output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if previous.get("suite") != suite or previous.get("dataset_sha256") != dataset_hash:
            raise ValueError("checkpoint does not match this immutable dataset")
        if previous.get("complete"):
            raise ValueError("evaluation is already complete")
        records = previous.get("records", [])
        expected_ids = [case["id"] for case in dataset["questions"][: len(records)]]
        if [record.get("id") for record in records] != expected_ids:
            raise ValueError("checkpoint records are not a prefix of the dataset")
    workspace = call("/v1/workspaces", {"name": "Frozen Phase 2 eval"})["id"]
    for document in dataset["documents"]:
        call(
            f"/v1/workspaces/{workspace}/documents",
            {
                "name": document["name"],
                "content_base64": __import__("base64")
                .b64encode(document["content"].encode())
                .decode(),
                "readers": [],
                "data_class": "internal",
            },
        )
    vector_hits = sum(record["vector_rank"] is not None for record in records)
    hybrid_hits = sum(record["hybrid_rank"] is not None for record in records)
    reciprocal_vector = sum(
        1 / record["vector_rank"] for record in records if record["vector_rank"]
    )
    reciprocal_hybrid = sum(
        1 / record["hybrid_rank"] for record in records if record["hybrid_rank"]
    )
    supported = sum(record["citation_supported"] for record in records)
    started = time.perf_counter()
    for case in dataset["questions"][len(records) :]:
        common = {"query": case["question"], "k": 5}
        vector = call(f"/v1/workspaces/{workspace}/search", dict(common, mode="vector"))["hits"]
        hybrid = call(f"/v1/workspaces/{workspace}/search", dict(common, mode="hybrid"))["hits"]

        def rank(hits):
            return next(
                (
                    i + 1
                    for i, hit in enumerate(hits)
                    if hit["source"] == case["source"] and case["answer"] in hit["text"]
                ),
                None,
            )

        rv, rh = rank(vector), rank(hybrid)
        vector_hits += rv is not None
        hybrid_hits += rh is not None
        reciprocal_vector += 1 / rv if rv else 0
        reciprocal_hybrid += 1 / rh if rh else 0
        answer = call(f"/v1/workspaces/{workspace}/ask", {"query": case["question"]})
        citation_ok = any(
            c["source"] == case["source"] and case["answer"] in c["quote"]
            for c in answer["citations"]
        )
        supported += citation_ok
        records.append(
            {
                "id": case["id"],
                "vector_rank": rv,
                "hybrid_rank": rh,
                "answer": answer,
                "citation_supported": citation_ok,
                "answer_contains_expected": case["answer"] in answer["answer"],
            }
        )
        processed = len(records)
        partial = {
            "suite": suite,
            "dataset_sha256": dataset_hash,
            "questions": len(dataset["questions"]),
            "processed": processed,
            "complete": False,
            "records": records,
        }
        output.write_text(
            json.dumps(partial, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        print(
            f"completed {processed}/{len(dataset['questions'])} questions",
            file=sys.stderr,
            flush=True,
        )
    empty = call("/v1/workspaces", {"name": "Phase 2 abstention eval"})["id"]
    abstention = call(f"/v1/workspaces/{empty}/ask", {"query": "Unsupported fact?"})
    n = len(records)
    result = {
        "suite": suite,
        "dataset_sha256": dataset_hash,
        "questions": n,
        "complete": True,
        "recall_at_5": {
            "vector": vector_hits / n,
            "hybrid": hybrid_hits / n,
            "absolute_gain": (hybrid_hits - vector_hits) / n,
        },
        "mrr": {"vector": reciprocal_vector / n, "hybrid": reciprocal_hybrid / n},
        "exact_citation_support": supported / n,
        "answers_contain_expected": sum(r["answer_contains_expected"] for r in records) / n,
        "unsupported_query_abstained": bool(
            abstention["abstained"] and not abstention["citations"]
        ),
        "seconds": round(time.perf_counter() - started, 3),
        "seconds_scope": "resumed_segment_only" if args.resume and records else "qa_loop_only",
        "human_spot_check": "pending",
        "local_judge": "pending",
        "records": records,
    }
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "records"}, indent=2))


if __name__ == "__main__":
    main()
