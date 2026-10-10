"""Kill a real resident chat worker mid-stream, verify isolation and recovery."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import signal
import socket
import time
import uuid

import httpx2
from cancellation_release import descendants, executable
from engine_storms import snapshot, compare


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--queued", action="store_true")
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    results = {}
    conversation = "crash-" + uuid.uuid4().hex
    pool = ThreadPoolExecutor(max_workers=1)
    pending = None
    with httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": f"Bearer {token}"},
        timeout=125,
        trust_env=False,
    ) as client:
        try:
            engines = [
                pid
                for pid in descendants(args.pid)
                if executable(pid) == "llama-server"
                and b"chat-tiny-q8" in Path(f"/proc/{pid}/cmdline").read_bytes()
            ]
            assert len(engines) == 1
            victim = engines[0]
            client.post(
                "/v1/chat/completions",
                json={
                    "model": "chat-tiny-q8",
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 16,
                },
            ).raise_for_status()
            client.post(
                "/v1/embeddings",
                json={"model": "embed-small-q8", "input": "Warm independent model."},
            ).raise_for_status()
            time.sleep(0.2)
            results["before"] = snapshot(args.pid)
            with socket.create_connection(("127.0.0.1", 8769), timeout=10) as stream:
                body = json.dumps(
                    {
                        "model": "chat-tiny-q8",
                        "messages": [
                            {
                                "role": "user",
                                "content": "Write a detailed story for thousands of words.",
                            }
                        ],
                        "stream": True,
                        "max_tokens": 4096,
                    }
                ).encode()
                stream.sendall(
                    f"POST /v1/chat/completions HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nX-Sanctum-Conversation: {conversation}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n".encode()
                    + body
                )
                received = b""
                while b"data:" not in received:
                    part = stream.recv(4096)
                    assert part
                    received += part
                if args.queued:
                    pending = pool.submit(
                        client.post,
                        "/v1/chat/completions",
                        json={
                            "model": "chat-tiny-q8",
                            "messages": [{"role": "user", "content": "Hello"}],
                            "max_tokens": 1,
                        },
                    )
                    until = time.monotonic() + 5
                    while client.get("/healthz/dispatch").json()["active"][2] != 2:
                        assert time.monotonic() < until, "second chat was not admitted"
                        time.sleep(0.01)
                    time.sleep(0.05)
                started = time.monotonic()
                os.kill(victim, signal.SIGKILL)
                try:
                    while True:
                        part = stream.recv(65536)
                        if not part:
                            break
                        received += part
                except ConnectionResetError:
                    pass
                assert b"[DONE]" not in received, "failed stream fabricated completion"
                results["affected_stream_release_seconds"] = time.monotonic() - started
            client.post(
                "/v1/embeddings",
                json={
                    "model": "embed-small-q8",
                    "input": "The independent embedding engine remains available.",
                },
            ).raise_for_status()
            if pending is not None:
                queued = pending.result(timeout=125)
                results["queued_request_status"] = queued.status_code
                queued.raise_for_status()
            result = client.post(
                "/v1/chat/completions",
                json={
                    "model": "chat-tiny-q8",
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 1,
                },
            )
            results["next_request_status"] = result.status_code
            result.raise_for_status()
            results["recovery_seconds"] = time.monotonic() - started
            assert results["recovery_seconds"] < 120
            assert not Path(f"/proc/{victim}").exists()
            results["surviving_old_pid"] = False
            stored = client.get(f"/v1/conversations/{conversation}")
            stored.raise_for_status()
            results["failed_request_saved_turns"] = len(stored.json()["data"])
            assert results["failed_request_saved_turns"] == 0, (
                "failed inference was stored as completed"
            )
            time.sleep(10)
            results["after"] = snapshot(args.pid)
            compare(results["before"], results["after"])
            print(json.dumps(results, indent=2))
        finally:
            pool.shutdown(wait=True)
            args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
