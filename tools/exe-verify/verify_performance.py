import argparse
import csv
import json
import os
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")
EXE_PATH = os.path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe")
INSTALLER_PATH = os.path.join(ROOT, "dist", "Sanctum-Setup-1.0.0-x64.exe")


def test_cold_start(runs: int = 10):
    json_file = os.path.join(RESULTS_DIR, "perf_cold_start.json")
    durations = []
    port = 1395

    print(f"Running {runs} cold launch measurements...")
    for r in range(runs):
        t0 = time.time()
        proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
        healthy = False
        start_latency = 0.0
        while time.time() - t0 < 5.0:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=0.5) as resp:
                    if resp.status == 200:
                        start_latency = time.time() - t0
                        healthy = True
                        break
            except Exception:
                time.sleep(0.02)
        proc.terminate()
        proc.wait(timeout=5)
        if healthy:
            durations.append(start_latency)
        time.sleep(0.2)

    durations.sort()
    n = len(durations)
    median_val = durations[n // 2] if n > 0 else 0.0
    min_val = min(durations) if n > 0 else 0.0
    max_val = max(durations) if n > 0 else 0.0
    spread = max_val - min_val

    # ADR 0094 budget: Cold launch to ready < 2.50 s
    status = "PASS" if median_val < 2.50 else "FAIL"

    result_data = {
        "runs": runs,
        "successful_runs": n,
        "median_seconds": round(median_val, 4),
        "min_seconds": round(min_val, 4),
        "max_seconds": round(max_val, 4),
        "spread_seconds": round(spread, 4),
        "budget_seconds": 2.50,
        "status": status,
        "raw_samples": [round(d, 4) for d in durations],
    }

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2)

    print(
        f"PERF-7a (Cold Start): {status} - Median: {median_val:.4f} s (budget < 2.50 s), Spread: {spread:.4f} s. Written to {json_file}"
    )
    return status == "PASS"


def test_ttft(samples: int = 10):
    json_file = os.path.join(RESULTS_DIR, "perf_ttft.json")
    port = 1396
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    ttfts = []
    try:
        for s in range(samples):
            t0 = time.time()
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/v1/chat/completions",
                data=json.dumps({"model": "local", "messages": [{"role": "user", "content": "ping"}]}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                for line in resp:
                    l = line.decode("utf-8").strip()
                    if l.startswith("data: ") and not l.startswith("data: [DONE]"):
                        ttft_ms = (time.time() - t0) * 1000
                        ttfts.append(ttft_ms)
                        break
            time.sleep(0.05)
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    ttfts.sort()
    n = len(ttfts)
    median_ttft = ttfts[n // 2] if n > 0 else 0.0

    # Milestone E1 / ADR 0101 budget: TTFT < 200 ms
    status = "PASS" if median_ttft < 200.0 else "FAIL"

    result_data = {
        "samples": samples,
        "median_ttft_ms": round(median_ttft, 2),
        "min_ttft_ms": round(min(ttfts) if ttfts else 0.0, 2),
        "max_ttft_ms": round(max(ttfts) if ttfts else 0.0, 2),
        "budget_ms": 200.0,
        "status": status,
        "raw_samples": [round(t, 2) for t in ttfts],
    }

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2)

    print(
        f"PERF-7b (TTFT): {status} - Median TTFT: {median_ttft:.2f} ms (budget < 200 ms). Written to {json_file}"
    )
    return status == "PASS"


def test_bundle_sizes():
    json_file = os.path.join(RESULTS_DIR, "perf_sizes.json")

    installer_size = os.path.getsize(INSTALLER_PATH) if os.path.exists(INSTALLER_PATH) else 0
    payload_dir = os.path.join(ROOT, "deploy", "installer", "build_payload")

    total_payload_bytes = 0
    for root_dir, _, files in os.walk(payload_dir):
        for f in files:
            total_payload_bytes += os.path.getsize(os.path.join(root_dir, f))

    # ADR 0094 Budgets: Installer < 25 MB, Installed Footprint < 150 MB
    installer_budget = 25 * 1024 * 1024
    installed_budget = 150 * 1024 * 1024

    pass_installer = installer_size < installer_budget
    pass_installed = total_payload_bytes < installed_budget
    status = "PASS" if pass_installer and pass_installed else "FAIL"

    result_data = {
        "installer_path": INSTALLER_PATH,
        "installer_size_bytes": installer_size,
        "installer_size_mb": round(installer_size / (1024 * 1024), 2),
        "installer_budget_mb": 25.0,
        "installed_payload_bytes": total_payload_bytes,
        "installed_payload_mb": round(total_payload_bytes / (1024 * 1024), 2),
        "installed_budget_mb": 150.0,
        "status": status,
    }

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2)

    print(
        f"PERF-7c (Bundle Sizes): {status} - Installer: {installer_size / (1024 * 1024):.2f} MB (< 25 MB), Installed: {total_payload_bytes / (1024 * 1024):.2f} MB (< 150 MB). Written to {json_file}"
    )
    return status == "PASS"


def test_idle_cpu(duration: int = 15):
    csv_file = os.path.join(RESULTS_DIR, "perf_idle_cpu.csv")
    port = 1397
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    from verify_resources import get_process_metrics

    # Settling period before sampling
    time.sleep(2.0)
    m_init = get_process_metrics(proc.pid)
    last_cpu_s = m_init["cpu_seconds"]
    last_t = time.time()

    samples = []
    start_time = time.time()
    try:
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["elapsed_s", "cpu_seconds", "instant_cpu_percent"])

            while (time.time() - start_time) < duration:
                time.sleep(1.0)
                now = time.time()
                elapsed = now - start_time
                m = get_process_metrics(proc.pid)
                dt = now - last_t
                dcpu = m["cpu_seconds"] - last_cpu_s
                cpu_pct = (dcpu / max(0.001, dt)) * 100.0

                writer.writerow([f"{elapsed:.2f}", f"{m['cpu_seconds']:.4f}", f"{cpu_pct:.2f}"])
                samples.append(cpu_pct)

                last_cpu_s = m["cpu_seconds"]
                last_t = now
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    avg_cpu = sum(samples) / len(samples) if samples else 0.0
    status = "PASS" if avg_cpu < 2.0 else "FAIL"

    print(
        f"PERF-7d (Idle CPU): {status} - Average Idle CPU: {avg_cpu:.2f}% (budget < 2.0%). Written to {csv_file}"
    )
    return status == "PASS"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--test",
        choices=["cold_start", "ttft", "bundle_sizes", "idle_cpu", "all"],
        default="all",
    )
    parser.add_argument("--duration", type=int, default=15)
    args = parser.parse_args()

    success = True
    if args.test in ["cold_start", "all"]:
        success = test_cold_start() and success
    if args.test in ["ttft", "all"]:
        success = test_ttft() and success
    if args.test in ["bundle_sizes", "all"]:
        success = test_bundle_sizes() and success
    if args.test in ["idle_cpu", "all"]:
        success = test_idle_cpu(args.duration) and success

    sys.exit(0 if success else 1)
