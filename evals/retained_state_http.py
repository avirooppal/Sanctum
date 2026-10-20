"""Restore real HTTP state contracts previously embedded in the retired browser UI."""

import argparse
import json
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    token = args.token_file.read_text().strip()
    base = "http://127.0.0.1:8769"

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def call(path, body=None, auth=True, headers=None, timeout=10):
        supplied = {"Authorization": "Bearer " + token} if auth else {}
        supplied.update(headers or {})
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        if body is not None:
            supplied["Content-Type"] = "application/json"
        request = urllib.request.Request(base + path, data=body, headers=supplied)
        try:
            response = opener.open(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(1024 * 1024 + 1)
            assert len(raw) <= 1024 * 1024, "Response exceeds client bound"
            return response.status, json.loads(raw)

    record = {"suite": "retained-state-http", "passed": [], "full_journey_verified": False}
    session, profile = "audit-" + uuid.uuid4().hex, "audit-" + uuid.uuid4().hex
    created_session, created_profile = False, False
    try:
        for name, body, auth, expected in [
            ("session_auth", {"operation": "list", "query": "", "offset": 0}, False, 401),
            (
                "session_unknown_field",
                {"operation": "delete", "id": "missing", "owner": "other"},
                True,
                400,
            ),
            ("session_missing", {"operation": "delete", "id": "missing"}, True, 404),
            ("session_body_limit", b"x" * 4097, True, 413),
        ]:
            status, _ = call("/v1/sessions", body, auth)
            assert status == expected, name
            record["passed"].append(name)
        created_session = True
        status, response = call(
            "/v1/chat/completions",
            {
                "model": "chat-tiny-q8",
                "messages": [{"role": "user", "content": "Reply with hello."}],
                "max_tokens": 32,
                "temperature": 0,
            },
            headers={"X-Sanctum-Conversation": session},
            timeout=180,
        )
        assert status == 200 and response["choices"][0]["message"]["content"], "real_chat"
        status, saved = call("/v1/conversations/" + session)
        assert status == 200 and saved["data"], "real_history"
        record["passed"].append("real_chat_saved")
        title = "Audit " + session + " <img src=x>"
        status, _ = call("/v1/sessions", {"operation": "rename", "id": session, "title": title})
        assert status == 200, "rename"
        status, found = call("/v1/sessions", {"operation": "list", "query": session, "offset": 0})
        assert status == 200 and len(found["data"]) == 1, "search"
        assert found["data"][0]["title"] == title, "title preserved as data"
        record["passed"].extend(["rename", "search", "title_preserved_as_data"])
        status, _ = call("/v1/sessions", {"operation": "delete", "id": session})
        assert status == 200, "delete"
        status, saved = call("/v1/conversations/" + session)
        assert status == 200 and saved["data"] == [], "legacy_turns_deleted"
        created_session = False
        record["passed"].append("legacy_turns_deleted")
        created_profile = True
        for name in ["Audit profile", "Audit profile revised"]:
            status, _ = call(
                "/v1/profiles",
                {
                    "id": profile,
                    "name": name,
                    "system_prompt": "Only this test's local profile.",
                    "scope": "global",
                },
            )
            assert status == 200, "profile_save"
            status, profiles = call("/v1/profiles")
            assert status == 200 and any(
                p["id"] == profile and p["name"] == name for p in profiles["data"]
            ), "profile_roundtrip"
        status, _ = call("/v1/profiles", {"operation": "delete", "id": profile})
        assert status == 200, "profile_delete"
        status, profiles = call("/v1/profiles")
        assert status == 200 and all(p["id"] != profile for p in profiles["data"]), (
            "profile_deleted"
        )
        created_profile = False
        record["passed"].append("profile_create_read_update_delete")
        record["status"] = "PASS"
    except BaseException as error:
        record["status"] = "FAIL"
        record["error_type"] = type(error).__name__
        raise
    finally:
        try:
            if created_session:
                call("/v1/sessions", {"operation": "delete", "id": session})
            if created_profile:
                call("/v1/profiles", {"operation": "delete", "id": profile})
        finally:
            args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record))


if __name__ == "__main__":
    main()
