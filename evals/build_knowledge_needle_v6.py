"""Build a frozen exact-identifier retrieval challenge for hybrid search."""

import hashlib
import json
from pathlib import Path

from build_knowledge_needle import FACTS

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evals/datasets/knowledge-needle-v6.json"


def token(index):
    return "ID" + hashlib.sha256(f"sanctum-v6-{index}".encode()).hexdigest()[:20].upper()


def main():
    targets = ["# Asset register"]
    decoys = [[] for _ in range(15)]
    questions = []
    for fact_index, (_old_key, field, answer, decoy) in enumerate(FACTS):
        target_key = token(f"target-{fact_index}")
        targets.append(f"## Batch token {target_key}\nAssigned {field}: {answer}.")
        questions.append(
            {
                "id": f"needle-v6-{fact_index + 1:02d}",
                "question": f"For batch token {target_key}, what is the assigned {field}?",
                "answer": f"Assigned {field}: {answer}.",
                "source": "asset-register.md",
            }
        )
        for variant in range(15):
            serial = fact_index * 15 + variant
            decoy_key = token(f"decoy-{serial}")
            value = decoy if variant == 0 else f"variant {variant + 1}, reference {serial + 101}"
            decoys[serial // 30].append(f"## Batch token {decoy_key}\nAssigned {field}: {value}.")
    documents = [{"name": "asset-register.md", "content": "\n\n".join(targets) + "\n"}]
    documents.extend(
        {
            "name": f"asset-decoys-{index + 1:02d}.md",
            "content": f"# Matched asset register {index + 1}\n\n" + "\n\n".join(rows) + "\n",
        }
        for index, rows in enumerate(decoys)
    )
    dataset = {
        "suite": "knowledge-needle-v6",
        "description": "Frozen 30-target and 450-decoy exact machine-identifier challenge; synthetic retrieval stress test.",
        "documents": documents,
        "questions": questions,
    }
    OUTPUT.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(questions)} questions and {sum(map(len, decoys))} decoys to {OUTPUT}")


if __name__ == "__main__":
    main()
