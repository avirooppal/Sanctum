"""Inventory a session-built reference bundle; repeated reads are not rebuilds."""

import argparse
import hashlib
import json
from pathlib import Path

from measure_pivot_baseline import inventory
from runtime_baselines import summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--legacy-ui", action="store_true")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("Existing evidence must not be overwritten")
    bundle = args.checkout / "dist/a1-reference"
    files = sorted(path for path in bundle.rglob("*") if path.is_file())
    if not files or not (bundle / "bin/sanctum-runtime").is_file():
        raise ValueError("Build the reference bundle first")
    totals, models, binary, ui = [], [], [], []
    for _ in range(5):
        totals.append(sum(path.stat().st_size for path in files))
        models.append(sum(path.stat().st_size for path in files if path.suffix == ".gguf"))
        binary.append((bundle / "bin/sanctum-runtime").stat().st_size)
        if args.legacy_ui:
            ui.append(inventory(args.checkout / "apps/web/dist")["initial_js_gzip_bytes"])
    record = {
        "commit": args.commit,
        "method": "One fresh release build and unsigned uncompressed reference bundle per revision; five independent size reads of those same bytes, not five rebuilds. Bundle includes mandatory chat+embedding GGUF and Linux engine libraries. Release binary explicitly copied into helper's target/debug input path. No installer claim.",
        "bundle_bytes": summary(totals),
        "gguf_bytes": summary(models),
        "bundle_excluding_gguf_bytes": summary(
            [a - b for a, b in zip(totals, models, strict=True)]
        ),
        "runtime_binary_bytes": summary(binary),
        "runtime_sha256": hashlib.sha256((bundle / "bin/sanctum-runtime").read_bytes()).hexdigest(),
        "initial_ui_js_gzip_bytes": summary(ui)
        if ui
        else {
            "status": "not applicable",
            "reason": "UI retired; library bytes are not app UI bytes",
        },
        "native_windows": {
            "status": "UNAVAILABLE",
            "reason": "Both revisions explicitly exit 78 for non-Linux runtime. No native runtime binary/toolchain installed at baseline; old Windows package has only a WSL launcher. No Windows RSS/startup/CPU samples claimed.",
        },
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
