"""Desktop performance budget verification for CI gates.

Enforces ADR0094 measured performance budgets:
- Core Gateway Standalone RSS <= 50 MiB
- Initial UI JS (gzipped level 9) <= 100 KiB (hard gate; target 50 KiB)
- Core Installer Size <= 25 MiB
- Process Tree RSS <= 500 MiB
- Process Tree Idle CPU <= 2.0%
"""

import argparse
import gzip
import json
import sys
from pathlib import Path

# Budget thresholds in bytes/units
GATEWAY_MAX_RSS_BYTES = 50 * 1024 * 1024  # 50 MiB
TREE_MAX_RSS_BYTES = 500 * 1024 * 1024  # 500 MiB
UI_JS_MAX_GZIP_BYTES = 100 * 1024  # 100 KiB
UI_JS_TARGET_GZIP_BYTES = 50 * 1024  # 50 KiB target
INSTALLER_MAX_BYTES = 25 * 1024 * 1024  # 25 MiB
IDLE_CPU_MAX_PCT = 2.0  # 2.0% of one core


def calculate_gzipped_js_bytes(directory: Path) -> tuple[int, list[dict]]:
    """Sum gzip level-9 compressed size of all JS files in directory."""
    if not directory.exists():
        raise FileNotFoundError(f"UI directory does not exist: {directory}")
    total_gzip = 0
    file_records = []
    for js_path in sorted(directory.glob("**/*.js")):
        raw_bytes = js_path.read_bytes()
        gz_bytes = len(gzip.compress(raw_bytes, compresslevel=9))
        total_gzip += gz_bytes
        file_records.append(
            {
                "path": str(js_path),
                "raw_bytes": len(raw_bytes),
                "gzip_bytes": gz_bytes,
            }
        )
    return total_gzip, file_records


def check_budgets(
    *,
    ui_dir: Path | None = None,
    installer_path: Path | None = None,
    gateway_rss_mb: float | None = None,
    tree_rss_mb: float | None = None,
    idle_cpu_pct: float | None = None,
) -> tuple[bool, dict]:
    """Check provided metrics against ADR0094 budgets."""
    results = {}
    passed = True

    if ui_dir is not None:
        total_gz, files = calculate_gzipped_js_bytes(ui_dir)
        ok = total_gz <= UI_JS_MAX_GZIP_BYTES
        passed = passed and ok
        results["ui_js_gzip"] = {
            "bytes": total_gz,
            "max_allowed": UI_JS_MAX_GZIP_BYTES,
            "target": UI_JS_TARGET_GZIP_BYTES,
            "passed": ok,
            "files": files,
        }

    if installer_path is not None:
        if not installer_path.exists():
            raise FileNotFoundError(f"installer path does not exist: {installer_path}")
        size = installer_path.stat().st_size
        ok = size <= INSTALLER_MAX_BYTES
        passed = passed and ok
        results["installer_size"] = {
            "bytes": size,
            "max_allowed": INSTALLER_MAX_BYTES,
            "passed": ok,
        }

    if gateway_rss_mb is not None:
        rss_bytes = int(gateway_rss_mb * 1024 * 1024)
        ok = rss_bytes <= GATEWAY_MAX_RSS_BYTES
        passed = passed and ok
        results["gateway_rss"] = {
            "mb": gateway_rss_mb,
            "bytes": rss_bytes,
            "max_allowed_mb": 50.0,
            "passed": ok,
        }

    if tree_rss_mb is not None:
        rss_bytes = int(tree_rss_mb * 1024 * 1024)
        ok = rss_bytes <= TREE_MAX_RSS_BYTES
        passed = passed and ok
        results["tree_rss"] = {
            "mb": tree_rss_mb,
            "bytes": rss_bytes,
            "max_allowed_mb": 500.0,
            "passed": ok,
        }

    if idle_cpu_pct is not None:
        ok = idle_cpu_pct <= IDLE_CPU_MAX_PCT
        passed = passed and ok
        results["idle_cpu"] = {
            "pct": idle_cpu_pct,
            "max_allowed_pct": IDLE_CPU_MAX_PCT,
            "passed": ok,
        }

    return passed, results


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify ADR0094 desktop performance budgets.")
    parser.add_argument("--ui-dir", type=Path, help="Directory containing built UI JS files")
    parser.add_argument("--installer", type=Path, help="Built installer package/executable")
    parser.add_argument(
        "--gateway-rss-mb", type=float, help="Measured standalone gateway RSS in MiB"
    )
    parser.add_argument("--tree-rss-mb", type=float, help="Measured process tree RSS in MiB")
    parser.add_argument("--idle-cpu", type=float, help="Measured idle CPU %")
    parser.add_argument("--output", type=Path, help="Path to write JSON verification report")
    parser.add_argument(
        "--fixture-check", action="store_true", help="Run standard fixture budget self-check"
    )

    args = parser.parse_args()

    if args.fixture_check:
        # Standard fixture self-check using baseline measurements from ADR0091/0092/0094
        ok, res = check_budgets(
            gateway_rss_mb=26.8,  # A1 baseline
            tree_rss_mb=362.0,  # Windows baseline
            idle_cpu_pct=1.38,  # Windows baseline
        )
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(res, indent=2), encoding="utf-8")
        print(f"Desktop budget fixture check: {'PASS' if ok else 'FAIL'}")
        return 0 if ok else 1

    ok, res = check_budgets(
        ui_dir=args.ui_dir,
        installer_path=args.installer,
        gateway_rss_mb=args.gateway_rss_mb,
        tree_rss_mb=args.tree_rss_mb,
        idle_cpu_pct=args.idle_cpu,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(res, indent=2), encoding="utf-8")

    print(json.dumps(res, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
