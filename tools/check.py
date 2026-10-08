"""Run all source-slice gates; fail on the first failed command."""

import subprocess
import sys
from pathlib import Path

from generate_api_docs import render

ROOT = Path(__file__).resolve().parents[1]


def main():
    commands = [
        ["-m", "ruff", "check", "."],
        ["-m", "ruff", "format", "--check", "."],
        ["-m", "ty", "check", "apps/cli/sanctum"],
        ["-m", "unittest", "discover", "-s", "apps/cli/tests", "-v"],
        ["-m", "unittest", "discover", "-s", "tools/tests", "-v"],
        ["tools/license_scan.py"],
        ["evals/run.py"],
    ]
    for args in commands:
        subprocess.run([sys.executable, *args], check=True, cwd=ROOT)
    if (ROOT / "docs/api.md").read_text(encoding="utf-8") != render():
        raise ValueError("generated API docs are stale")
    print("PASS: all foundation source gates")


if __name__ == "__main__":
    main()
