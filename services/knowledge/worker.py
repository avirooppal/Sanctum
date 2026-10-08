"""Private JSONL worker; launched only through the confined Rust supervisor."""

import base64
import json
import os
import signal
import sys
from pathlib import Path
from sanctum_knowledge.store import Catalog
from sanctum_knowledge.parsing import StructuralParser
from sanctum_knowledge.vectors import SqliteVectors
from sanctum_knowledge.local_models import LocalModels
from sanctum_knowledge.retrieval import Knowledge


def main():
    # The Rust --engine-child entry repeats kernel probes before this interpreter.
    # Independently reject direct host startup, without making any network probe.
    if sys.platform != "linux" or [
        line.split(":")[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()
        if ":" in line
    ] != ["lo"]:
        raise RuntimeError("private network namespace required")
    status = Path("/proc/self/status").read_text()
    if "Seccomp:\t2" not in status or "NoNewPrivs:\t1" not in status:
        raise RuntimeError("inherited runtime filter required")
    config = json.loads(Path(sys.argv[1]).read_text())
    state = Path(sys.argv[2]) / "knowledge"
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.umask(0o077)
    catalog = Catalog(state / "catalog.sqlite3")
    vectors = SqliteVectors(state / "vectors.sqlite3")
    models = LocalModels(config)
    knowledge = Knowledge(catalog, StructuralParser(), models, vectors, models)
    print(json.dumps({"ready": True}), flush=True)
    while True:
        line = sys.stdin.buffer.readline(16 * 1024 * 1024 + 1)
        if not line:
            break
        if len(line) > 16 * 1024 * 1024:
            raise ValueError("request too large")
        try:
            signal.alarm(120)
            request = json.loads(line)
            user = request["user"]
            operation = request["operation"]
            payload = request["payload"]
            workspace = request.get("workspace")
            if operation == "create":
                result = {"id": catalog.workspace(user, payload["name"])}
            elif operation == "list":
                result = {"data": catalog.workspaces(user)}
            elif operation == "ingest":
                result = knowledge.ingest(
                    user,
                    workspace,
                    payload["name"],
                    base64.b64decode(payload["content_base64"], validate=True),
                    payload.get("readers", []),
                    payload.get("data_class", "internal"),
                )
            elif operation in {"search", "ask"}:
                hits = knowledge.search(
                    user,
                    workspace,
                    payload["query"],
                    payload.get("k", 5),
                    payload.get("mode", "hybrid"),
                )
                result = (
                    {"hits": hits}
                    if operation == "search"
                    else models.answer(payload["query"], hits)
                )
            else:
                raise ValueError("unknown operation")
            response = {"ok": True, "result": result}
        except PermissionError:
            response = {"ok": False, "error": "access denied", "status": 403}
        except Exception:
            response = {"ok": False, "error": "knowledge operation failed", "status": 400}
        finally:
            signal.alarm(0)
        print(json.dumps(response), flush=True)
    vectors.close()
    catalog.close()


if __name__ == "__main__":
    main()
