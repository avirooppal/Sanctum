"""Three-minute no-engine ingress stress; not full mixed-engine Step 0 acceptance."""

import argparse
import json
import math
from pathlib import Path
import socket
import subprocess
import threading
import time

from ingress_limits import snapshot


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
    stop = threading.Event()
    threads = []
    try:
        startup = json.loads(process.stdout.readline())
        host, port = startup["address"].rsplit(":", 1)
        address = (host, int(port))

        def health():
            with socket.create_connection(address, timeout=2) as stream:
                stream.sendall(b"GET /healthz HTTP/1.1\r\nHost: localhost\r\n\r\n")
                data = b""
                while part := stream.recv(65536):
                    data += part
                assert b"200 OK" in data

        for _ in range(20):
            health()
        time.sleep(1)
        before = snapshot(process.pid)

        def flood():
            while not stop.is_set():
                try:
                    with socket.create_connection(address, timeout=1) as stream:
                        stream.sendall(
                            b"POST /v1/workspaces/fixture/documents HTTP/1.1\r\nContent-Length: 1048576\r\n\r\n"
                        )
                        for _ in range(100):
                            if stop.wait(0.02):
                                return
                            stream.sendall(b"x" * 1024)
                except OSError:
                    stop.wait(0.02)

        threads = [threading.Thread(target=flood) for _ in range(8)]
        for thread in threads:
            thread.start()
        began = time.monotonic()
        latencies, resources = [], []
        while time.monotonic() - began < 180:
            start = time.perf_counter()
            health()
            latencies.append(time.perf_counter() - start)
            if len(latencies) % 20 == 0:
                resources.append(snapshot(process.pid))
            time.sleep(0.05)
        stop.set()
        for thread in threads:
            thread.join(timeout=3)
            assert not thread.is_alive()
        time.sleep(10)
        after = snapshot(process.pid)
        p95 = sorted(latencies)[math.ceil(len(latencies) * 0.95) - 1]
        record = {
            "duration_seconds": 180,
            "health_samples": len(latencies),
            "health_p95_seconds": p95,
            "health_max_seconds": max(latencies),
            "before": before,
            "after": after,
            "peak": {key: max(row[key] for row in resources) for key in before},
            "scope": "Ingress background-upload flood only; no engine jobs, voice or chat latency measurement",
        }
        args.output.write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps(record, indent=2))
        assert p95 < 0.250
        assert after["fds"] == before["fds"]
        assert after["threads"] <= before["threads"] + 2
        assert record["peak"]["rss_kib"] <= before["rss_kib"] + 16384
    finally:
        stop.set()
        for thread in threads:
            thread.join(timeout=3)
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()
