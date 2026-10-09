"""Exercise folder change detection through authenticated local upload and search."""

import argparse
import json
import tempfile
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.knowledge.watch import sync_once  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = args.token_file.read_text(encoding="utf-8").strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def call(path, body=None):
        request = urllib.request.Request(
            args.base_url + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with opener.open(request, timeout=180) as response:
            return json.load(response)

    workspace = call("/v1/workspaces", {"name": "Folder watcher smoke"})["id"]
    with tempfile.TemporaryDirectory(prefix="sanctum-watch-") as directory:
        root = Path(directory) / "source"
        root.mkdir()
        state = Path(directory) / "state.json"
        document = root / "guide.md"
        document.write_text("# Local guide\nThe first private fact is 314.\n", encoding="utf-8")
        config = {
            "root": str(root),
            "workspace_id": workspace,
            "token_file": str(args.token_file),
            "state_file": str(state),
            "gateway": args.base_url,
        }
        first = sync_once(config)
        unchanged = sync_once(config)
        document.write_text("# Local guide\nThe updated private fact is 2718.\n", encoding="utf-8")
        changed = sync_once(config)
        hits = call(
            f"/v1/workspaces/{workspace}/search",
            {"query": "What is the updated private fact?", "mode": "hybrid", "k": 5},
        )["hits"]
        assert first == ["guide.md"] and not unchanged and changed == ["guide.md"]
        assert hits and "2718" in hits[0]["text"]
    result = {
        "suite": "folder-watch-smoke",
        "passed": ["initial_upload", "unchanged_skip", "changed_upload", "retrievable_update"],
        "workspace_id": workspace,
    }
    output = Path("evals/results/folder-watch-smoke.json")
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
