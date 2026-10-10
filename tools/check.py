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
        ["-m", "ty", "check", "apps/cli/sanctum", "services/speech/sanctum_speech"],
        ["-m", "ty", "check", "--python-platform", "linux", "services/speech/worker.py"],
        ["-m", "unittest", "discover", "-s", "apps/cli/tests", "-v"],
        ["-m", "unittest", "discover", "-s", "tools/tests", "-v"],
        ["-m", "unittest", "discover", "-s", "services/knowledge/tests", "-v"],
        ["-m", "unittest", "discover", "-s", "services/speech/tests", "-v"],
        ["-m", "unittest", "discover", "-s", "evals/tests", "-v"],
        ["tools/license_scan.py"],
        ["tools/web_license_scan.py"],
        ["evals/run.py"],
    ]
    for args in commands:
        subprocess.run([sys.executable, *args], check=True, cwd=ROOT)
    if (ROOT / "docs/api.md").read_text(encoding="utf-8") != render():
        raise ValueError("generated API docs are stale")
    print("PASS: all foundation source gates")


if __name__ == "__main__":
    main()
