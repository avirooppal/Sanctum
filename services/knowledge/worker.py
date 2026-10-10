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


def operation_deadline(_signum, _frame):
    raise TimeoutError("knowledge operation deadline exceeded")


def answer_or_judge(models, payload, hits):
    if "judge_answer" not in payload:
        return models.answer(payload["query"], hits)
    candidate = payload["judge_answer"]
    if not isinstance(candidate, str) or len(candidate) > 12000:
        raise ValueError("invalid judge answer")
    return models.judge(payload["query"], hits, candidate)


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
    signal.signal(signal.SIGALRM, operation_deadline)
    while True:
        line = sys.stdin.buffer.readline(16 * 1024 * 1024 + 1)
        if not line:
            break
        if len(line) > 16 * 1024 * 1024:
            raise ValueError("request too large")
        try:
            signal.alarm(300)
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
            elif operation == "meeting":
                # Product orchestration shares the existing worker's ACL/inference boundary.
                speech_path = str(Path(__file__).resolve().parents[1] / "speech")
                if speech_path not in sys.path:
                    sys.path.insert(0, speech_path)
                from sanctum_speech.hosted_meeting import capture_meeting

                result = capture_meeting(knowledge, models, user, workspace, payload)
            elif operation in {"search", "ask"}:
                hits = knowledge.search(
                    user,
                    workspace,
                    payload["query"],
                    payload.get("k", 5),
                    payload.get("mode", "hybrid"),
                )
                if operation == "search":
                    result = {"hits": hits}
                else:
                    result = answer_or_judge(models, payload, hits)
            else:
                raise ValueError("unknown operation")
            response = {"ok": True, "result": result}
        except PermissionError:
            response = {"ok": False, "error": "access denied", "status": 403}
        except TimeoutError:
            response = {"ok": False, "error": "operation deadline exceeded", "status": 503}
        except Exception:
            response = {"ok": False, "error": "knowledge operation failed", "status": 400}
        finally:
            signal.alarm(0)
        print(json.dumps(response), flush=True)
    vectors.close()
    catalog.close()


if __name__ == "__main__":
    main()
