"""Legacy baseline diagnostic, not a native desktop performance acceptance gate."""

import argparse
import gzip
import hashlib
import json
import os
import platform
import re
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def inventory(web: Path) -> dict:
    assets = {}
    for path in sorted(web.rglob("*")):
        if path.is_file():
            content = path.read_bytes()
            assets[path.relative_to(web).as_posix()] = {
                "bytes": len(content),
                "gzip_bytes": len(gzip.compress(content, compresslevel=9, mtime=0)),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
    html = (web / "index.html").read_text(encoding="utf-8")
    entry = sorted(set(re.findall(r'(?:src|href)="/([^"?]+\.js)"', html)))
    if not entry or any(name not in assets for name in entry):
        raise ValueError("Missing initial JS entry or referenced chunk")
    return {
        "initial_js_files": entry,
        "initial_js_gzip_bytes": sum(assets[name]["gzip_bytes"] for name in entry),
        "web_dist_bytes": sum(item["bytes"] for item in assets.values()),
        "assets": assets,
    }


def gateway_diagnostic() -> dict:
    if platform.system() != "Linux":
        return {"status": "UNVERIFIED", "reason": "Linux /proc diagnostic unavailable"}
    import select

    started = time.monotonic()
    process = subprocess.Popen(
        [str(ROOT / "target/debug/sanctum-runtime"), "--port", "0"],
        stdout=subprocess.PIPE,
        text=True,
        cwd=ROOT,
    )
    try:
        assert process.stdout is not None
        if not select.select([process.stdout], [], [], 15)[0]:
            raise TimeoutError("No startup record within 15 seconds")
        ready = json.loads(process.stdout.readline())
        elapsed = time.monotonic() - started
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open("http://" + ready["address"] + "/healthz", timeout=5) as response:
            health = json.load(response)

        def sample():
            stat = Path(f"/proc/{process.pid}/stat").read_text().split(") ", 1)[1].split()
            status = Path(f"/proc/{process.pid}/status").read_text().splitlines()
            rss = int(next(line.split()[1] for line in status if line.startswith("VmRSS:")))
            children = Path(f"/proc/{process.pid}/task/{process.pid}/children").read_text()
            return {
                "cpu_ticks": int(stat[11]) + int(stat[12]),
                "rss_bytes": rss * 1024,
                "children": children.strip(),
            }

        time.sleep(2)
        before = sample()
        started = time.monotonic()
        time.sleep(10)
        after = sample()
        seconds = time.monotonic() - started
        return {
            "scope": "Unconfigured debug gateway only; NOT desktop budget acceptance",
            "ready_seconds": elapsed,
            "health": health,
            "before": before,
            "after": after,
            "sample_seconds": seconds,
            "cpu_one_core_percent": (
                100
                * (after["cpu_ticks"] - before["cpu_ticks"])
                / os.sysconf("SC_CLK_TCK")
                / seconds
            ),
        }
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        if process.stdout:
            process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "evals/results/pivot-m0-baseline-measurements.json"
    )
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("Preserve existing evidence; choose a new --output path")
    result = {
        "commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "platform": platform.platform(),
        "method": (
            "gzip level 9 per file; script/modulepreload URLs in index.html; "
            "lazy chunks excluded; inspect listed files before using another bundler"
        ),
        **inventory(ROOT / "apps/web/dist"),
        "existing_distributions": {},
        "desktop_install_size": {
            "status": "UNVERIFIED",
            "reason": "No session-built and clean-installed native desktop artifact",
        },
        "desktop_cold_start": {"status": "UNVERIFIED", "reason": "Native desktop shell absent"},
        "desktop_idle_rss_cpu": {
            "status": "UNVERIFIED",
            "reason": "No usable no-model desktop process tree",
        },
    }
    for path in sorted((ROOT / "dist").glob("*")):
        if path.is_file() and path.suffix in (".gz", ".zip", ".exe", ".deb", ".AppImage"):
            content = path.read_bytes()
            result["existing_distributions"][path.name] = {
                "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "status": "UNVERIFIED existing artifact; not installed by this measurement",
            }
    result["no_model_gateway_diagnostic"] = gateway_diagnostic()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as destination:
        destination.write(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "assets"}, indent=2))


if __name__ == "__main__":
    main()
