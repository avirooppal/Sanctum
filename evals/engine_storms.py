"""Real-engine disconnect, overload and slow-reader storms with process resources."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx2
from cancellation_release import descendants


def snapshot(pid):
    rows = {}
    for child in sorted({pid} | descendants(pid)):
        root = Path(f"/proc/{child}")
        argv = (root / "cmdline").read_bytes().split(b"\0")
        command = (root / "comm").read_text().strip()
        if child == pid:
            key = "gateway"
        elif b"--alias" in argv:
            key = command + ":" + argv[argv.index(b"--alias") + 1].decode()
        elif any(b"knowledge/worker.py" in arg for arg in argv):
            key = command + ":knowledge"
        else:
            raise AssertionError(f"transient worker still exists: {child} {command}")
        assert key not in rows, key
        status = dict(line.split(":", 1) for line in (root / "status").read_text().splitlines())
        links = [path.readlink().as_posix() for path in (root / "fd").iterdir()]
        rows[key] = {
            "pid": child,
            "fds": len(links),
            "sockets": sum(link.startswith("socket:") for link in links),
            "threads": int(status["Threads"]),
            "rss_kib": int(status["VmRSS"].split()[0]),
        }
    return rows


def compare(before, after):
    assert before.keys() == after.keys(), (before.keys(), after.keys())
    for role, old in before.items():
        new = after[role]
        assert new["fds"] == old["fds"], (role, "fds", old, new)
        assert new["sockets"] == old["sockets"], (role, "sockets", old, new)
        assert new["threads"] <= old["threads"] + 2, (role, "threads", old, new)
        assert new["rss_kib"] <= old["rss_kib"] + 16384, (role, "rss", old, new)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runtime-config", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    results = {}
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
        trust_env=False,
    )

    def request(kind):
        request_started = time.monotonic()
        payload = {
            "model": "chat-tiny-q8",
            "messages": [
                {"role": "user", "content": "Write a detailed story for thousands of words."}
            ],
            "max_tokens": 4096,
            "stream": True,
        }
        route = "/v1/chat/completions"
        if kind == "slow_reader":
            route = "/v1/embeddings"
            payload = {"model": "embed-small-q8", "input": ["A local test sentence."] * 128}
        body = json.dumps(payload).encode()
        with socket.socket() as connection:
            connection.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024)
            connection.settimeout(120 if kind == "slow_reader" else 30)
            connection.connect(("127.0.0.1", 8769))
            connection.sendall(
                f"POST {route} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n".encode()
                + body
            )
            received = b""
            while b"\r\n\r\n" not in received:
                try:
                    part = connection.recv(1024)
                except TimeoutError as error:
                    raise TimeoutError(
                        f"{kind}: no complete headers after {time.monotonic() - request_started:.3f}s, received={len(received)} bytes"
                    ) from error
                except ConnectionResetError:
                    return "reset"
                if not part:
                    return "closed"
                received += part
            if b"503" in received.split(b"\r\n")[0]:
                assert b"Retry-After: 1" in received
                return "shed"
            assert b"200 OK" in received.split(b"\r\n")[0], received[:100]
            print(f"{kind}: headers {time.monotonic() - request_started:.3f}s", flush=True)
            if kind == "slow_reader":
                time.sleep(3)
            else:
                while b"data:" not in received:
                    part = connection.recv(1024)
                    assert part
                    received += part
            return "engine_started"

    def settle():
        time.sleep(10)
        stats = client.get("/healthz/dispatch").json()
        assert stats["queued"] == [0, 0, 0, 0]
        assert stats["active"][1:] == [0, 0, 0]
        time.sleep(0.2)
        return snapshot(args.pid)

    try:
        # Warm exactly the workloads used by the storms, before setting the baseline.
        for kind in ["disconnect", "slow_reader"]:
            print("warming", kind, flush=True)
            with ThreadPoolExecutor(max_workers=4) as pool:
                warm = list(pool.map(request, [kind] * 8))
            assert "engine_started" in warm
        workspace = client.post("/v1/workspaces", json={"name": "Storm warmup"})
        workspace.raise_for_status()
        document = "\n\n".join(
            f"# Section {n}\nThe recorded measurement for item {n} is {n + 49}. " * 8
            for n in range(100)
        )
        warmed = client.post(
            f"/v1/workspaces/{workspace.json()['id']}/documents",
            json={
                "name": "storm-warmup.md",
                "data_class": "restricted",
                "content_base64": base64.b64encode(document.encode()).decode(),
            },
            timeout=240,
        )
        warmed.raise_for_status()
        results["knowledge_warmup"] = warmed.json()
        baseline = settle()
        results["baseline"] = baseline
        for kind, count, concurrency in [
            ("disconnect", 50, 4),
            ("slow_reader", 16, 4),
            ("overload", 100, 24),
        ]:
            started = time.monotonic()
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                outcomes = list(pool.map(request, [kind] * count))
            after = settle()
            results[kind] = {
                "seconds": time.monotonic() - started,
                "outcomes": {name: outcomes.count(name) for name in set(outcomes)},
                "after": after,
            }
            assert "engine_started" in outcomes
            compare(baseline, after)
            print(kind, results[kind]["outcomes"], flush=True)
        for mode in ["chat", "knowledge", "reranker", "asr", "tts"]:
            for method in ["disconnect", "explicit"]:
                output = args.output.with_name(args.output.stem + f"-{mode}-{method}.json")
                completed = subprocess.run(
                    [
                        sys.executable,
                        "evals/cancellation_release.py",
                        "--pid",
                        str(args.pid),
                        "--token-file",
                        str(args.token_file),
                        "--mode",
                        mode,
                        "--cancel-method",
                        method,
                        "--runtime-config",
                        str(args.runtime_config),
                        "--samples",
                        "50",
                        "--output",
                        str(output),
                    ],
                    capture_output=True,
                    text=True,
                )
                after = settle()
                results[f"{mode}-{method}"] = {
                    "exit_code": completed.returncode,
                    "evidence": str(output),
                    "after": after,
                }
                assert completed.returncode == 0, completed.stderr
                compare(baseline, after)
                print(
                    mode, method, "50 cancellations, compute and resource gates passed", flush=True
                )
        results["scope"] = (
            "Real engine storms; repeated start-stop and sustained mixed overload remain separate"
        )

    finally:
        client.close()
        args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
