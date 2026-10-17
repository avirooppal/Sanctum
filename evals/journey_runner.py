"""Real local gateway readiness by journey; explicitly not full acceptance."""

import argparse
import importlib.util
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Readiness redirects are forbidden")


class Context:
    def __init__(self, base: str, token: str, entries: list[dict]):
        self.base, self.token = base, token
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.entries = {entry["id"]: entry for entry in entries}
        self.requests = []
        data = self.get("/v1/capabilities")
        capabilities = data.get("capabilities")
        if not isinstance(capabilities, list) or not all(isinstance(c, str) for c in capabilities):
            raise ValueError("Invalid capability response")
        self.capabilities = set(capabilities)

    def get(self, path: str) -> dict:
        request = urllib.request.Request(
            self.base + path, headers={"Authorization": f"Bearer {self.token}"}
        )
        start = time.perf_counter()
        with self.opener.open(request, timeout=10) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise ValueError("Readiness JSON response exceeds1MiB")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Invalid readiness JSON response")
        self.requests.append({"path": path, "seconds": time.perf_counter() - start})
        return data

    def assert_blocked(self, identifier: str) -> None:
        denied = self.entries[identifier]["blocked_capabilities"]
        if any(capability in self.capabilities for capability in denied):
            raise ValueError(f"Unavailable capability advertised for {identifier}")

    def health(self) -> None:
        data = self.get("/healthz")
        if data.get("status") != "ok" or data.get("cloud_connectors") != "disabled":
            raise ValueError("Local-only health state not established")
        checks = data.get("checks")
        if not isinstance(checks, dict) or not checks or set(checks.values()) != {"denied"}:
            raise ValueError("Startup denial evidence is missing")

    def require_list(self, path: str, key: str) -> None:
        if not isinstance(self.get(path).get(key), list):
            raise ValueError("Expected owner-filtered metadata list")

    def models(self) -> None:
        data = self.get("/v1/models").get("data")
        if not isinstance(data, list) or not data:
            raise ValueError("No real local models available")
        if not all(model.get("owned_by") == "local" for model in data):
            raise ValueError("Unexpected cloud model in local-only readiness")

    def require_unauthorized(self) -> None:
        try:
            self.opener.open(self.base + "/v1/models", timeout=10).close()
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
            if status == 401:
                return
        raise ValueError("Owner authentication boundary failed")


def run(base: str, token: str) -> dict:
    data = json.loads((ROOT / "evals/journeys/manifest.json").read_text(encoding="utf-8"))
    spec = importlib.util.spec_from_file_location(
        "journey_readiness", ROOT / "evals/journeys/test_journeys.py"
    )
    if spec is None or spec.loader is None:
        raise ValueError("Missing registered journey tests")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tests = {
        function.journey_id: function
        for function in vars(module).values()
        if hasattr(function, "journey_id")
    }
    context = Context(base, token, data["journeys"])
    rows = []
    for entry in data["journeys"]:
        start = time.perf_counter()
        try:
            tests[entry["id"]](context)
            result, error = "PASS", None
        except (ValueError, OSError, urllib.error.URLError):
            result, error = (
                "FAIL",
                "Readiness prerequisite failed; no full journey acceptance claimed.",
            )
        rows.append(
            {
                "id": entry["id"],
                "test_id": entry["test_id"],
                "readiness": result,
                "journey_status": entry["status"],
                "acceptance_verified": False,
                "elapsed_seconds": time.perf_counter() - start,
                "error": error,
                "clicks": None,
                "navigation_keys": None,
                "text_entries": None,
                "budget_verified": False,
                "ledger_verified": False,
                "blocker": entry["blocker"],
            }
        )
    return {
        "suite": "owner-journeys-v1",
        "scope": "readiness_only",
        "version": data["version"],
        "journeys_verified": 0,
        "release_complete": False,
        "journeys": rows,
        "requests": context.requests,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8769")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--require-verified", action="store_true")
    args = parser.parse_args()
    url = urllib.parse.urlsplit(args.base_url)
    if (
        url.scheme != "http"
        or url.hostname != "127.0.0.1"
        or url.username
        or url.password
        or url.path
        or url.query
        or url.fragment
    ):
        parser.error("Readiness requires an explicit loopback origin without credentials")
    report = run(args.base_url, args.token_file.read_text(encoding="utf-8").strip())
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    failed = any(row["readiness"] != "PASS" for row in report["journeys"])
    return 1 if failed or args.require_verified else 0


if __name__ == "__main__":
    raise SystemExit(main())
