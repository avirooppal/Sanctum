#!/usr/bin/env python3
"""Coordinator for running the isolated upstream reference environment and capturing screenshots."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REFERENCE_DIR = ROOT / "tools/reference"
RESULTS_DIR = ROOT / "evals/results"
SCREENSHOTS_DIR = RESULTS_DIR / "reference-screenshots"


def main():
    print("=== Step 1: Recording Upstream Lockfile Hashes ===")
    subprocess.check_call([sys.executable, str(REFERENCE_DIR / "record_lockfiles.py")], cwd=ROOT)

    print("=== Step 2: Starting Mock Gateway and Reference Server ===")
    server_proc = subprocess.Popen(
        [sys.executable, str(REFERENCE_DIR / "serve_reference.py")],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(2)  # Wait for sockets to bind

    try:
        print("=== Step 3: Capturing Reference Screenshots via Playwright ===")
        # Run capture script via node
        capture_cmd = ["node", str(REFERENCE_DIR / "capture_reference_screenshots.mjs")]
        env = os.environ.copy()
        env["REFERENCE_URL"] = "http://127.0.0.1:5174"

        res = subprocess.run(
            capture_cmd,
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        print("Capture STDOUT:", res.stdout)
        if res.returncode != 0:
            print("Capture STDERR:", res.stderr)
            raise RuntimeError(
                f"Reference screenshot capture failed with exit code {res.returncode}"
            )

    finally:
        server_proc.terminate()
        server_proc.wait(timeout=5)

    print("=== Step 4: Verifying Generated Artifacts ===")
    evidence_file = RESULTS_DIR / "reference-environment.json"
    if not evidence_file.exists():
        raise FileNotFoundError(f"Missing evidence file {evidence_file}")

    evidence = json.loads(evidence_file.read_text(encoding="utf-8"))
    assert evidence.get("suite") == "upstream-reference-environment-v1", "Invalid evidence suite"
    screenshots = list(SCREENSHOTS_DIR.glob("*.png"))
    print(f"Captured {len(screenshots)} reference screenshots in {SCREENSHOTS_DIR}")
    for s in sorted(screenshots):
        print(f"  - {s.name} ({s.stat().st_size} bytes)")

    print("=== Reference Pipeline Complete: PASS ===")


if __name__ == "__main__":
    main()
