"""Exercise real processes and save observed kernel checks (no external requests)."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    binary = Path(sys.argv[1]).resolve()
    cases = json.loads((ROOT / "docs/contracts/envelope-fixtures.json").read_text())
    result = subprocess.run(
        [str(binary), "check"],
        input=json.dumps(cases[0]["value"]),
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    response = json.loads(result.stdout)
    schema = json.loads((ROOT / "docs/contracts/bootstrap.schema.json").read_text())
    if set(response) != set(schema["required"]) or response["schema_version"] != "1.0":
        raise ValueError("bootstrap response shape/version mismatch")
    expected_checks = set(schema["$defs"]["checks"]["required"])
    for role in ("supervisor_checks", "worker_checks"):
        checks = response[role]
        if set(checks) != expected_checks or set(checks.values()) != {"denied"}:
            raise ValueError(f"incomplete checks: {role}")
    if response["trace_id"] != cases[0]["value"]["trace_id"] or response["accepted"] is not True:
        raise ValueError("IPC envelope failed")
    (ROOT / "evals/results/containment-linux.json").write_text(
        json.dumps(response, indent=2) + "\n"
    )
    print("PASS: 22 kernel denial checks across two processes; bounded IPC round trip")


if __name__ == "__main__":
    main()
