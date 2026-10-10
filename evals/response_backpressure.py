"""Real embedding/SSE slow-reader checks against a ready reference runtime."""

import argparse
import json
import socket
import time
from pathlib import Path

import httpx2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    results = {}
    with httpx2.Client(base_url="http://127.0.0.1:8769", timeout=5, trust_env=False) as observer:
        try:
            with socket.create_connection(("127.0.0.1", 8769), timeout=5) as upload:
                upload.sendall(
                    b"POST /v1/audio/transcriptions HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100000\r\n\r\n"
                    + b"x" * 8192
                )
                upload.settimeout(0.2)
                started = time.monotonic()
                while time.monotonic() - started < 5:
                    try:
                        upload.sendall(b"x")
                        if not upload.recv(1):
                            break
                    except socket.timeout:
                        pass
                    except (BrokenPipeError, ConnectionResetError):
                        break
                elapsed = time.monotonic() - started
                assert elapsed < 5, "initial burst subsidized a slow upload"
                results["burst_then_trickle_upload_seconds"] = elapsed
                print("upload", elapsed, flush=True)
            for name, route, payload in [
                (
                    "fixed_embeddings",
                    "/v1/embeddings",
                    {"model": "embed-small-q8", "input": ["A short local sentence."] * 128},
                ),
                (
                    "streaming_chat",
                    "/v1/chat/completions",
                    {
                        "model": "chat-tiny-q8",
                        "messages": [
                            {
                                "role": "user",
                                "content": "Write a long detailed story for thousands of words.",
                            }
                        ],
                        "stream": True,
                        "max_tokens": 4096,
                    },
                ),
            ]:
                assert observer.get("/healthz/dispatch").json()["active"][2] == 0
                with socket.socket() as connection:
                    connection.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024)
                    connection.settimeout(60)
                    connection.connect(("127.0.0.1", 8769))
                    body = json.dumps(payload).encode()
                    connection.sendall(
                        f"POST {route} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n".encode()
                        + body
                    )
                    header = b""
                    while not header.endswith(b"\r\n\r\n"):
                        part = connection.recv(1)
                        assert part, "closed before response headers"
                        header += part
                    assert b"200 OK" in header.split(b"\r\n")[0], header[:100]
                    started = time.monotonic()
                    observed_active = False
                    while time.monotonic() - started < 60:
                        active = observer.get("/healthz/dispatch").json()["active"][2]
                        observed_active |= active > 0
                        if observed_active and active == 0:
                            break
                        time.sleep(0.02)
                    elapsed = time.monotonic() - started
                    assert observed_active and active == 0, "slow reader pinned lane"
                    results[name] = {
                        "header_to_slot_release_seconds": elapsed,
                        "scope": "Includes socket-buffer filling/model generation; not last-send idle time",
                    }
                    print(name, elapsed, flush=True)
        finally:
            args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
