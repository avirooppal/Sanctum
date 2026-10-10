"""Real request disconnect/slot-release measurements; not the complete storm gate."""

import argparse
import base64
import json
import math
import socket
import time
from pathlib import Path

import httpx2


def descendants(pid, proc_root=Path("/proc")):
    result = set()
    pending = [pid]
    while pending:
        parent = pending.pop()
        for task in (proc_root / str(parent) / "task").glob("*/children"):
            try:
                children = task.read_text().split()
            except (FileNotFoundError, ProcessLookupError):
                continue
            for child in map(int, children):
                if child not in result:
                    result.add(child)
                    pending.append(child)
    return result


def executable(pid):
    try:
        return Path(Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")[0].decode()).name
    except (FileNotFoundError, ProcessLookupError):
        return ""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--mode", choices=["chat", "knowledge", "asr", "tts"], required=True)
    parser.add_argument("--samples", type=int, default=50)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
        trust_env=False,
    )
    stats = client.get("/healthz/dispatch")
    stats.raise_for_status()
    assert stats.json()["active"][1:] == [0, 0, 0]
    workspace = None
    if args.mode == "knowledge":
        response = client.post("/v1/workspaces", json={"name": "Cancellation measurements"})
        response.raise_for_status()
        workspace = response.json()["id"]
    samples = []
    try:
        for index in range(args.samples):
            content_type = "application/json"
            if args.mode == "chat":
                route, lane = "/v1/chat/completions", 2
                payload = {
                    "model": "chat-tiny-q8",
                    "messages": [
                        {
                            "role": "user",
                            "content": "Write a very long detailed story, continuing for thousands of words.",
                        }
                    ],
                    "max_tokens": 4096,
                    "stream": True,
                }
                body = json.dumps(payload).encode()
            elif args.mode == "knowledge":
                route, lane = f"/v1/workspaces/{workspace}/documents", 3
                document = "\n\n".join(
                    f"# Section {n}\nThe recorded measurement for item {n} is {n + index}. " * 8
                    for n in range(100)
                )
                body = json.dumps(
                    {
                        "name": f"cancel-{index}.md",
                        "content_base64": base64.b64encode(document.encode()).decode(),
                        "data_class": "restricted",
                    }
                ).encode()
            elif args.mode == "tts":
                route, lane = "/v1/audio/speech", 1
                body = json.dumps(
                    {
                        "model": "tts-flite-slt-reference",
                        "voice": "tts-flite-slt-reference",
                        "input": "A cancellation measurement is in progress. " * 50,
                    }
                ).encode()
            else:
                route, lane = "/v1/audio/transcriptions", 1
                content_type = "multipart/form-data; boundary=cancelprobe"
                body = (
                    b'--cancelprobe\r\nContent-Disposition: form-data; name="model"\r\n\r\nasr-parakeet-q4k-reference\r\n--cancelprobe\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n'
                    + Path(".sanctum/speech-smoke/jfk.wav").read_bytes()
                    + b"\r\n--cancelprobe--\r\n"
                )
            with socket.create_connection(("127.0.0.1", 8769), timeout=30) as connection:
                connection.sendall(
                    (
                        f"POST {route} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n"
                    ).encode()
                    + body
                )
                until = time.monotonic() + 30
                if args.mode == "chat":
                    received = b""
                    while b"data:" not in received:
                        part = connection.recv(4096)
                        assert part, "chat ended before streaming"
                        received += part
                        assert len(received) < 65536 and time.monotonic() < until
                else:
                    marker = {"asr": "parakeet-cli", "tts": "flite"}.get(args.mode)
                    while True:
                        active = client.get("/healthz/dispatch").json()["active"][lane]
                        if active and (
                            marker is None
                            or any(executable(pid) == marker for pid in descendants(args.pid))
                        ):
                            break
                        assert time.monotonic() < until, "engine did not become active"
                        time.sleep(0.01)
                    if args.mode == "knowledge":
                        time.sleep(0.1)
                owned_before = descendants(args.pid)
                started = time.monotonic()
                connection.shutdown(socket.SHUT_RDWR)
            while client.get("/healthz/dispatch").json()["active"][lane] != 0:
                assert time.monotonic() - started < 3, "slot release exceeded maximum"
                time.sleep(0.01)
            elapsed = time.monotonic() - started
            if args.mode in ("asr", "tts"):
                assert not any(
                    executable(pid) in ("parakeet-cli", "flite") for pid in descendants(args.pid)
                ), "CLI engine survived cancellation"
            # A fresh real request must succeed; never replay the cancelled mutation.
            if args.mode == "knowledge":
                recovery = client.get("/v1/workspaces")
                recovery.raise_for_status()
            elif args.mode == "chat":
                recovery = client.post(
                    "/v1/chat/completions",
                    json={
                        "model": "chat-tiny-q8",
                        "messages": [{"role": "user", "content": "Say OK."}],
                        "max_tokens": 1,
                    },
                )
                recovery.raise_for_status()
            samples.append(
                {"slot_release_seconds": elapsed, "owned_processes_at_cancel": len(owned_before)}
            )
            print(f"{args.mode} {index + 1}/{args.samples}: {elapsed:.6f}s", flush=True)
    finally:
        client.close()
        record = {
            "mode": args.mode,
            "samples": samples,
            "scope": "Gateway lane release and worker/recovery checks; NOT full leak/overload/compute-stop gate",
        }
        if samples:
            values = sorted(row["slot_release_seconds"] for row in samples)
            record["p95_seconds"] = values[math.ceil(len(values) * 0.95) - 1]
            record["max_seconds"] = max(values)
        args.output.write_text(json.dumps(record, indent=2) + "\n")
    assert len(samples) == args.samples
    assert record["p95_seconds"] <= 2 and record["max_seconds"] < 3


if __name__ == "__main__":
    main()
