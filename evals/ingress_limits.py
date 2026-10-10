"""Real ingress socket/stall/leak checks on a spawned confined runtime (no engines)."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import socket
import subprocess
import time


def snapshot(pid):
    root = Path(f"/proc/{pid}")
    status = dict(line.split(":", 1) for line in (root / "status").read_text().splitlines())
    return {
        "fds": len(list((root / "fd").iterdir())),
        "threads": int(status["Threads"]),
        "rss_kib": int(status["VmRSS"].split()[0]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    process = subprocess.Popen(
        [str(args.binary.resolve()), "--port", "0"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    results = {}
    try:
        startup = json.loads(process.stdout.readline())
        host, port = startup["address"].rsplit(":", 1)
        address = (host, int(port))

        def request(data):
            with socket.create_connection(address, timeout=4) as stream:
                stream.sendall(data)
                received = b""
                while True:
                    part = stream.recv(65536)
                    if not part:
                        return received
                    received += part

        health = b"GET /healthz HTTP/1.1\r\nHost: localhost\r\n\r\n"
        for _ in range(20):
            assert b"200 OK" in request(health)
        time.sleep(1)
        before = snapshot(process.pid)
        for data, code in [
            (
                b"POST /v1/chat/completions HTTP/1.1\r\nContent-Length: 1\r\nContent-Length: 2\r\n\r\n",
                b"400",
            ),
            (b"POST /v1/audio/transcriptions HTTP/1.1\r\nContent-Length: 99999999\r\n\r\n", b"413"),
            (b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n", b"411"),
        ]:
            assert code in request(data).split(b"\r\n")[0]
        results["framing_checks"] = 3
        for name, payload in [
            ("header_stall", b"GET /healthz HTTP/1.1\r\nX-Slow:"),
            (
                "body_stall",
                b"POST /v1/audio/transcriptions HTTP/1.1\r\nContent-Length: 100000\r\n\r\nx",
            ),
        ]:
            start = time.perf_counter()
            assert request(payload) == b""
            elapsed = time.perf_counter() - start
            assert elapsed < 2.0, (name, elapsed)
            results[name + "_release_seconds"] = elapsed

        def disconnect(_):
            try:
                with socket.create_connection(address, timeout=2) as stream:
                    stream.sendall(b"GET /healthz HTTP/1.1\r\nX-Aborted:")
            except (ConnectionResetError, BrokenPipeError):
                pass

        with ThreadPoolExecutor(max_workers=24) as pool:
            list(pool.map(disconnect, range(100)))
        time.sleep(10)
        assert b"200 OK" in request(health)
        time.sleep(1)
        after = snapshot(process.pid)
        assert after["fds"] == before["fds"], (before, after)
        assert after["threads"] <= before["threads"] + 2, (before, after)
        assert after["rss_kib"] <= before["rss_kib"] + 16384, (before, after)
        results.update(before=before, after=after, disconnected_clients=100)
        start = time.perf_counter()
        process.terminate()
        process.wait(timeout=3)
        results["shutdown_seconds"] = time.perf_counter() - start
        assert process.returncode == 0
        results["scope"] = (
            "Ingress-only no-engine runtime; engine cancellation, slow response reader and full Step 0 NOT verified"
        )
        args.output.write_text(json.dumps(results, indent=2) + "\n")
        print(json.dumps(results, indent=2))
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()
