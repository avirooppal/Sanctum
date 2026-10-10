"""Three-minute real mixed-engine overload gate; held WebSocket remains Step 1a."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import json
import os
import math
from pathlib import Path
import socket
import threading
import time

import httpx2
from cancellation_release import descendants
from engine_storms import snapshot, compare


def owned_sample(pid):
    count = 0
    rss = 0
    for child in {pid} | descendants(pid):
        try:
            text = Path(f"/proc/{child}/status").read_text()
            fields = dict(line.split(":", 1) for line in text.splitlines())
            rss += int(fields.get("VmRSS", "0").split()[0])
            count += 1
        except (FileNotFoundError, ProcessLookupError):
            pass
    return count, rss


def percentile(values):
    assert values
    return sorted(values)[math.ceil(len(values) * 0.95) - 1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runtime-config", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=180)
    args = parser.parse_args()
    assert args.seconds >= 180
    token = args.token_file.read_text().strip()
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": f"Bearer {token}"},
        trust_env=False,
        timeout=30,
    )
    workspace = client.post("/v1/workspaces", json={"name": "Mixed overload"})
    workspace.raise_for_status()
    workspace_id = workspace.json()["id"]
    wav = Path(".sanctum/speech-smoke/jfk.wav").read_bytes()
    # Prime completed chat/ingestion/speech code paths before retained-resource baseline.
    client.post(
        "/v1/chat/completions",
        json={
            "model": "chat-tiny-q8",
            "messages": [{"role": "user", "content": "Say hello briefly."}],
            "max_tokens": 16,
            "stream": True,
        },
    ).raise_for_status()
    client.post(
        "/v1/workspaces/" + workspace_id + "/documents",
        json={
            "name": "warm.md",
            "data_class": "restricted",
            "content_base64": base64.b64encode(
                b"# Mixed workload\nLocal data stays private during overload."
            ).decode(),
        },
    ).raise_for_status()
    client.post(
        "/v1/audio/transcriptions",
        data={"model": "asr-parakeet-q4k-reference"},
        files={"file": ("speech.wav", wav, "audio/wav")},
    ).raise_for_status()
    client.post(
        "/v1/audio/speech",
        json={
            "model": "tts-flite-slt-reference",
            "voice": "tts-flite-slt-reference",
            "input": "Local speech stays private.",
        },
    ).raise_for_status()
    time.sleep(10)
    baseline = snapshot(args.pid)
    baseline_rss = sum(row["rss_kib"] for row in baseline.values())
    results = {
        "baseline": baseline,
        "seconds_requested": args.seconds,
        "scope": "Real CPU chat/ingestion/file-speech overload; held upload rotates at idle bound, real WebSocket PENDING Step 1a",
    }
    runtime_config = json.loads(args.runtime_config.read_text())
    speech_profile = json.loads(Path(runtime_config["speech"]["profile"]).read_text())
    results["asr_threads"] = speech_profile["asr"]["threads"]
    results["logical_cpus"] = os.cpu_count()
    samples = {
        name: []
        for name in [
            "health",
            "models",
            "chat",
            "asr",
            "tts",
            "voice_admission",
            "shed",
            "held_upload",
        ]
    }
    observation = []
    errors = []
    lock = threading.Lock()
    stop = threading.Event()
    voice_started = None
    voice_observed = False
    start = time.monotonic()
    until = start + args.seconds

    def append(name, value):
        with lock:
            samples[name].append(value)

    def foreground_probe():
        while time.monotonic() < until and not stop.is_set():
            for name, route in [("health", "/healthz"), ("models", "/v1/models")]:
                tick = time.monotonic()
                response = client.get(route)
                response.raise_for_status()
                append(name, time.monotonic() - tick)
            time.sleep(0.05)

    def chat():
        while time.monotonic() < until and not stop.is_set():
            tick = time.monotonic()
            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "chat-tiny-q8",
                    "messages": [{"role": "user", "content": "Say hello briefly."}],
                    "max_tokens": 16,
                    "stream": True,
                },
            )
            response.raise_for_status()
            assert "data: [DONE]" in response.text
            append("chat", time.monotonic() - tick)

    def background(actor):
        sequence = 0
        while time.monotonic() < until and not stop.is_set():
            text = f"# Load record {actor}\nLocal record {sequence} is private and ingestion must yield to interactive work."
            tick = time.monotonic()
            try:
                response = client.post(
                    f"/v1/workspaces/{workspace_id}/documents",
                    json={
                        "name": f"load-{actor}.md",
                        "data_class": "restricted",
                        "content_base64": base64.b64encode(text.encode()).decode(),
                    },
                )
                if response.status_code == 503:
                    assert response.headers.get("retry-after") == "1"
                    elapsed = time.monotonic() - tick
                    assert elapsed < 1
                    append("shed", elapsed)
                else:
                    response.raise_for_status()
            except (httpx2.RemoteProtocolError, httpx2.ReadError, httpx2.ConnectError) as error:
                elapsed = time.monotonic() - tick
                assert elapsed < 1
                # Connection-cap refusal is a separate transport outcome, never HTTP 503.
                with lock:
                    results.setdefault("connection_refusals", []).append(
                        {"seconds": elapsed, "type": type(error).__name__}
                    )
            sequence += 1
            time.sleep(0.05)

    def speech():
        nonlocal voice_started, voice_observed
        sequence = 0
        while time.monotonic() < until and not stop.is_set():
            kind = "asr" if sequence % 2 == 0 else "tts"
            tick = time.monotonic()
            with lock:
                voice_started = tick
                voice_observed = False
            if kind == "asr":
                response = client.post(
                    "/v1/audio/transcriptions",
                    data={"model": "asr-parakeet-q4k-reference"},
                    files={"file": ("speech.wav", wav, "audio/wav")},
                )
                response.raise_for_status()
                assert response.json().get("text")
            else:
                response = client.post(
                    "/v1/audio/speech",
                    json={
                        "model": "tts-flite-slt-reference",
                        "voice": "tts-flite-slt-reference",
                        "input": "Local speech stays private.",
                    },
                )
                response.raise_for_status()
                assert response.content.startswith(b"RIFF")
            append(kind, time.monotonic() - tick)
            with lock:
                assert voice_observed, "voice admission not observed"
                voice_started = None
            sequence += 1
            time.sleep(0.1)

    def held():
        while time.monotonic() < until and not stop.is_set():
            with socket.create_connection(("127.0.0.1", 8769), timeout=3) as connection:
                connection.sendall(
                    b"POST /v1/audio/transcriptions HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100000\r\n\r\nx"
                )
                tick = time.monotonic()
                assert connection.recv(1) == b""
                elapsed = time.monotonic() - tick
                assert elapsed < 2
                append("held_upload", elapsed)

    def observe():
        nonlocal voice_observed
        while not stop.is_set():
            tick = time.monotonic()
            counts = client.get("/healthz/dispatch")
            counts.raise_for_status()
            value = counts.json()
            processes, rss = owned_sample(args.pid)
            row = {
                "seconds": time.monotonic() - start,
                "queued": value["queued"],
                "active": value["active"],
                "processes": processes,
                "rss_kib": rss,
            }
            assert sum(row["queued"]) <= 8
            assert all(n <= bound for n, bound in zip(row["active"], [2, 1, 2, 1], strict=True))
            assert processes <= len(baseline) + 8 and rss <= baseline_rss + 2 * 1024 * 1024
            with lock:
                observation.append(row)
                if voice_started is not None and not voice_observed and row["active"][1] > 0:
                    samples["voice_admission"].append(time.monotonic() - voice_started)
                    voice_observed = True
            time.sleep(max(0, 0.05 - (time.monotonic() - tick)))

    def guard(function, *arguments):
        try:
            function(*arguments)
        except Exception as error:
            with lock:
                errors.append({"actor": function.__name__, "error": repr(error)})
            stop.set()
            raise

    try:
        with ThreadPoolExecutor(max_workers=12) as pool:
            observer = pool.submit(guard, observe)
            jobs = [
                pool.submit(guard, foreground_probe),
                pool.submit(guard, chat),
                pool.submit(guard, chat),
                pool.submit(guard, speech),
                pool.submit(guard, held),
            ]
            jobs.extend(pool.submit(guard, background, index) for index in range(6))
            try:
                for job in jobs:
                    job.result()
            finally:
                stop.set()
            observer.result()
        results["seconds_actual"] = time.monotonic() - start
        assert results["seconds_actual"] >= 180 and not errors
        for name, bound in [
            ("health", 0.25),
            ("models", 0.25),
            ("chat", 5),
            ("asr", 5),
            ("tts", 5),
            ("voice_admission", 0.25),
        ]:
            measured = percentile(samples[name])
            results.setdefault("p95_seconds", {})[name] = measured
            assert measured <= bound, (name, measured)
        assert samples["shed"]
        time.sleep(10)
        after = snapshot(args.pid)
        results["after"] = after
        compare(baseline, after)
        print(
            json.dumps(
                {
                    "seconds": results["seconds_actual"],
                    "p95_seconds": results["p95_seconds"],
                    "shed": len(samples["shed"]),
                    "peak_rss_kib": max(row["rss_kib"] for row in observation),
                    "peak_queued": max(sum(row["queued"]) for row in observation),
                },
                indent=2,
            )
        )
    finally:
        stop.set()
        client.close()
        results.update(samples_seconds=samples, observations=observation, errors=errors)
        args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
