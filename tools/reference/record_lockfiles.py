#!/usr/bin/env python3
"""Records SHA-256 hashes of all pinned lockfiles in the upstream reference."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UPSTREAM = ROOT / ".sanctum/upstream/hermes-agent"
OUTPUT = ROOT / "evals/results/reference-lockfile-hashes.json"

PINNED_SHA = "b30f95ac4a80d2f6dbe3aa01001b0524314f6d74"


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    hasher.update(path.read_bytes())
    return hasher.hexdigest()


def main():
    if not UPSTREAM.exists():
        raise FileNotFoundError(f"Upstream checkout not found at {UPSTREAM}")

    lockfiles = {}
    for lock in sorted(UPSTREAM.rglob("*lock*.json")):
        rel = lock.relative_to(UPSTREAM).as_posix()
        lockfiles[rel] = {
            "sha256": compute_sha256(lock),
            "size_bytes": lock.stat().st_size,
        }

    root_lock_sha = lockfiles.get("package-lock.json", {}).get("sha256")
    expected_root_sha = "30d55e0385ebfb04b2af39cf594643973264808495352648b891103cc02a5bec"

    result = {
        "suite": "reference-lockfiles-v1",
        "pinned_commit": PINNED_SHA,
        "root_lockfile_sha256": root_lock_sha,
        "root_lockfile_matches_pinned": root_lock_sha == expected_root_sha,
        "lockfiles": lockfiles,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded {len(lockfiles)} lockfile hashes to {OUTPUT}")
    print(
        f"Root lockfile SHA256: {root_lock_sha} (matches pinned: {root_lock_sha == expected_root_sha})"
    )


if __name__ == "__main__":
    main()
