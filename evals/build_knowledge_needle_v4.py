"""Build a frozen two-register identifier retrieval challenge."""

import json
from pathlib import Path

from build_knowledge_needle import FACTS

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evals/datasets/knowledge-needle-v4.json"


def main():
    targets = ["# Target register"]
    decoys = ["# Matched decoy register"]
    questions = []
    for key, field, answer, decoy in FACTS:
        index = len(questions)
        decoy_key = f"D{index:02d}-{key[-3:]}"
        targets.append(f"## Ledger key {key}\nAssigned {field}: {answer}.")
        decoys.append(f"## Ledger key {decoy_key}\nAssigned {field}: {decoy}.")
        questions.append(
            {
                "id": f"needle-v4-{index + 1:02d}",
                "question": f"For ledger key {key}, what is the assigned {field}?",
                "answer": f"Assigned {field}: {answer}.",
                "source": "register-targets.md",
            }
        )
    dataset = {
        "suite": "knowledge-needle-v4",
        "description": "Synthetic opaque-key lookup with 30 matched decoys in one target and one decoy register; stress test only.",
        "documents": [
            {"name": "register-targets.md", "content": "\n\n".join(targets) + "\n"},
            {"name": "register-decoys.md", "content": "\n\n".join(decoys) + "\n"},
        ],
        "questions": questions,
    }
    OUTPUT.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(questions)} questions to {OUTPUT}")


if __name__ == "__main__":
    main()
