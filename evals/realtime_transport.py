"""Real loopback WebSocket security checks using raw adversarial client frames."""

import argparse
import base64
import json
import hashlib
import secrets
import socket
import struct
import time
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8769"


def ticket(token):
    req = urllib.request.Request(
        BASE + "/v1/realtime/tickets",
        data=b"",
        headers={"Authorization": "Bearer " + token, "Origin": BASE},
    )
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(
        req, timeout=3
    ) as response:
        return json.load(response)["ticket"]


def connect(credential, origin=BASE):
    client = socket.create_connection(("127.0.0.1", 8769), timeout=3)
    key = base64.b64encode(secrets.token_bytes(16)).decode()
    request = f"GET /v1/realtime HTTP/1.1\r\nHost: 127.0.0.1:8769\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\nOrigin: {origin}\r\nSec-WebSocket-Protocol: sanctum.realtime.v1, ticket.{credential}\r\n\r\n"
    client.sendall(request.encode())
    head = bytearray()
    while not head.endswith(b"\r\n\r\n"):
        byte = client.recv(1)
        if not byte:
            raise RuntimeError("handshake EOF")
        head.extend(byte)
        if len(head) > 16384:
            raise RuntimeError("handshake too large")
    status = int(head.split(b" ")[1])
    if status == 101:
        expected = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
        )
        assert b"Sec-WebSocket-Accept: " + expected in head
    return client, status


def send(client, payload, opcode=1, final=True, masked=True):
    first = opcode | (128 if final else 0)
    length = len(payload)
    prefix = bytes(
        [
            first,
            (128 if masked else 0) | (length if length < 126 else 126 if length < 65536 else 127),
        ]
    )
    if length >= 126:
        prefix += struct.pack("!H" if length < 65536 else "!Q", length)
    mask = secrets.token_bytes(4) if masked else b""
    client.sendall(
        prefix
        + mask
        + (bytes(b ^ mask[i % 4] for i, b in enumerate(payload)) if masked else payload)
    )


def receive(client):
    def exact(count):
        data = bytearray()
        while len(data) < count:
            chunk = client.recv(count - len(data))
            if not chunk:
                raise RuntimeError("frame EOF")
            data.extend(chunk)
        return bytes(data)

    first, second = exact(2)
    length = second & 127
    if length >= 126:
        length = struct.unpack("!H" if length == 126 else "!Q", exact(2 if length == 126 else 8))[0]
    if second & 128 or length > 65536:
        raise RuntimeError("invalid server frame")
    return first & 15, exact(length)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    token = Path(args.token_file).read_text().strip()
    passed = []
    for credential, origin in [("0" * 64, BASE), (ticket(token), "http://evil.example")]:
        client, code = connect(credential, origin)
        client.close()
        assert code == 403
    passed.append("bad_ticket_and_origin")
    credential = ticket(token)
    client, code = connect(credential)
    assert code == 101
    opcode, payload = receive(client)
    assert opcode == 1 and json.loads(payload)["type"] == "ready"
    client.close()
    client, code = connect(credential)
    client.close()
    assert code == 403
    passed.append("single_use_replay")
    for name, payload, kwargs, expected in [
        ("fragmented", b"{}", {"final": False}, 1002),
        ("unmasked", b"{}", {"masked": False}, 1002),
        ("invalid_utf8", b"\xff", {}, 1007),
        ("invalid_json", b"{", {}, 1007),
        ("unknown_command", b'{"type":"shell"}', {}, 1008),
        ("oversized", b"x" * 65537, {}, 1009),
        ("oversized_json", b"x" * 4097, {}, 1009),
    ]:
        client, code = connect(ticket(token))
        assert code == 101
        receive(client)
        send(client, payload, **kwargs)
        opcode, reply = receive(client)
        assert opcode == 8 and struct.unpack("!H", reply[:2])[0] == expected, name
        client.close()
        passed.append(name)
    client, code = connect(ticket(token))
    assert code == 101
    receive(client)
    for kind in ["start", "interrupt", "start", "stop"]:
        send(client, json.dumps({"type": kind}).encode())
        opcode, reply = receive(client)
        assert opcode == 1 and json.loads(reply)["protocol"] == "sanctum.realtime.v1"
    send(client, struct.pack("!H", 1000), opcode=8)
    assert receive(client)[0] == 8
    client.close()
    passed.append("controls_reconnect_clean_close")
    slow = socket.create_connection(("127.0.0.1", 8769), timeout=3)
    slow.sendall(b"GET /v1/realtime HTTP/1.1\r\n")
    began = time.monotonic()
    assert slow.recv(1) == b""
    handshake_release = time.monotonic() - began
    assert handshake_release < 2
    slow.close()
    passed.append("handshake_slowloris")
    slow, code = connect(ticket(token))
    assert code == 101
    receive(slow)
    slow.sendall(b"\x81\x80\x00")
    began = time.monotonic()
    assert receive(slow)[0] == 8
    frame_release = time.monotonic() - began
    assert frame_release < 2
    slow.close()
    passed.append("incomplete_frame_deadline")
    credential = ticket(token)
    started = time.monotonic()
    time.sleep(30.1)
    client, code = connect(credential)
    client.close()
    assert code == 403
    passed.append("expired_ticket")
    result = {
        "suite": "real-realtime-transport-v1",
        "passed": passed,
        "expiry_wait_seconds": time.monotonic() - started,
        "held_session_gate": "PENDING",
        "speech_pipeline": False,
        "handshake_release_seconds": handshake_release,
        "incomplete_frame_release_seconds": frame_release,
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
