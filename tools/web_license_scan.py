"""Validate locked frontend package licenses and integrity against registry."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOW = {"MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC-BY-4.0"}


def main():
    dependencies = json.loads((ROOT / "profiles/registry.json").read_text())["dependencies"]
    registry = {(p["name"], p["version"]): p for p in dependencies if p.get("scope") == "web"}
    packages = json.loads((ROOT / "apps/web/package-lock.json").read_text())["packages"]
    count = 0
    for location, p in packages.items():
        if not location:
            continue
        name = location.rsplit("node_modules/", 1)[1]
        entry = registry[(name, p["version"])]
        if (
            p.get("license") not in ALLOW
            or p["license"] != entry["license"]
            or p.get("integrity") != entry["integrity"]
        ):
            raise ValueError(f"unreviewed web dependency: {name}")
        count += 1
    print(f"PASS: {count} locked frontend dependencies have reviewed permissive licenses/integrity")


if __name__ == "__main__":
    main()
