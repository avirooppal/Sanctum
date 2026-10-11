"""Measure SIGTERM of an explicitly selected ready runtime with real active jobs."""

import argparse
import base64
import json
import os
from pathlib import Path
import signal
import socket
import time
from realtime_transport import ticket, connect, receive

import httpx2
from cancellation_release import descendants, executable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--held-websocket", action="store_true")
    args = parser.parse_args()
    assert executable(args.pid) == "sanctum-runtime"
    token = args.token_file.read_text().strip()
    connections = []
    result = {}
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
        trust_env=False,
    )

    def send(route, body, content_type="application/json"):
        connection = socket.create_connection(("127.0.0.1", 8769), timeout=10)
        connections.append(connection)
        connection.sendall(
            f"POST {route} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\n\r\n".encode()
            + body
        )
        return connection

    try:
        held = None
        if args.held_websocket:
            held, code = connect(ticket(token))
            assert code == 101 and receive(held)[0] == 1
            connections.append(held)
            result["held_websocket"] = True
        workspace = client.post("/v1/workspaces", json={"name": "Active shutdown"})
        workspace.raise_for_status()
        chat = send(
            "/v1/chat/completions",
            json.dumps(
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
            ).encode(),
        )
        received = b""
        while b"data:" not in received:
            part = chat.recv(4096)
            assert part, "chat ended before streaming"
            received += part
        for _ in range(2):
            send(
                "/v1/chat/completions",
                json.dumps(
                    {
                        "model": "chat-tiny-q8",
                        "messages": [{"role": "user", "content": "Write a long story."}],
                        "stream": True,
                        "max_tokens": 4096,
                    }
                ).encode(),
            )
        document = "\n\n".join(
            f"# Section {n}\nThe local observation number {n} is recorded. " * 20
            for n in range(100)
        )
        send(
            f"/v1/workspaces/{workspace.json()['id']}/documents",
            json.dumps(
                {
                    "name": "shutdown.md",
                    "data_class": "restricted",
                    "content_base64": base64.b64encode(document.encode()).decode(),
                }
            ).encode(),
        )
        wav = Path(".sanctum/speech-smoke/jfk.wav").read_bytes()
        send(
            "/v1/audio/transcriptions",
            b'--shutdown\r\nContent-Disposition: form-data; name="model"\r\n\r\nasr-parakeet-q4k-reference\r\n--shutdown\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n'
            + wav
            + b"\r\n--shutdown--\r\n",
            "multipart/form-data; boundary=shutdown",
        )
        until = time.monotonic() + 10
        while time.monotonic() < until:
            counts = client.get("/healthz/dispatch").json()
            active = counts["active"]
            owned = descendants(args.pid)
            if (
                counts["queued"][2] > 0
                and all(active[index] > 0 for index in [1, 2, 3])
                and any(executable(pid) == "parakeet-cli" for pid in owned)
            ):
                break
            time.sleep(0.01)
        assert counts["queued"][2] > 0
        assert all(active[index] > 0 for index in [1, 2, 3])
        assert any(executable(pid) == "parakeet-cli" for pid in owned)
        slow = socket.create_connection(("127.0.0.1", 8769), timeout=2)
        connections.append(slow)
        route = (
            f"/v1/workspaces/{workspace.json()['id']}/documents"
            if args.held_websocket
            else "/v1/audio/transcriptions"
        )
        slow.sendall(
            f"POST {route} HTTP/1.1\r\nContent-Length: 100000\r\nExpect: 100-continue\r\n\r\n".encode()
        )
        acknowledgement = b""
        while not acknowledgement.endswith(b"\r\n\r\n"):
            part = slow.recv(1)
            assert part, "slow body was not admitted"
            acknowledgement += part
        assert acknowledgement.startswith(b"HTTP/1.1 100 ")
        slow.sendall(b"x")
        owned |= descendants(args.pid)
        result.update(
            active_lanes=active,
            queued_lanes=counts["queued"],
            owned_pids=sorted(owned),
            slow_upload=True,
        )
        started = time.monotonic()
        os.kill(args.pid, signal.SIGTERM)
        closed = None
        survivors = owned | {args.pid}
        while time.monotonic() - started < 5:
            if closed is None:
                try:
                    probe = socket.create_connection(("127.0.0.1", 8769), timeout=0.05)
                    probe.close()
                except OSError:
                    closed = time.monotonic() - started
            survivors = {pid for pid in survivors if Path(f"/proc/{pid}").exists()}
            if not survivors:
                break
            time.sleep(0.01)
        result.update(
            shutdown_seconds=time.monotonic() - started,
            listener_closed_seconds=closed,
            surviving_pids=sorted(survivors),
        )
        assert closed is not None and closed < 0.25, result
        assert not survivors and result["shutdown_seconds"] < 5, result
        if held:
            opcode, payload = receive(held)
            assert opcode == 8 and int.from_bytes(payload[:2], "big") == 1001
            result["websocket_close_code"] = 1001
        print(json.dumps(result, indent=2))
    finally:
        for connection in connections:
            connection.close()
        client.close()
        args.output.write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
