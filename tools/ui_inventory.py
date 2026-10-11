"""Inventory a pinned reference tree without executing its source or package scripts."""

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

PREFIXES = ("web/", "apps/desktop/", "apps/shared/")
ASSETS = {
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".webp",
    ".mp3",
    ".wav",
    ".mp4",
}
SIGNALS = {
    "network": re.compile(r"https?://|wss?://|\bfetch\s*\(|\bWebSocket\b|\baxios\b|EventSource"),
    "ipc": re.compile(
        r"electron|ipcRenderer|ipcMain|window\.(?:api|desktop|electron)|contextBridge", re.I
    ),
    "routes": re.compile(r"<Route\b|\bpath\s*:|\broute\s*:|createBrowserRouter"),
    "themes": re.compile(r"theme|palette|--color-text-|text-display", re.I),
    "fonts": re.compile(r"font-family|fontSans|fontMono|fontUrl|@font-face|\.woff2?\b|\.ttf\b"),
    "icons": re.compile(r"lucide|tabler|codicons|caduceus|wordmark|favicon", re.I),
}


def validate_pin(expected: str, actual: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", expected) or expected != actual:
        raise ValueError("reference HEAD does not match the full pinned SHA")


def collect(root: Path, paths: list[str]) -> list[dict]:
    root = root.resolve()
    rows = []
    for name in sorted(set(paths)):
        if not name.startswith(PREFIXES):
            continue
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError("inventory path escapes reference checkout")
        if any(part in {"node_modules", "dist", "build"} for part in Path(name).parts):
            continue
        data = path.read_bytes()
        asset = path.suffix.lower() in ASSETS
        row = {
            "path": name,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "category": "asset" if asset else "source/config/documentation",
            "disposition": "excluded pending asset audit" if asset else "review only; not copied",
            "signals": {},
        }
        if not asset:
            try:
                lines = data.decode("utf-8").splitlines()
            except UnicodeDecodeError:
                row["category"] = "unclassified binary"
                row["disposition"] = "excluded pending asset audit"
                rows.append(row)
                continue
            row["signals"] = {
                key: [
                    {"line": i, "text": line}
                    for i, line in enumerate(lines, 1)
                    if pattern.search(line)
                ]
                for key, pattern in SIGNALS.items()
            }
            if path.name == "package.json":
                package = json.loads(data)
                row["dependencies"] = {
                    key: package.get(key, {})
                    for key in (
                        "dependencies",
                        "devDependencies",
                        "peerDependencies",
                        "optionalDependencies",
                    )
                }
                row["declared_license"] = package.get("license")
        rows.append(row)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    actual = subprocess.check_output(
        ["git", "-C", str(args.root), "rev-parse", "HEAD"], text=True
    ).strip()
    validate_pin(args.sha, actual)
    paths = (
        subprocess.check_output(["git", "-C", str(args.root), "ls-files", "-z"])
        .decode("utf-8")
        .rstrip("\0")
        .split("\0")
    )
    rows = collect(args.root, paths)
    report = {
        "schema": "ui-source-inventory-v1",
        "upstream_sha": actual,
        "static_only": True,
        "files": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "files": len(rows),
                "assets": sum(r["category"] == "asset" for r in rows),
                "sha": actual,
            }
        )
    )


if __name__ == "__main__":
    main()
