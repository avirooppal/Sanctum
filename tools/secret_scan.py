"""Content-free credential diagnostics for tracked files and all eval results."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET = re.compile(rb"sk-or-v1-[A-Za-z0-9_-]{16,}")


def redact(text: str) -> str:
    return SECRET.sub(b"[REDACTED]", text.encode("utf-8")).decode("utf-8")


def scan(root: Path) -> list[dict[str, object]]:
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
    paths = {Path(name.decode("utf-8")) for name in tracked.split(b"\0") if name}
    results = root / "evals/results"
    if results.exists():
        paths.update(path.relative_to(root) for path in results.rglob("*") if path.is_file())
    findings = []
    for relative in sorted(paths):
        path = root / relative
        if not path.is_file():
            continue
        # Lines avoid reading large evidence files into memory; bytes also catch
        # embedded ASCII credentials without depending on the document encoding.
        with path.open("rb") as source:
            for number, line in enumerate(source, 1):
                if SECRET.search(line):
                    findings.append({"path": redact(relative.as_posix()), "line": number})
    return findings


def main() -> int:
    findings = scan(ROOT)
    print(json.dumps({"secret_scan": "FAIL" if findings else "PASS", "findings": findings}))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
