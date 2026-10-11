"""Real six-turn cache comparison; no production flag overrides."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request


def content_delta(event):
    choices = event.get("choices", [])
    return choices[0].get("delta", {}).get("content", "") if choices else ""


def cached_tokens(event):
    count = event.get("timings", {}).get("cache_n")
    if type(count) is not int or count < 0:
        raise ValueError("missing or invalid actual cache counter")
    return count


def is_model_worker(command, argv, alias):
    return (
        command == "llama-server"
        and b"--alias" in argv
        and argv[argv.index(b"--alias") + 1].decode() == alias
    )


def resources(pid):
    root = Path(f"/proc/{pid}")
    status = dict(line.split(":", 1) for line in (root / "status").read_text().splitlines())
    links = [p.readlink().as_posix() for p in (root / "fd").iterdir()]
    return {
        "rss_kib": int(status["VmRSS"].split()[0]),
        "threads": int(status["Threads"]),
        "fds": len(links),
        "sockets": sum(x.startswith("socket:") for x in links),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--variant", choices=["cache-off", "cache-on", "slot-only"], required=True)
    args = parser.parse_args()
    status = Path("/proc/self/status").read_text()
    interfaces = [
        line.split(":")[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()
        if ":" in line
    ]
    if interfaces != ["lo"] or "Seccomp:\t2" not in status or "NoNewPrivs:\t1" not in status:
        raise RuntimeError("confined engine-child required")
    config = json.loads(args.config.read_text())
    base = f"http://127.0.0.1:{config['chat']['port']}"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 120
    while True:
        try:
            with opener.open(base + "/health", timeout=0.25) as response:
                if response.status == 200:
                    break
        except (OSError, urllib.error.URLError):
            if time.monotonic() > deadline:
                raise TimeoutError("readiness120s")
            time.sleep(0.02)

    def call(path, payload):
        req = urllib.request.Request(
            base + path, json.dumps(payload).encode(), {"Content-Type": "application/json"}
        )
        return opener.open(req, timeout=120)

    def turn(messages):
        begin = time.monotonic()
        first = None
        answer = ""
        done = False
        events = []
        with call(
            "/v1/chat/completions",
            {
                "model": config["chat"]["id"],
                "messages": messages,
                "stream": True,
                "max_tokens": 16,
                "temperature": 0,
                "chat_template_kwargs": {"enable_thinking": False},
                "stream_options": {"include_usage": True},
            },
        ) as response:
            for raw in response:
                if not raw.startswith(b"data: "):
                    continue
                value = raw[6:].strip()
                if value == b"[DONE]":
                    done = True
                    break
                event = json.loads(value)
                delta = content_delta(event)
                if delta:
                    if first is None:
                        first = time.monotonic() - begin
                    answer += delta
                if "timings" in event or "usage" in event:
                    events.append(event)
        assert done and first is not None and answer
        return {
            "ttft_seconds": first,
            "completion_seconds": time.monotonic() - begin,
            "answer": answer,
            "vendor_events": events,
        }

    warm = turn([{"role": "user", "content": "Say hello."}])
    candidates = []
    for path in Path("/proc").iterdir():
        if not path.name.isdigit():
            continue
        try:
            argv = (path / "cmdline").read_bytes().split(b"\0")
            if is_model_worker((path / "comm").read_text().strip(), argv, config["chat"]["id"]):
                candidates.append(int(path.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    assert len(candidates) == 1, candidates
    pid = candidates[0]
    time.sleep(10)
    before = resources(pid)
    source = Path("docs/architecture.md").read_bytes()
    prefix = source.decode()[:1000]
    samples = []
    for repetition in range(3):
        messages = [{"role": "system", "content": "Use this reference. Reply briefly.\n" + prefix}]
        for index in range(6):
            messages.append(
                {"role": "user", "content": f"Turn {index + 1}: name one local component."}
            )
            result = turn(messages)
            samples.append({"repetition": repetition, "turn": index + 1, **result})
            messages.append({"role": "assistant", "content": result["answer"]})
            print(json.dumps(samples[-1]), flush=True)
    probes = []
    for _ in range(2):
        with call(
            "/completion",
            {
                "prompt": "The local private architecture uses " + prefix,
                "n_predict": 1,
                "temperature": 0,
            },
        ) as response:
            result = json.loads(response.read())
            probes.append(
                {
                    "actual_reused_tokens": cached_tokens(result),
                    "tokens_cached": result.get("tokens_cached"),
                    "timings": result.get("timings"),
                    "generation_settings": result.get("generation_settings"),
                }
            )
    time.sleep(10)
    after = resources(pid)
    values = sorted(x["ttft_seconds"] for x in samples)
    record = {
        "suite": "chat-cache-cost-v1",
        "variant": args.variant,
        "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "model": config["chat"],
        "context": config["context"],
        "threads": config["threads"],
        "hardware": {"cpus": os.cpu_count(), "meminfo": Path("/proc/meminfo").read_text()},
        "source_sha256": hashlib.sha256(source).hexdigest(),
        "warmup": warm,
        "samples": samples,
        "ttft_p50_seconds": values[len(values) // 2],
        "ttft_p95_seconds": values[math.ceil(len(values) * 0.95) - 1],
        "cache_probes": probes,
        "resources_before": before,
        "resources_after": after,
        "retained_rss_delta_kib": after["rss_kib"] - before["rss_kib"],
        "slot_reuse_observed": probes[1]["actual_reused_tokens"]
        > probes[0]["actual_reused_tokens"],
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n")
    print(
        json.dumps(
            {
                key: record[key]
                for key in (
                    "variant",
                    "ttft_p50_seconds",
                    "ttft_p95_seconds",
                    "slot_reuse_observed",
                    "retained_rss_delta_kib",
                )
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
