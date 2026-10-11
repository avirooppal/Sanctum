"""Offline integrity and license-admission check for shipped browser fonts."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUFFIXES = {".ttf", ".otf", ".woff", ".woff2"}


def checked_path(root: Path, value: str, subtree: str) -> Path:
    relative = Path(value)
    if relative.is_absolute():
        raise ValueError("font paths must be workspace-relative")
    boundary = (root / subtree).resolve()
    path = (root / relative).resolve()
    if not boundary.is_relative_to(root) or not path.is_relative_to(boundary):
        raise ValueError("font or notice escapes its admitted subtree")
    return path


def verify(root: Path, dependencies: list[dict]) -> int:
    root = root.resolve()
    registered = set()
    for entry in dependencies:
        if entry.get("scope") != "web-font":
            continue
        if entry.get("license") != "OFL-1.1":
            raise ValueError("unreviewed browser font license")
        font = checked_path(root, entry["asset_path"], "apps/web/public/fonts")
        notice = checked_path(root, entry["notice_path"], "apps/web/public/licenses/fonts")
        if font.suffix.lower() not in SUFFIXES or font in registered:
            raise ValueError("invalid or duplicate font admission")
        for path, expected in [(font, entry["asset_sha256"]), (notice, entry["notice_sha256"])]:
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError(f"font evidence changed: {path.name}")
        text = notice.read_text(encoding="utf-8")
        if "SIL OPEN FONT LICENSE" not in text or "Version 1.1" not in text:
            raise ValueError("admitted notice is not the reviewed OFL1.1")
        registered.add(font)
    shipped = {
        path.resolve()
        for path in (root / "apps/web/public/fonts").rglob("*")
        if path.is_file() and path.suffix.lower() in SUFFIXES
    }
    if shipped != registered:
        raise ValueError("unregistered or missing browser font")
    return len(registered)


def main() -> None:
    entries = json.loads((ROOT / "profiles/registry.json").read_text(encoding="utf-8"))[
        "dependencies"
    ]
    count = verify(ROOT, entries)
    print(f"PASS: {count} browser fonts and exact OFL notices match reviewed hashes")


if __name__ == "__main__":
    main()
