"""Prove a non-reading WS cannot pin the shared voice connection lease."""

import argparse
import json
import socket
import time
from pathlib import Path

from realtime_transport import ticket, connect, receive, send


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    sentinel, code = connect(ticket(token))
    assert code == 101
    receive(sentinel)
    slow, code = connect(ticket(token))
    assert code == 101
    receive(slow)
    slow.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024)
    started = time.monotonic()
    for _ in range(2000):
        send(slow, b'{"type":"metrics"}')
    releases = []
    until = started + 3
    recovered = None
    probe = ticket(token)
    while time.monotonic() < until:
        candidate, code = connect(probe)
        if code == 101:
            recovered = candidate
            releases.append(time.monotonic() - started)
            break
        assert code == 503
        candidate.close()
        time.sleep(0.05)
    try:
        assert recovered is not None
        assert releases[0] < 3
        result = {
            "suite": "real-ws-slow-reader-v1",
            "slot_release_seconds": releases[0],
            "response_stall_bound_seconds": 1.8,
            "max_release_bound_seconds": 3,
            "frames_sent": 2000,
            "socket_receive_buffer": slow.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF),
        }
        args.output.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))
    finally:
        for connection in [sentinel, slow, recovered]:
            if connection:
                connection.close()


if __name__ == "__main__":
    main()
