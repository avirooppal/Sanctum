"""Fresh-rootfs, offline bundle install-to-answer measurement; fails at 300s."""

import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path


def main():
    start = time.perf_counter()
    root = Path(tempfile.mkdtemp(prefix="sanctum-install-"))
    destination = root / "app"
    shutil.copytree("/bundle", destination, symlinks=True)
    home = root / "home"
    home.mkdir()
    environment = dict(os.environ, HOME=str(home))
    process = subprocess.Popen(
        [
            str(destination / "bin/sanctum-runtime"),
            "--config",
            "profiles/runtime-cpu.json",
            "--port",
            "0",
        ],
        cwd=destination,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        line = process.stdout.readline()
        if not line:
            raise RuntimeError(process.stderr.read())
        startup = json.loads(line)
        token = Path(startup["token_file"]).read_text()
        config = json.loads((destination / "profiles/runtime-cpu.json").read_text())
        payload = {
            "model": config["chat"]["id"],
            "messages": [{"role": "user", "content": "Say hello."}],
            "max_tokens": 32,
            "temperature": 0,
        }
        request = urllib.request.Request(
            f"http://{startup['address']}/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            answer = json.load(response)["choices"][0]["message"]["content"]
        elapsed = time.perf_counter() - start
        assert answer
        record = {
            "environment": "fresh python:3.12-slim-bookworm container + OS libgomp1",
            "method": "offline development bundle copied into empty filesystem; new HOME, auth and SQLite",
            "install_to_answer_seconds": round(elapsed, 4),
            "threshold_seconds": 300,
            "passed": elapsed < 300,
            "answer": answer,
        }
        print(json.dumps(record, indent=2))
        Path("/results/phase1-clean-install.json").write_text(json.dumps(record, indent=2) + "\n")
        assert elapsed < 300
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()
