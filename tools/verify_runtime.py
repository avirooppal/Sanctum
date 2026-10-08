"""Record real isolated HTTP startup and inherited-child evidence."""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    binary = str(Path(sys.argv[1]).resolve())
    process = subprocess.Popen([binary, "--port", "0", "--once"], stdout=subprocess.PIPE, text=True)
    try:
        record = json.loads(process.stdout.readline())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(f"http://{record['address']}/healthz", timeout=10) as response:
            health = json.load(response)
        if process.wait(timeout=10) != 0:
            raise ValueError("runtime failed")
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
    child = subprocess.run(
        [binary, "--test-child"], capture_output=True, text=True, check=True, timeout=10
    )
    evidence = {"health": health, "exec_child_checks": json.loads(child.stdout)}
    for checks in [health["checks"], evidence["exec_child_checks"]]:
        if len(checks) != 8 or set(checks.values()) != {"denied"}:
            raise ValueError("incomplete runtime probes")
    (ROOT / "evals/results/runtime-linux.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print("PASS: isolated HTTP health and 16 runtime/exec-child denial checks")


if __name__ == "__main__":
    main()
