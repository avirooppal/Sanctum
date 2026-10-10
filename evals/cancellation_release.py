"""Real request disconnect/slot-release measurements; not the complete storm gate."""

import argparse
import base64
import json
import math
import socket
import time
from pathlib import Path

import httpx2
from engine_observer import Observer


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
    parser.add_argument(
        "--mode", choices=["chat", "knowledge", "reranker", "asr", "tts"], required=True
    )
    parser.add_argument("--samples", type=int, default=50)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runtime-config", type=Path)
    parser.add_argument("--cancel-method", choices=["disconnect", "explicit"], default="disconnect")
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
    if args.cancel_method == "explicit":
        assert (
            client.post("/v1/cancel", headers={"Authorization": "Bearer invalid"}).status_code
            == 401
        )
        assert client.get("/v1/cancel").status_code == 405
        assert client.post("/v1/cancel", json={}).status_code == 413
        idle = client.post("/v1/cancel")
        idle.raise_for_status()
        assert idle.json() == {"cancelled": 0, "reason": "explicit"}
    workspace = None
    if args.mode in ("knowledge", "reranker"):
        response = client.post("/v1/workspaces", json={"name": "Cancellation measurements"})
        response.raise_for_status()
        workspace = response.json()["id"]
        if args.mode == "reranker":
            document = "\n\n".join(
                f"# Sensor {n}\nThe stored reading for sensor {n} is {n + 3} units."
                for n in range(20)
            )
            seeded = client.post(
                f"/v1/workspaces/{workspace}/documents",
                json={
                    "name": "rerank-cancel.md",
                    "data_class": "restricted",
                    "content_base64": base64.b64encode(document.encode()).decode(),
                },
            )
            seeded.raise_for_status()

    samples = []
    observer = Observer(args.pid, args.runtime_config) if args.runtime_config else None
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
            elif args.mode == "reranker":
                route, lane = f"/v1/workspaces/{workspace}/search", 3
                body = json.dumps(
                    {"query": "What are the stored sensor readings?", "k": 20}
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
                        started_work = (
                            observer.query("reranker" if args.mode == "reranker" else "embedding")
                            > 0
                            if marker is None and observer is not None
                            else marker is None
                            or any(executable(pid) == marker for pid in descendants(args.pid))
                        )
                        if active and started_work:
                            break
                        assert time.monotonic() < until, "engine did not become active"
                        time.sleep(0.01)
                    if args.mode == "knowledge":
                        time.sleep(0.1)
                if observer is not None and args.mode == "chat":
                    assert observer.query("chat") > 0, "chat engine not processing at cancellation"
                owned_before = descendants(args.pid)
                started = time.monotonic()
                if args.cancel_method == "explicit":
                    cancelled = client.post("/v1/cancel")
                    cancelled.raise_for_status()
                    assert (
                        cancelled.json()["reason"] == "explicit"
                        and cancelled.json()["cancelled"] >= 1
                    )
                else:
                    connection.shutdown(socket.SHUT_RDWR)
            while client.get("/healthz/dispatch").json()["active"][lane] != 0:
                assert time.monotonic() - started < 3, "slot release exceeded maximum"
                time.sleep(0.01)
            elapsed = time.monotonic() - started
            if args.mode in ("asr", "tts"):
                assert not any(
                    executable(pid) in ("parakeet-cli", "flite") for pid in descendants(args.pid)
                ), "CLI engine survived cancellation"
            compute_elapsed = elapsed
            if observer is not None:
                roles = (
                    ["chat"]
                    if args.mode == "chat"
                    else (
                        ["embedding", "reranker", "chat"]
                        if args.mode in ("knowledge", "reranker")
                        else []
                    )
                )
                while any(observer.query(role) > 0 for role in roles):
                    assert time.monotonic() - started < 3, "engine compute release exceeded maximum"
                    time.sleep(0.01)
                compute_elapsed = time.monotonic() - started
            # A fresh real request must succeed; never replay the cancelled mutation.
            if args.mode in ("knowledge", "reranker"):
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
            sample = {
                "slot_release_seconds": elapsed,
                "owned_processes_at_cancel": len(owned_before),
            }
            if observer is not None:
                sample["compute_release_seconds"] = compute_elapsed
            samples.append(sample)
            print(f"{args.mode} {index + 1}/{args.samples}: {elapsed:.6f}s", flush=True)
    finally:
        if observer is not None:
            observer.close()
        client.close()
        record = {
            "mode": args.mode,
            "cancel_method": args.cancel_method,
            "samples": samples,
            "scope": "Gateway lane release and worker/recovery checks; NOT full leak/overload/compute-stop gate",
        }
        if samples:
            values = sorted(row["slot_release_seconds"] for row in samples)
            record["p95_seconds"] = values[math.ceil(len(values) * 0.95) - 1]
            record["max_seconds"] = max(values)
            if observer is not None:
                compute = sorted(row["compute_release_seconds"] for row in samples)
                record["compute_p95_seconds"] = compute[math.ceil(len(compute) * 0.95) - 1]
                record["compute_max_seconds"] = max(compute)
                record["scope"] = (
                    "Gateway release, real model slot idle or speech PID absence, recovery; not full leak/overload gate"
                )
        args.output.write_text(json.dumps(record, indent=2) + "\n")
    assert len(samples) == args.samples
    assert record["p95_seconds"] <= 2 and record["max_seconds"] < 3
    if observer is not None:
        assert record["compute_p95_seconds"] <= 2 and record["compute_max_seconds"] < 3


if __name__ == "__main__":
    main()
