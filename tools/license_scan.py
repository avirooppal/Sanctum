"""Fail closed on missing, changed or unreviewed installed dependency metadata."""

import importlib.metadata as metadata
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOW = {
    "MIT",
    "Apache-2.0",
    "BSD-3-Clause",
    "BSD-2-Clause",
    "ISC",
    "PSF-2.0",
    "MIT OR Apache-2.0",
    "Apache-2.0 OR BSD-2-Clause",
}


def scan():
    registry = json.loads((ROOT / "profiles/registry.json").read_text())
    indexed = {
        entry["name"].lower().replace("_", "-"): entry
        for entry in registry["dependencies"]
        if entry.get("scope") == "development"
    }
    count = 0
    for dist in metadata.distributions():
        name = dist.metadata["Name"].lower().replace("_", "-")
        if name == "sanctum-local":
            continue
        entry = indexed[name]
        if entry["version"] != dist.version or entry["license"] not in ALLOW:
            raise ValueError(f"unreviewed dependency: {name} {dist.version}")
        evidence = dist.metadata.get("License-Expression") or dist.metadata.get("License")
        if not evidence:
            evidence = " | ".join(
                c for c in dist.metadata.get_all("Classifier", []) if c.startswith("License ::")
            )
        if evidence != entry["metadata_evidence"]:
            raise ValueError(f"license evidence changed: {name}")
        count += 1
    print(f"PASS: {count} installed dependency licenses matched reviewed registry")


if __name__ == "__main__":
    scan()
