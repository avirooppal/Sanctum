"""Explicit public-artifact provisioning, outside the confined runtime."""

import hashlib
import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def estimate(entry: dict[str, Any], ram_bytes: int | None) -> dict[str, Any]:
    required = int(entry["size_bytes"] * 1.25) + 1024**3
    return {
        "id": entry["id"],
        "storage_bytes": entry["size_bytes"],
        "estimated_memory_bytes": required,
        "estimated_fit": ram_bytes >= required if ram_bytes is not None else None,
        "speed": "unverified",
    }


def verify(path: Path, entry: dict[str, Any]) -> None:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024**2), b""):
            digest.update(chunk)
    if path.stat().st_size != entry["size_bytes"] or digest.hexdigest() != entry["sha256"]:
        raise ValueError("artifact size/SHA-256 mismatch")


def provision(entry: dict[str, Any], store: Path, source: Path | None, allow_network: bool) -> Path:
    filename = entry["filename"]
    if (
        not isinstance(filename, str)
        or not filename
        or Path(filename).name != filename
        or "/" in filename
        or "\\" in filename
    ):
        raise ValueError("artifact filename must be a basename")
    store.mkdir(parents=True, exist_ok=True)
    destination = store / filename
    if destination.exists():
        verify(destination, entry)
        return destination
    if source is None and not allow_network:
        raise ValueError("network disabled: supply --from-file or explicitly --allow-network")
    if source is None and not entry["source"].startswith("https://"):
        raise ValueError("network provisioning requires HTTPS")
    descriptor, name = tempfile.mkstemp(dir=store, suffix=".part")
    temporary = Path(name)
    outcome = "failed"
    try:
        with os.fdopen(descriptor, "wb") as output:
            stream = (
                source.open("rb") if source else urllib.request.urlopen(entry["source"], timeout=60)
            )
            with stream:
                count = 0
                while chunk := stream.read(1024**2):
                    count += len(chunk)
                    if count > entry["size_bytes"]:
                        raise ValueError("download exceeds registered size")
                    output.write(chunk)
        verify(temporary, entry)
        temporary.replace(destination)
        outcome = "verified"
        return destination
    finally:
        temporary.unlink(missing_ok=True)
        with (store / "provisioning.jsonl").open("a", encoding="utf-8") as log:
            log.write(
                json.dumps(
                    {
                        "time": datetime.now(timezone.utc).isoformat(),
                        "id": entry["id"],
                        "source": str(source) if source else entry["source"],
                        "sha256": entry["sha256"],
                        "outcome": outcome,
                    }
                )
                + "\n"
            )
