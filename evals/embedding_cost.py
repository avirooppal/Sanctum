"""Confined real ingestion cost comparison; historical batching is evaluation only."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/knowledge"))


def rates(documents, chunks, seconds):
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("positive measured duration required")
    return {"documents_per_minute": documents * 60 / seconds, "chunks_per_second": chunks / seconds}


def validated_vectors(data, count):
    rows = sorted(data["data"], key=lambda row: row["index"])
    if [row["index"] for row in rows] != list(range(count)):
        raise ValueError("incomplete or duplicated indices")
    vectors = [row["embedding"] for row in rows]
    if any(not v or not all(math.isfinite(x) for x in v) for v in vectors):
        raise ValueError("invalid vectors")
    return vectors


def main():
    from sanctum_knowledge.local_models import LocalModels
    from sanctum_knowledge.parsing import StructuralParser, chunks
    from sanctum_knowledge.retrieval import Knowledge
    from sanctum_knowledge.store import Catalog
    from sanctum_knowledge.vectors import SqliteVectors

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    interfaces = [
        line.split(":")[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()
        if ":" in line
    ]
    status = Path("/proc/self/status").read_text()
    if interfaces != ["lo"] or "Seccomp:\t2" not in status or "NoNewPrivs:\t1" not in status:
        raise RuntimeError("confined engine-child required")
    config = json.loads(args.config.read_text())
    state = Path(os.path.expanduser(config["state_dir"])) / "engine-admission"
    documents = [
        ROOT / p for p in ("docs/architecture.md", "docs/threat-model.md", "docs/profiles.md")
    ]
    corpus = [
        {
            "path": p.relative_to(ROOT).as_posix(),
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "chunks": len(chunks(StructuralParser().parse(p.read_bytes(), p.name))),
        }
        for p in documents
    ]

    class HistoricalModels(LocalModels):
        def embed(self, texts):
            return validated_vectors(
                self.call(
                    "embedding", "/v1/embeddings", {"input": texts, "encoding_format": "float"}
                ),
                len(texts),
            )

    class RecordingModels(LocalModels):
        def embed(self, texts):
            result = super().embed(texts)
            self.recorded.extend(result)
            return result

    samples = []
    paired = {}
    total = sum(d["chunks"] for d in corpus)
    for repetition in range(-1, 3):
        for variant in ["whole", "one"] if repetition % 2 else ["one", "whole"]:
            model_type = HistoricalModels if variant == "whole" else RecordingModels
            models = model_type(config, state)
            models.recorded = []
            with tempfile.TemporaryDirectory(prefix="sanctum-ingestion-cost-") as temporary:
                catalog = Catalog(Path(temporary) / "catalog.sqlite3")
                vectors = SqliteVectors(Path(temporary) / "vectors.sqlite3")
                try:
                    workspace = catalog.workspace("cost-owner", "Reference corpus")
                    knowledge = Knowledge(catalog, StructuralParser(), models, vectors, models)
                    begin = time.monotonic()
                    for path in documents:
                        knowledge.ingest(
                            "cost-owner", workspace, path.name, path.read_bytes(), [], "internal"
                        )
                    duration = time.monotonic() - begin
                    count = catalog.db.execute("SELECT count(*) FROM chunks").fetchone()[0]
                    assert count == total
                    sample = {
                        "variant": variant,
                        "repetition": repetition,
                        "warmup": repetition == -1,
                        "seconds": duration,
                        "documents": len(documents),
                        "chunks": count,
                        **rates(len(documents), count, duration),
                    }
                    samples.append(sample)
                    print(json.dumps(sample), flush=True)
                finally:
                    vectors.close()
                    catalog.close()
            # Independent real vector equivalence check, outside measured ingestion.
            if repetition == -1:
                text = ["Sanctum reference evidence.", "Local private processing."]
                paired[variant] = models.embed(text)
    difference = max(
        abs(a - b) for x, y in zip(paired["whole"], paired["one"]) for a, b in zip(x, y)
    )
    assert all(len(v) == len(paired["one"][0]) for v in paired["whole"] + paired["one"])
    record = {
        "suite": "embedding-cost-v1",
        "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "config_sha256": hashlib.sha256(args.config.read_bytes()).hexdigest(),
        "hardware": {"logical_cpus": os.cpu_count(), "meminfo": Path("/proc/meminfo").read_text()},
        "corpus": corpus,
        "model": config["embedding"],
        "samples": samples,
        "paired_vector_max_difference": difference,
        "production_override": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"PASS": True, "paired_vector_max_difference": difference}), flush=True)


if __name__ == "__main__":
    main()
