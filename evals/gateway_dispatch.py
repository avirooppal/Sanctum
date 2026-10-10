"""Real admitted-request concurrency smoke; NOT held-WebSocket Step 0 acceptance."""

import argparse
import base64
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
import json
import math
from pathlib import Path
import socket
import time

import httpx2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    headers = {"Authorization": f"Bearer {token}"}
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769", headers=headers, trust_env=False, timeout=60
    )
    initial = client.get("/v1/models")
    initial.raise_for_status()
    model = initial.json()["data"][0]["id"]
    workspace = client.post("/v1/workspaces", json={"name": "Dispatch smoke"}).json()["id"]
    held = socket.create_connection(("127.0.0.1", 8769))
    # Deliberately hold a body read; this is not a WebSocket or voice pipeline.
    held.sendall(
        (
            "POST /v1/audio/transcriptions HTTP/1.1\r\nHost: 127.0.0.1:8769\r\n"
            f"Authorization: Bearer {token}\r\nContent-Length: 100000\r\n"
            "Content-Type: multipart/form-data; boundary=held\r\n\r\nx"
        ).encode()
    )
    results = {}
    try:
        for route in ["/healthz", "/v1/models"]:
            times = []
            for _ in range(50):
                start = time.perf_counter()
                response = client.get(route)
                response.raise_for_status()
                times.append(time.perf_counter() - start)
            p95 = sorted(times)[math.ceil(len(times) * 0.95) - 1]
            assert p95 < 0.250, (route, p95)
            results[route] = {"n": 50, "p95_seconds": p95, "samples_seconds": times}

        def chat():
            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Say hello briefly."}],
                    "max_tokens": 24,
                    "stream": True,
                },
            )
            response.raise_for_status()
            assert "[DONE]" in response.text
            return "chat_stream"

        def ingest():
            response = client.post(
                f"/v1/workspaces/{workspace}/documents",
                json={
                    "name": "dispatch.md",
                    "content_base64": base64.b64encode(
                        b"# Dispatch\n\nVoice has priority over background ingestion."
                    ).decode(),
                    "data_class": "restricted",
                },
            )
            response.raise_for_status()
            return "ingest"

        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(chat), pool.submit(chat), pool.submit(ingest)]
            results["mixed_work"] = [future.result() for future in futures]
        with ThreadPoolExecutor(max_workers=12) as pool:
            started = time.perf_counter()
            futures = [
                pool.submit(
                    client.post,
                    "/v1/audio/transcriptions",
                    content=b"bad",
                    headers={"Content-Type": "multipart/form-data; boundary=held"},
                )
                for _ in range(12)
            ]
            done, _ = wait(futures, timeout=3, return_when=FIRST_COMPLETED)
            assert done, "overload hung instead of rejecting"
            rejected = next(iter(done)).result()
            elapsed = time.perf_counter() - started
            assert rejected.status_code == 503 and rejected.headers.get("Retry-After") == "1"
            assert elapsed < 1, elapsed
            held.close()
            statuses = [future.result().status_code for future in futures]
            assert all(status in (400, 503) for status in statuses), statuses
            results["overload"] = {
                "requests": 12,
                "statuses": statuses,
                "first_rejection_seconds": elapsed,
            }
    finally:
        held.close()
        client.close()
    results["scope"] = (
        "One held HTTP upload, two chat streams and ingestion; WebSocket/storm/engine-cancel gates NOT verified"
    )
    args.output.write_text(json.dumps(results, indent=2) + "\n")
    print(
        json.dumps(
            {key: value for key, value in results.items() if not key.startswith("/")}, indent=2
        )
    )
    for route in ["/healthz", "/v1/models"]:
        print(route, results[route]["p95_seconds"])


if __name__ == "__main__":
    main()
