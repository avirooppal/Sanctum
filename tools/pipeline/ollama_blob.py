"""Resolve an Ollama model name to its GGUF blob path and SHA-256 digest (from the manifest).

Usage: python tools/pipeline/ollama_blob.py qwen3:1.7b [--verify]
Prints JSON: {model, manifest, digest, blob, size, verified_sha256?}
"""
import hashlib
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(os.environ.get("OLLAMA_MODELS", pathlib.Path.home() / ".ollama" / "models"))


def resolve(name: str) -> dict:
    base, _, tag = name.partition(":")
    tag = tag or "latest"
    ns, _, model = base.rpartition("/")
    ns = ns or "library"
    manifest = ROOT / "manifests" / "registry.ollama.ai" / ns / model / tag
    m = json.loads(manifest.read_text(encoding="utf-8"))
    layer = next(l for l in m["layers"] if l["mediaType"] == "application/vnd.ollama.image.model")
    digest = layer["digest"]
    blob = ROOT / "blobs" / digest.replace(":", "-")
    return {"model": name, "manifest": str(manifest), "digest": digest, "blob": str(blob), "size": layer["size"]}


def sha256(p: str) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return "sha256:" + h.hexdigest()


if __name__ == "__main__":
    r = resolve(sys.argv[1])
    if "--verify" in sys.argv:
        r["verified_sha256"] = sha256(r["blob"])
        r["match"] = r["verified_sha256"] == r["digest"]
    print(json.dumps(r, indent=2))
