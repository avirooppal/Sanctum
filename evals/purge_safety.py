"""Non-destructive real purge availability probe; refuses legacy runtimes."""

import argparse
import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def call(path, body=None, auth=True):
        headers = {"Authorization": "Bearer " + token} if auth else {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request("http://127.0.0.1:8769" + path, data=body, headers=headers)
        try:
            with opener.open(request, timeout=10) as response:
                return response.status, response.read(1024 * 1024)
        except urllib.error.HTTPError as error:
            return error.code, error.read(1024 * 1024)

    status, raw = call("/v1/capabilities")
    caps = json.loads(raw)
    assert status == 200 and caps.get("purge_safety") == "disabled-v1", (
        "Refusing legacy runtime: no safety marker"
    )
    assert "full_purge" not in caps["capabilities"]
    status, before = call("/v1/conversations")
    assert status == 200
    assert len(json.loads(before)["data"]) > 0, "Probe needs populated conversation metadata"
    cases = []
    for name, body, auth, expected in [
        ("owner_auth", b"{}", False, 401),
        ("confirmation", b"{}", True, 400),
        ("malformed", b"not json", True, 400),
        ("oversize", b" " * 1025, True, 413),
        ("disabled", b'{"confirm":"PURGE ALL SANCTUM DATA"}', True, 501),
    ]:
        status, raw = call("/v1/purge", body, auth)
        assert status == expected, (name, status, expected)
        if name == "disabled":
            assert json.loads(raw)["error"]["code"] == "capability_unavailable"
        cases.append({"name": name, "status": status})
    status, after = call("/v1/conversations")
    assert status == 200 and before == after
    record = {
        "suite": "purge-safety-v1",
        "journeys": ["J11", "J12"],
        "status": "PASS",
        "cases": cases,
        "metadata_unchanged": True,
        "metadata_sha256": hashlib.sha256(after).hexdigest(),
        "full_purge_verified": False,
        "ledger_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record))


if __name__ == "__main__":
    main()
