"""Exercise real HTTP overload replies using the shared cross-process engine leases."""

import argparse
import base64
from contextlib import ExitStack
import json
from pathlib import Path
import sys
import time

import httpx2

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/knowledge"))
from sanctum_knowledge.engine_admission import acquire


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    state = Path(config["state_dir"]).expanduser()
    root = state / "engine-admission"
    results = {}
    with httpx2.Client(
        base_url="http://127.0.0.1:8769",
        headers={"Authorization": "Bearer " + (state / "local.token").read_text().strip()},
        timeout=60,
        trust_env=False,
    ) as client:

        def busy(name, call):
            start = time.monotonic()
            response = call()
            elapsed = time.monotonic() - start
            assert response.status_code == 503, (name, response.status_code, response.text)
            assert response.headers.get("retry-after") == "1"
            assert elapsed < 1, (name, elapsed)
            results[name] = {"status": 503, "retry_after": 1, "seconds": elapsed}

        try:
            for role, route, payload in [
                (
                    "chat",
                    "/v1/chat/completions",
                    {
                        "model": config["chat"]["id"],
                        "messages": [{"role": "user", "content": "Hello"}],
                        "max_tokens": 1,
                    },
                ),
                (
                    "embedding",
                    "/v1/embeddings",
                    {"model": config["embedding"]["id"], "input": "A local document."},
                ),
            ]:
                with ExitStack() as stack:
                    for _ in range(2):
                        stack.enter_context(acquire(root, f"port-{config[role]['port']}", 2, False))
                    busy(role, lambda: client.post(route, json=payload))
                client.post(route, json=payload).raise_for_status()
            workspace = client.post("/v1/workspaces", json={"name": "Engine admission"})
            workspace.raise_for_status()
            identifier = workspace.json()["id"]
            document = {
                "name": "admission.md",
                "content_base64": base64.b64encode(
                    b"# Admission\nThe local engine admission control uses bounded permits."
                ).decode(),
                "data_class": "restricted",
            }
            with acquire(root, f"port-{config['embedding']['port']}", 2, True):
                client.post(
                    "/v1/embeddings",
                    json={
                        "model": config["embedding"]["id"],
                        "input": "Reserved interactive capacity.",
                    },
                ).raise_for_status()
                busy(
                    "knowledge_embedding_background",
                    lambda: client.post(f"/v1/workspaces/{identifier}/documents", json=document),
                )
            client.post(f"/v1/workspaces/{identifier}/documents", json=document).raise_for_status()
            with acquire(root, f"port-{config['reranker']['port']}", 1, True):
                busy(
                    "knowledge_reranker",
                    lambda: client.post(
                        f"/v1/workspaces/{identifier}/search",
                        json={"query": "engine admission control", "k": 1},
                    ),
                )
            with acquire(root, "tts", 1, False):
                busy(
                    "tts",
                    lambda: client.post(
                        "/v1/audio/speech",
                        json={
                            "model": "tts-flite-slt-reference",
                            "voice": "tts-flite-slt-reference",
                            "input": "Hello.",
                        },
                    ),
                )
            with acquire(root, "asr", 1, False):
                busy(
                    "asr",
                    lambda: client.post(
                        "/v1/audio/transcriptions",
                        data={"model": "asr-parakeet-q4k-reference"},
                        files={
                            "file": (
                                "speech.wav",
                                Path(".sanctum/speech-smoke/jfk.wav").read_bytes(),
                                "audio/wav",
                            )
                        },
                    ),
                )
            results["scope"] = (
                "Real HTTP replies and shared permits; not sustained mixed-engine overload"
            )
            print(json.dumps(results, indent=2))
        finally:
            args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
