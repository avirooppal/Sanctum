"""Foundation evaluation only. No synthetic model-quality claims."""

import argparse
import hashlib
import json
import math
from pathlib import Path

from sanctum.doctor import GPU, Hardware, load_profiles, report

ROOT = Path(__file__).resolve().parents[1]


def check_regressions(metrics, baseline, gates):
    for name, gate in gates.items():
        actual, previous = metrics[name], baseline[name]
        if not all(type(v) in (int, float) and math.isfinite(v) for v in (actual, previous)):
            raise ValueError(f"nonfinite/non-numeric metric: {name}")
        change = actual - previous
        if gate["direction"] == "higher":
            change = -change
        elif gate["direction"] != "lower":
            raise ValueError("unknown metric direction")
        if change > abs(previous) * gate["regression_fraction"]:
            raise ValueError(f"regression: {name}: {previous} -> {actual}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--baseline", type=Path, default=ROOT / "evals/results/foundation-baseline.json"
    )
    args = parser.parse_args()
    dataset = ROOT / "evals/datasets/profiles.json"
    cases = json.loads(dataset.read_text())
    profiles = load_profiles(ROOT / "profiles/hardware.json")
    correct = false_ready = 0
    for case in cases:
        hw = Hardware(
            case["os"],
            case["arch"],
            ram_bytes=case["ram_gib"] * 1024**3 if case["ram_gib"] is not None else None,
        )
        if "vram_gib" in case:
            hw.gpus = [GPU("fixture", "nvidia", case["vram_gib"] * 1024**3)]
        result = report(hw, profiles, case["mode"])
        selected = result["recommendation"]
        correct += (selected["id"] if selected else None) == case["expected"]
        false_ready += bool(result["privacy"]["service_start_allowed"])
    payload = {
        "suite": "foundation-profiles-v1",
        "cases": len(cases),
        "dataset_sha256": hashlib.sha256(dataset.read_bytes()).hexdigest(),
        "metrics": {"profile_accuracy": correct / len(cases), "false_ready_count": false_ready},
    }
    if args.baseline.exists():
        baseline = json.loads(args.baseline.read_text())
        if baseline["dataset_sha256"] != payload["dataset_sha256"]:
            raise ValueError("dataset changed; establish a reviewed baseline")
        check_regressions(
            payload["metrics"],
            baseline["metrics"],
            json.loads((ROOT / "evals/gates.json").read_text())["metrics"],
        )
    elif args.output is None or args.output.resolve() != args.baseline.resolve():
        raise ValueError("missing baseline")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
