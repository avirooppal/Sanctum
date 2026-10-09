"""Loopback-only, opt-in folder watcher for Markdown and text PDFs."""

import argparse
import base64
import hashlib
import json
import os
import re
import stat
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


EXTENSIONS = {".md", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("gateway redirects are prohibited")


def scan_files(root: Path):
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("watch root must be a directory")
    output = []
    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name
            for name in directories
            if not name.startswith(".") and not (current_path / name).is_symlink()
        ]
        for filename in filenames:
            path = current_path / filename
            if (
                filename.startswith(".")
                or path.suffix.lower() not in EXTENSIONS
                or path.is_symlink()
            ):
                continue
            try:
                before = path.stat(follow_symlinks=False)
                if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_FILE_SIZE:
                    continue
                resolved = path.resolve(strict=True)
                resolved.relative_to(root)
                content = path.read_bytes()
                after = path.stat(follow_symlinks=False)
            except (OSError, ValueError):
                continue
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                continue
            relative = path.relative_to(root).as_posix()
            if len(relative) > 255:
                continue
            output.append(
                {
                    "relative_path": relative,
                    "content": content,
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
    return sorted(output, key=lambda item: item["relative_path"])


def changed_files(files, previous):
    updated = dict(previous)
    changed = []
    for item in files:
        relative = item["relative_path"]
        if previous.get(relative) != item["sha256"]:
            changed.append(item)
            updated[relative] = item["sha256"]
    return changed, updated


def _save_state(path: Path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".watch-state-", dir=path.parent)
    try:
        os.chmod(temporary, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def sync_once(config):
    root = Path(config["root"])
    token = Path(config["token_file"]).read_text(encoding="utf-8").strip()
    workspace = config["workspace_id"]
    if not re.fullmatch(r"[0-9a-f]{32}", workspace):
        raise ValueError("invalid workspace identifier")
    state_path = Path(config["state_file"])
    previous = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    files = scan_files(root)
    changed, updated = changed_files(files, previous)
    endpoint = config.get("gateway", "http://127.0.0.1:8765").rstrip("/")
    parsed = urllib.parse.urlsplit(endpoint)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.port != 8765
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("folder watcher requires a loopback HTTP gateway")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    for item in changed:
        body = {
            "name": item["relative_path"],
            "content_base64": base64.b64encode(item["content"]).decode("ascii"),
            "readers": [],
            "data_class": config.get("data_class", "internal"),
        }
        request = urllib.request.Request(
            f"{endpoint}/v1/workspaces/{workspace}/documents",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with opener.open(request, timeout=180) as response:
            response.read(1024)
    if changed:
        _save_state(state_path, updated)
    return [item["relative_path"] for item in changed]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    interval = int(config.get("interval_seconds", 30))
    if not 5 <= interval <= 3600:
        raise ValueError("interval_seconds must be between 5 and 3600")
    while True:
        for path in sync_once(config):
            print(f"ingested {path}", flush=True)
        if args.once:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
