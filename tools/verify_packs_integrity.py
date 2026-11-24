"""
Phase 5.3: Build-time & runtime integrity verifier for Speech, OCR, and optional packs.
Fails the build (exit 1) if any declared sidecar script or pack manifest is missing or corrupt.
"""
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DECLARED_PACK_FILES = [
    ("speech", "core/ai/speech/stt_download.py"),
    ("speech", "core/ai/speech/whisperx_server.py"),
    ("ocr", "core/ai/ocr/ocr_engine.py"),
    ("ocr", "core/ai/ocr/ocr_server.py"),
    ("ocr", "core/ai/ocr/requirements.txt"),
    ("browser-agent", "packs/browser-agent/pack.json"),
    ("browser-agent", "packs/browser-agent/sidecar.py"),
]


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_packs(root_dir: str = ROOT) -> tuple[bool, list[dict]]:
    report = []
    all_ok = True
    for pack, rel in DECLARED_PACK_FILES:
        full = os.path.join(root_dir, rel)
        if not os.path.isfile(full):
            report.append({"pack": pack, "path": rel, "status": "missing"})
            all_ok = False
            continue
        size = os.path.getsize(full)
        if size == 0:
            report.append({"pack": pack, "path": rel, "status": "corrupt", "reason": "empty file"})
            all_ok = False
            continue
        if rel.endswith(".json"):
            try:
                with open(full, "r", encoding="utf-8") as jf:
                    json.load(jf)
            except Exception as exc:
                report.append({"pack": pack, "path": rel, "status": "corrupt", "reason": str(exc)})
                all_ok = False
                continue
        report.append({
            "pack": pack,
            "path": rel,
            "status": "installed",
            "bytes": size,
            "sha256": sha256_file(full),
        })
    return all_ok, report


if __name__ == "__main__":
    target_root = sys.argv[1] if len(sys.argv) > 1 else ROOT
    ok, rep = verify_packs(target_root)
    print(json.dumps({"ok": ok, "packs": rep}, indent=2))
    sys.exit(0 if ok else 1)
