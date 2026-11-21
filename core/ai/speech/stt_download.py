"""
Sanctum STT Model Downloader
Downloads speech-to-text model weights from HuggingFace Hub into the local Sanctum STT cache
and emits NDJSON progress events to stdout.
"""

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

STT_REPOS = {
    "qwen3-asr-0.6b": "Qwen/Qwen3-ASR-0.6B",
    "nemotron-3.5-transcribe": "nvidia/nemotron-3.5-asr-streaming-0.6b",
    "whisper-base": "Systran/faster-whisper-base",
    "whisper-small": "Systran/faster-whisper-small",
}


def emit(status: str, completed: int = 0, total: int = 0, error: str | None = None):
    payload: dict = {"status": status}
    if total > 0:
        payload["completed"] = completed
        payload["total"] = total
    if error:
        payload["error"] = error
    print(json.dumps(payload), flush=True)


def list_hf_files(repo_id: str) -> list[dict]:
    url = f"https://huggingface.co/api/models/{repo_id}/tree/main?recursive=1"
    req = urllib.request.Request(url, headers={"User-Agent": "Sanctum-STT-Downloader/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        items = json.loads(resp.read().decode("utf-8"))
    return [i for i in items if i.get("type") == "file"]


def download_via_http(repo_id: str, dest_dir: Path):
    emit(f"Fetching file manifest for {repo_id}...")
    files = list_hf_files(repo_id)
    if not files:
        raise RuntimeError(f"No downloadable files found in {repo_id}")

    total_bytes = sum(int(f.get("size") or 0) for f in files) or len(files) * 1024
    downloaded_bytes = 0

    for item in files:
        rel_path = item["path"]
        file_size = int(item.get("size") or 0)
        target_path = dest_dir / rel_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if target_path.exists() and file_size > 0 and target_path.stat().st_size == file_size:
            downloaded_bytes += file_size
            emit(f"Verified {rel_path}", downloaded_bytes, total_bytes)
            continue

        file_url = f"https://huggingface.co/{repo_id}/resolve/main/{rel_path}"
        req = urllib.request.Request(file_url, headers={"User-Agent": "Sanctum-STT-Downloader/1.0"})
        emit(f"Downloading {rel_path}...", downloaded_bytes, total_bytes)

        tmp_path = target_path.with_suffix(target_path.suffix + ".part")
        with urllib.request.urlopen(req, timeout=120) as resp, open(tmp_path, "wb") as out:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                out.write(chunk)
                downloaded_bytes += len(chunk)
                emit(f"Downloading {rel_path}...", min(downloaded_bytes, total_bytes), total_bytes)

        os.replace(tmp_path, target_path)

    return total_bytes


def main():
    parser = argparse.ArgumentParser(description="Download Sanctum STT model weights")
    parser.add_argument("--model", "--model-id", dest="model", required=True, help="Model ID (e.g. qwen3-asr-0.6b, nemotron-3.5-transcribe)")
    parser.add_argument("--dest", "--target-dir", dest="dest", required=True, help="Destination directory for model files")
    args = parser.parse_args()

    model_id = args.model.strip()
    repo_id = STT_REPOS.get(model_id)
    if not repo_id:
        emit("error", error=f"Unknown STT model: {model_id}")
        sys.exit(1)

    dest_dir = Path(args.dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    try:
        emit(f"Preparing download for {model_id} ({repo_id})...")
        total_bytes = download_via_http(repo_id, dest_dir)
        marker = dest_dir / ".sanctum_stt_ready.json"
        marker.write_text(
            json.dumps(
                {
                    "id": model_id,
                    "repo": repo_id,
                    "bytes": total_bytes,
                    "ready": True,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        emit("success", total_bytes, total_bytes)
    except Exception as exc:
        emit("error", error=str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
