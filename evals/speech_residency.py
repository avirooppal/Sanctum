"""Developer-only native speech memory/startup measurement; no product downloads."""

import argparse
import hashlib
import json
import math
import subprocess
import time
from pathlib import Path


def percentile(samples, fraction):
    return sorted(samples)[math.ceil(len(samples) * fraction) - 1]


def validate_residency(result):
    if len(result["decodes"]) != 3 or not all(row["ok"] for row in result["decodes"]):
        raise ValueError("all three resident decodes must succeed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--flite", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = {"suite": "speech-residency-v1", "physical_audio": False, "artifacts": {}}
    for key in ("probe", "model", "audio", "flite"):
        path = Path(getattr(args, key))
        result["artifacts"][key] = {
            "path": str(path),
            "sha256": hashlib.file_digest(path.open("rb"), "sha256").hexdigest(),
        }
    completed = subprocess.run(
        [args.probe, args.model, args.audio],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    result["parakeet"] = json.loads(completed.stdout)
    result["native_stderr"] = completed.stderr
    validate_residency(result["parakeet"])
    for kind, argv in [
        ("version", ["--version"]),
        ("synthesis", ["-voice", "slt", "-t", "Hello Sanctum.", "-o", "/dev/null"]),
    ]:
        samples = []
        for _ in range(30):
            start = time.monotonic()
            launch = subprocess.run(
                [args.flite, *argv],
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=10,
            )
            # Pinned flite_main.c returns 1 after successfully printing version.
            expected = 1 if kind == "version" else 0
            if launch.returncode != expected or (
                kind == "version" and b"version: flite-" not in launch.stdout
            ):
                raise ValueError("unexpected Flite launch result")
            samples.append(time.monotonic() - start)
        result[kind] = {
            "seconds": samples,
            "p50_seconds": percentile(samples, 0.5),
            "p95_seconds": percentile(samples, 0.95),
        }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
