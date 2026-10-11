"""Real ticket endpoint security/contract exercise; never emits credentials."""

import argparse
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    token = Path(args.token_file).read_text().strip()
    base = "http://127.0.0.1:8769"
    passed = []
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(method="POST", origin=base, authorized=True, data=b""):
        headers = {"Origin": origin}
        if authorized:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(
            base + "/v1/realtime/tickets",
            data=data if method == "POST" else None,
            headers=headers,
            method=method,
        )
        try:
            response = opener.open(req, timeout=3)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, dict(response.headers), response.read()

    assert request(authorized=False)[0] == 401
    passed.append("missing_auth")
    for origin in ["null", "http://evil.example", "http://127.0.0.1:9999", base + "/"]:
        assert request(origin=origin)[0] == 403
    passed.append("origin_checks")
    assert request(method="GET")[0] == 405
    passed.append("method")
    assert request(data=b"x")[0] == 413
    passed.append("body_limit")
    tickets = set()
    for _ in range(32):
        code, headers, body = request()
        assert code == 200 and headers["Cache-Control"] == "no-store"
        value = json.loads(body)
        assert set(value) == {"ticket", "expires_in", "protocol"}
        assert value["expires_in"] == 30 and value["protocol"] == "sanctum.realtime.v1"
        assert re.fullmatch("[0-9a-f]{64}", value["ticket"])
        tickets.add(value["ticket"])
    assert len(tickets) == 32
    passed.append("random_unique_bounded_tickets")
    code, headers, _ = request()
    assert code == 503 and headers["Retry-After"] == "1"
    passed.append("capacity_sheds")
    result = {
        "suite": "realtime-ticket-http-v1",
        "passed": passed,
        "ticket_values_recorded": False,
        "websocket_gate": "PENDING",
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
