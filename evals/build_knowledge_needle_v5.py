"""Build a frozen high-collision register lookup set for Phase 2."""

import json
from pathlib import Path

from build_knowledge_needle import FACTS

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evals/datasets/knowledge-needle-v5.json"


def main():
    targets = ["# Target register"]
    decoys = [[] for _ in range(15)]
    questions = []
    for fact_index, (key, field, answer, decoy) in enumerate(FACTS):
        targets.append(f"## Ledger key {key}\nAssigned {field}: {answer}.")
        questions.append(
            {
                "id": f"needle-v5-{fact_index + 1:02d}",
                "question": f"For ledger key {key}, what is the assigned {field}?",
                "answer": f"Assigned {field}: {answer}.",
                "source": "register-targets.md",
            }
        )
        # Fifteen near-duplicate records per fact create 450 confusable
        # passages while keeping each upload and embedding batch bounded.
        for variant in range(15):
            serial = fact_index * 15 + variant
            decoy_key = f"R{serial:03d}-{(serial * 37 + 113) % 997:03d}"
            value = decoy if variant == 0 else f"variant {variant + 1}, reference {serial + 101}"
            decoys[serial // 30].append(f"## Ledger key {decoy_key}\nAssigned {field}: {value}.")
    documents = [{"name": "register-targets.md", "content": "\n\n".join(targets) + "\n"}]
    documents.extend(
        {
            "name": f"register-decoys-{index + 1:02d}.md",
            "content": f"# Matched decoy register {index + 1}\n\n" + "\n\n".join(rows) + "\n",
        }
        for index, rows in enumerate(decoys)
    )
    dataset = {
        "suite": "knowledge-needle-v5",
        "description": "Frozen opaque-key lookup with 30 targets and 450 near-duplicate register passages; synthetic retrieval stress test.",
        "documents": documents,
        "questions": questions,
    }
    OUTPUT.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"wrote {len(questions)} questions and {sum(len(rows) for rows in decoys)} decoys to {OUTPUT}"
    )


if __name__ == "__main__":
    main()
