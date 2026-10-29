"""Exercise the built Windows host against real Ollama, without changing user profiles.

python tools/exe-verify/verify_core_flows.py --model qwen3:1.7b
Use --pull-model NAME to additionally download/verify a real model.
This fails rather than substituting a mock if Ollama is unavailable.
"""
import argparse
import json
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", type=Path, default=Path("deploy/installer/build_payload/Sanctum-Desktop.exe"))
    parser.add_argument("--model", required=True)
    parser.add_argument("--pull-model")
    args = parser.parse_args()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    token = secrets.token_hex(16)
    base = f"http://127.0.0.1:{port}"

    def call(path, body=None, authenticated=True):
        headers = {"Content-Type": "application/json"}
        if authenticated:
            headers["X-Sanctum-Auth"] = token
        data = json.dumps(body).encode() if body is not None else None
        return urllib.request.urlopen(urllib.request.Request(base + path, data=data, headers=headers), timeout=180)

    with tempfile.TemporaryDirectory(prefix="sanctum-core-test-") as profile:
        process = subprocess.Popen([str(args.exe.resolve()), "--headless", "--port", str(port), "--auth-token", token, "--data-dir", profile], creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            for _ in range(60):
                try:
                    with call("/health") as response:
                        assert json.load(response)["status"] == "ok"
                    break
                except urllib.error.URLError:
                    if process.poll() is not None:
                        raise RuntimeError(f"Host exited: {process.returncode}")
                    time.sleep(0.1)
            else:
                raise RuntimeError("Desktop host did not become ready")
            try:
                call("/api/threads", authenticated=False)
                raise AssertionError("API accepted a request without authentication")
            except urllib.error.HTTPError as error:
                assert error.code == 401
            with call("/api/workspace") as response:
                workspace = json.load(response)
            def tool(action, path, **kwargs):
                with call("/api/tools/execute", {"name": "workspace_files", "workspaceId": workspace["id"], "arguments": {"action": action, "path": path, **kwargs}}) as response:
                    return json.load(response)
            tool("mkdir", "project")
            tool("create", "project/hello.txt", content="Hello world 🌍")
            assert tool("read", "project/hello.txt")["content"] == "Hello world 🌍"
            tool("edit", "project/hello.txt", old_text="world", new_text="Sanctum")
            assert tool("read", "project/hello.txt")["content"] == "Hello Sanctum 🌍"
            tool("move", "project/hello.txt", destination="project/renamed.txt")
            assert tool("list", "project")["entries"][0]["name"] == "renamed.txt"
            trash = tool("delete", "project/renamed.txt")["recoverableAt"]
            assert Path(trash).read_text(encoding="utf-8") == "Hello Sanctum 🌍"
            assert tool("list", "project")["entries"] == []
            tool("create", "keep.txt", content="preserve")
            for action, path, kwargs in [
                ("read", "../threads.json", {}), ("create", "C:/escape.txt", {"content": "bad"}),
                ("delete", ".", {}), ("create", "keep.txt", {"content": "overwrite"}),
                ("read", "keep.txt:stream", {}), ("create", "CON.txt", {"content": "bad"}),
                ("edit", "keep.txt", {"old_text": "absent", "new_text": "bad"}),
            ]:
                try:
                    tool(action, path, **kwargs)
                    raise AssertionError(f"Unsafe operation accepted: {action} {path}")
                except urllib.error.HTTPError as error:
                    assert error.code == 400
            assert tool("read", "keep.txt")["content"] == "preserve"
            print("PASS native workspace: create/read/edit/move/list/trash, UTF-8, containment and overwrite protection", flush=True)
            with call("/api/ollama/models") as response:
                models = json.load(response)
            assert models["online"] and any(model["name"] == args.model for model in models["models"])
            print(f"PASS discovery: {len(models['models'])} real models", flush=True)
            with call("/api/chat", {"model": args.model, "messages": [{"role": "user", "content": "Reply with only the word READY."}], "think": False, "stream": True, "options": {"num_ctx": 2048, "num_predict": 32}}) as response:
                records = [json.loads(line) for line in response if line.strip()]
            answer = "".join(record.get("message", {}).get("content", "") for record in records)
            assert "READY" in answer.upper() and records[-1]["done"], records
            assert records[-1].get("eval_count", 0) > 0
            print(f"PASS inference: {len(records)} real stream records, answer={answer!r}", flush=True)
            try:
                call("/api/chat", {"model": "sanctum-test-model-does-not-exist", "messages": [{"role": "user", "content": "Hello"}]})
                raise AssertionError("Missing model returned success")
            except urllib.error.HTTPError as error:
                assert error.code == 404
            with call("/api/threads", [{"id": "preservation-check", "messages": []}]) as response:
                assert response.status == 200
            with call("/api/threads") as response:
                assert json.load(response)[0]["id"] == "preservation-check"
            print("PASS authentication, missing-model error, and thread persistence", flush=True)
            if args.pull_model:
                with call("/api/ollama/pull", {"model": args.pull_model, "stream": True}) as response:
                    progress = [json.loads(line) for line in response if line.strip()]
                assert progress[-1].get("status") == "success", progress[-1]
                print(f"PASS real model installation: {len(progress)} progress events", flush=True)
        finally:
            process.terminate()
            process.wait(timeout=15)


if __name__ == "__main__":
    main()
