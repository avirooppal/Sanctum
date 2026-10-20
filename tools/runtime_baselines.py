"""Five-run Linux runtime reference measurements; no acceptance budgets or UI claims."""

import argparse
import hashlib
import json
import os
import platform
import select
import statistics
import subprocess
import time
import urllib.request
from pathlib import Path


def summary(values):
    if not values:
        raise ValueError("Missing measurements are not zero")
    return {
        "runs": len(values),
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
        "spread": max(values) - min(values),
    }


def parse_stat(text, page_size):
    fields = text.rsplit(") ", 1)[1].split()
    return {
        "ppid": int(fields[1]),
        "cpu_ticks": int(fields[11]) + int(fields[12]),
        "rss_bytes": int(fields[21]) * page_size,
    }


def cpu_percent(before, after, ticks_per_second, seconds):
    if seconds <= 0:
        raise ValueError("Sample duration must be positive")
    return 100 * (after - before) / ticks_per_second / seconds


def process_tree(pid):
    pending, rows = [pid], {}
    while pending:
        child = pending.pop()
        try:
            proc = Path(f"/proc/{child}")
            row = parse_stat((proc / "stat").read_text(), os.sysconf("SC_PAGE_SIZE"))
            row["exe"] = str((proc / "exe").resolve())
            rows[str(child)] = row
            pending.extend(
                int(value) for value in (proc / f"task/{child}/children").read_text().split()
            )
        except (FileNotFoundError, ProcessLookupError):
            continue
    if str(pid) not in rows:
        raise RuntimeError("Measured runtime exited")
    return rows


def one_run(binary, checkout, config, idle_seconds, log):
    command = [str(binary), "--port", "0"]
    if config:
        command += ["--config", str(config)]
    with log.open("x", encoding="utf-8") as errors:
        started = time.monotonic()
        process = subprocess.Popen(
            command, cwd=checkout, stdout=subprocess.PIPE, stderr=errors, text=True
        )
        try:
            assert process.stdout
            if not select.select([process.stdout], [], [], 240)[0]:
                raise TimeoutError("No ready record in 240s; measurement failed")
            ready = json.loads(process.stdout.readline())
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open("http://" + ready["address"] + "/healthz", timeout=5) as response:
                health = json.load(response)
            ready_seconds = time.monotonic() - started
            time.sleep(2)
            before = process_tree(process.pid)
            sample_start = time.monotonic()
            samples = [before]
            for _ in range(idle_seconds):
                time.sleep(1)
                samples.append(process_tree(process.pid))
            seconds = time.monotonic() - sample_start
            after = samples[-1]
            root = str(process.pid)
            if not config and any(len(row) != 1 for row in samples):
                raise ValueError("No-model diagnostic unexpectedly started child processes")
            result = {
                "command": command,
                "ready_to_health_seconds": ready_seconds,
                "idle_sample_seconds": seconds,
                "gateway_rss_bytes": after[root]["rss_bytes"],
                "tree_rss_sum_bytes": sum(row["rss_bytes"] for row in after.values()),
                "gateway_peak_sampled_rss_bytes": max(row[root]["rss_bytes"] for row in samples),
                "gateway_cpu_one_core_percent": cpu_percent(
                    before[root]["cpu_ticks"],
                    after[root]["cpu_ticks"],
                    os.sysconf("SC_CLK_TCK"),
                    seconds,
                ),
                "processes": after,
                "health": health,
            }
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                raise RuntimeError("Runtime needed forced kill; measurement invalid") from None
            if process.stdout:
                process.stdout.close()
        result["shutdown_exit_code"] = process.returncode
        if process.returncode != 0:
            raise RuntimeError("Runtime did not shut down cleanly")
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--git-dir", type=Path, help="Native path to managed worktree Git directory"
    )
    parser.add_argument(
        "--source-receipt",
        type=Path,
        help="Fresh host-Git clean-check receipt for cross-OS worktrees",
    )
    parser.add_argument("--checkout", type=Path, required=True)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if platform.system() != "Linux":
        raise RuntimeError(
            "Only Linux /proc measurements supported; never substitute WSL for Windows"
        )
    import fcntl
    import tempfile

    lease = open(Path(tempfile.gettempdir()) / "sanctum-runtime-baselines.lock", "a")
    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
    if args.output.exists():
        raise FileExistsError("Use a new evidence path; previous runs must be preserved")
    args.output.mkdir(parents=True)
    checkout, binary = args.checkout.resolve(), args.binary.resolve()
    git = ["git"]
    if args.git_dir:
        git += ["--git-dir", str(args.git_dir.resolve()), "--work-tree", str(checkout)]
    receipt = None
    if args.source_receipt:
        receipt = json.loads(args.source_receipt.read_text(encoding="utf-8"))
        if receipt["tracked_status"] != "":
            raise ValueError("Host Git reported tracked changes")
    elif subprocess.check_output(
        [*git, "status", "--porcelain", "--untracked-files=no"], cwd=checkout
    ):
        raise ValueError("Measurement checkout has tracked changes")
    commit = subprocess.check_output([*git, "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
    if receipt and receipt["commit"] != commit:
        raise ValueError("Source receipt and measured commit differ")
    record = {
        "commit": commit,
        "clean_source_receipt": receipt,
        "platform": platform.platform(),
        "cpuinfo": Path("/proc/cpuinfo").read_text(),
        "meminfo": Path("/proc/meminfo").read_text(),
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "binary_size_bytes": summary([binary.stat().st_size for _ in range(5)]),
        "method": "Release binary. Five sequential fresh processes per mode. OS caches NOT dropped. Two-second settle. No-model idle sampled for 60s. Loaded chat + mandatory embedding sampled for 2s. RSS sums count shared pages per process; not PSS. No UI or Python worker. No thresholds.",
        "no_model": [],
        "chat_and_embedding_loaded": [],
    }
    destination = args.output / "measurements.json"
    try:
        for mode, config, seconds in [
            ("no_model", None, 60),
            ("chat_and_embedding_loaded", args.config.resolve(), 2),
        ]:
            for index in range(5):
                print(f"{mode} run {index + 1}/5 starting", flush=True)
                row = one_run(
                    binary,
                    checkout,
                    config,
                    seconds,
                    args.output / f"{mode}-{index + 1}.stderr.log",
                )
                record[mode].append(row)
                destination.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
                print(
                    f"{mode} run {index + 1}/5: ready={row['ready_to_health_seconds']:.4f}s RSS={row['gateway_rss_bytes']}",
                    flush=True,
                )
        record["summaries"] = {
            mode: {
                metric: summary([row[metric] for row in record[mode]])
                for metric in [
                    "ready_to_health_seconds",
                    "gateway_rss_bytes",
                    "tree_rss_sum_bytes",
                    "gateway_cpu_one_core_percent",
                ]
            }
            for mode in ["no_model", "chat_and_embedding_loaded"]
        }
        record["status"] = "measured"
    except BaseException as error:
        record["status"] = "FAILED"
        record["failure"] = str(error)
        raise
    finally:
        destination.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
