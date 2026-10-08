"""Rebuild the immutable synthetic identifier-retrieval challenge set."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evals/datasets/knowledge-needle-v3.json"

# Each target has an opaque key and a near-duplicate decoy with the same field.
# The fact values and keys were fixed before running this versioned challenge.
FACTS = [
    ("QX-417", "sealant", "sodium silicate", "potassium silicate"),
    ("LM-082", "coolant", "propylene glycol", "ethylene glycol"),
    ("VR-639", "filter grade", "nominal 14 micron", "nominal 40 micron"),
    ("BK-251", "lubricant", "ISO VG 46", "ISO VG 68"),
    ("TN-908", "insulation", "mica sheet", "ceramic fiber"),
    ("CP-134", "fastener", "M8 by 30 millimeter", "M8 by 40 millimeter"),
    ("WY-763", "calibration gas", "zero air", "span air"),
    ("DF-520", "gasket material", "EPDM", "FKM"),
    ("HS-396", "storage bin", "blue compartment 7", "blue compartment 9"),
    ("JG-641", "inspection interval", "120 operating hours", "210 operating hours"),
    ("RA-275", "cable jacket", "halogen-free LSZH", "PVC"),
    ("NE-834", "bearing grease", "NLGI grade 1", "NLGI grade 2"),
    ("UX-109", "valve position", "normally closed", "normally open"),
    ("MG-582", "panel label", "PANEL C17", "PANEL C71"),
    ("ZB-346", "solvent", "isopropyl alcohol", "ethyl alcohol"),
    ("FK-715", "belt profile", "SPZ 1000", "SPA 1000"),
    ("PD-028", "sensor range", "minus 20 to 80 Celsius", "minus 40 to 80 Celsius"),
    ("CY-954", "connector key", "keyway D", "keyway B"),
    ("AL-683", "packing type", "spiral wound graphite", "spiral wound PTFE"),
    ("RW-192", "relay rating", "24 volt DC", "24 volt AC"),
    ("ET-847", "shelf location", "aisle K shelf 12", "aisle K shelf 21"),
    ("OS-361", "test pressure", "1.6 megapascal", "1.8 megapascal"),
    ("GI-530", "paint code", "RAL 5014", "RAL 5041"),
    ("MK-276", "fuse rating", "2.5 ampere slow-blow", "2.5 ampere fast-blow"),
    ("FV-619", "pump rotation", "clockwise from drive end", "counterclockwise from drive end"),
    ("BD-403", "seal size", "32 by 47 by 7 millimeter", "32 by 47 by 9 millimeter"),
    ("KC-785", "battery chemistry", "lithium iron phosphate", "lithium cobalt oxide"),
    ("SP-240", "thread pitch", "1.25 millimeter", "1.5 millimeter"),
    ("YH-671", "trigger threshold", "0.35 bar", "0.53 bar"),
    ("NW-058", "replacement element", "cartridge XR-14", "cartridge XR-41"),
]


def main():
    grouped = {}
    questions = []
    for index, (key, field, answer, decoy) in enumerate(FACTS):
        group = index // 5
        target = f"register-{group + 1:02d}.md"
        distractor_key = f"D{index:02d}-{key[-3:]}"
        decoy_name = f"register-decoys-{group + 1:02d}.md"
        grouped.setdefault(target, ["# Maintenance register"])
        grouped.setdefault(decoy_name, ["# Maintenance register"])
        grouped[target].append(f"## Ledger key {key}\nAssigned {field}: {answer}.")
        grouped[decoy_name].append(f"## Ledger key {distractor_key}\nAssigned {field}: {decoy}.")
        questions.append(
            {
                "id": f"needle-{index + 1:02d}",
                "question": f"For ledger key {key}, what is the assigned {field}?",
                "answer": f"Assigned {field}: {answer}.",
                "source": target,
            }
        )
    documents = [
        {"name": name, "content": "\n\n".join(parts) + "\n"}
        for name, parts in sorted(grouped.items())
    ]
    result = {
        "suite": "knowledge-needle-v3",
        "description": "Synthetic identifier lookup with 30 matched near-duplicate decoys; pipeline stress test, not a representative corpus.",
        "documents": documents,
        "questions": questions,
    }
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(questions)} questions and {len(documents)} documents to {OUTPUT}")


if __name__ == "__main__":
    main()
