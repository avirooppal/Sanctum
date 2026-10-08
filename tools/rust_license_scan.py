"""Compare all resolved Rust crates against reviewed registry licenses/checksums."""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERMISSIVE = {
    "MIT/Apache-2.0",
    "Unicode-3.0",
    "BSD-2-Clause OR Apache-2.0 OR MIT",
    "MIT",
    "Apache-2.0",
    "MIT OR Apache-2.0",
    "Apache-2.0 OR MIT",
    "MIT OR Apache-2.0 OR Zlib",
    "Unlicense OR MIT",
    "(MIT OR Apache-2.0) AND Unicode-3.0",
}


def scan(metadata):
    entries = json.loads((ROOT / "profiles/registry.json").read_text())["dependencies"]
    registered = {
        (entry["name"], entry["version"]): entry
        for entry in entries
        if entry.get("scope") == "rust"
    }
    packages = [p for p in metadata["packages"] if p["source"] is not None]
    for package in packages:
        entry = registered[(package["name"], package["version"])]
        if entry["license"] != package["license"] or package["license"] not in PERMISSIVE:
            raise ValueError(f"unreviewed Rust license: {package['name']}")
        source = Path(package["manifest_path"]).parent
        archive = (
            source.parents[2]
            / "cache"
            / source.parent.name
            / f"{package['name']}-{package['version']}.crate"
        )
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        if checksum != entry["sha256"]:
            raise ValueError(f"Rust source checksum changed: {package['name']}")
    if len(registered) != len(packages):
        raise ValueError("Rust registry does not match resolved graph")
    print(f"PASS: {len(packages)} resolved Rust crate licenses match reviewed registry")


if __name__ == "__main__":
    scan(json.loads(Path(sys.argv[1]).read_text()))
