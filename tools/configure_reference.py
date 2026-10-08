"""Create a runtime config from already-verified local reference artifacts (Linux)."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    artifacts = json.loads((ROOT / "profiles/artifacts.json").read_text())["artifacts"]
    models = {
        a["id"]: {"path": f".sanctum/artifacts/{a['filename']}", "sha256": a["sha256"]}
        for a in artifacts
        if a["kind"] == "model"
    }
    registry = json.loads((ROOT / "profiles/registry.json").read_text())["models"]
    chat_id = next(m["id"] for m in registry if "text" in m["capabilities"])
    embed_id = next(m["id"] for m in registry if "embedding" in m["capabilities"])
    binary = next((ROOT / ".sanctum/engines").rglob("llama-server"))
    engine = binary.parent
    files = [
        {
            "path": p.relative_to(ROOT).as_posix(),
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        }
        for p in sorted(engine.iterdir())
        if p.is_file()
    ]
    config = {
        "engine": binary.relative_to(ROOT).as_posix(),
        "engine_files": files,
        "chat": {"id": chat_id, "artifact": models[chat_id], "port": 18081},
        "embedding": {"id": embed_id, "artifact": models[embed_id], "port": 18082},
        "threads": 4,
        "context": 2048,
        "state_dir": "~/.local/share/sanctum",
        "ui_dir": "apps/web/dist",
    }
    (ROOT / "profiles/runtime-cpu.json").write_text(json.dumps(config, indent=2) + "\n")


if __name__ == "__main__":
    main()
