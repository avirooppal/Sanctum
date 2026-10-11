"""Ten-minute real authenticated held-session/priority/resource gate."""

import argparse
import base64
import json
import math
import threading
import time
from pathlib import Path

import httpx2
from engine_storms import snapshot, compare
from realtime_transport import ticket, connect, receive, send


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--runtime-config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=600)
    args = parser.parse_args()
    assert args.seconds >= 600
    config = json.loads(args.runtime_config.read_text())
    token = args.token_file.read_text().strip()
    client = httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": "Bearer " + token},
        trust_env=False,
        timeout=5,
    )
    workspace = client.post("/v1/workspaces", json={"name": "Realtime held gate"}).json()["id"]
    prompt = {
        "model": config["chat"]["id"],
        "messages": [{"role": "user", "content": "Say hello briefly."}],
        "max_tokens": 8,
        "stream": True,
    }
    doc = {
        "name": "held.md",
        "data_class": "restricted",
        "content_base64": base64.b64encode(
            b"# Local privacy\n\nLocal documents stay on this device."
        ).decode(),
    }
    client.post("/v1/chat/completions", json=prompt).raise_for_status()
    client.post("/v1/workspaces/" + workspace + "/documents", json=doc).raise_for_status()
    time.sleep(10)
    before = snapshot(args.pid)
    sockets = []
    for _ in range(2):
        connection, code = connect(ticket(token))
        assert code == 101
        assert receive(connection)[0] == 1
        connection.settimeout(20)
        sockets.append(connection)
    started = time.monotonic()
    extra, code = connect(ticket(token))
    extra.close()
    shed_latency = time.monotonic() - started
    assert code == 503 and shed_latency <= 0.25
    stop = threading.Event()
    errors = []
    samples = {"health": [], "models": [], "chat": []}
    shed = []
    observation = []
    result = {
        "suite": "real-realtime-held-v1",
        "attempted_sessions": 3,
        "admitted_sessions": 2,
        "third_status": code,
        "third_shed_seconds": shed_latency,
        "baseline": before,
        "errors": errors,
        "samples": samples,
        "shed": shed,
        "observations": observation,
        "speech_pipeline": False,
    }

    def pump(connection):
        try:
            while not stop.is_set():
                opcode, payload = receive(connection)
                if opcode == 9:
                    send(connection, payload, opcode=10)
                elif opcode == 8:
                    raise RuntimeError("held session closed early")
        except Exception as error:
            if not stop.is_set():
                errors.append(type(error).__name__)

    def background(index):
        try:
            while not stop.is_set():
                response = client.post(
                    "/v1/workspaces/" + workspace + "/documents",
                    json={**doc, "name": f"background-{index}.md"},
                )
                if response.status_code == 503:
                    shed.append(response.status_code)
                else:
                    response.raise_for_status()
                time.sleep(0.05)
        except Exception as error:
            if not stop.is_set():
                errors.append(type(error).__name__)

    workers = [threading.Thread(target=pump, args=(connection,)) for connection in sockets] + [
        threading.Thread(target=background, args=(i,)) for i in range(6)
    ]
    for worker in workers:
        worker.start()
    started = time.monotonic()
    try:
        while time.monotonic() - started < args.seconds:
            for name, path in [("health", "/healthz"), ("models", "/v1/models")]:
                tick = time.monotonic()
                response = client.get(path)
                response.raise_for_status()
                samples[name].append(time.monotonic() - tick)
            tick = time.monotonic()
            response = client.post("/v1/chat/completions", json=prompt)
            response.raise_for_status()
            assert "[DONE]" in response.text
            samples["chat"].append(time.monotonic() - tick)
            counts = client.get("/healthz/dispatch")
            counts.raise_for_status()
            observation.append(counts.json())
            assert sum(observation[-1]["queued"]) <= 8
            assert not errors, errors
            time.sleep(0.1)
        result["seconds_actual"] = time.monotonic() - started
    finally:
        stop.set()
        for connection in sockets:
            try:
                connection.shutdown(2)
            except OSError:
                pass
            connection.close()
        for worker in workers:
            worker.join(5)
        assert not any(worker.is_alive() for worker in workers)
        time.sleep(10)
        result["after"] = snapshot(args.pid)
        result["p95_seconds"] = {
            name: sorted(values)[math.ceil(len(values) * 0.95) - 1]
            for name, values in samples.items()
            if values
        }
        args.output.write_text(json.dumps(result, indent=2) + "\n")
        client.close()
    assert result["seconds_actual"] >= 600 and not errors and shed
    for name, bound in [("health", 0.25), ("models", 0.25), ("chat", 5)]:
        assert result["p95_seconds"][name] <= bound
    compare(before, result["after"])
    print(
        json.dumps(
            {
                key: result[key]
                for key in [
                    "seconds_actual",
                    "p95_seconds",
                    "admitted_sessions",
                    "third_shed_seconds",
                ]
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
