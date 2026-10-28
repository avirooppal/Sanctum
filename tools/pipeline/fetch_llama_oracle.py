"""Fetch the pinned llama.cpp server used as the engine ground-truth oracle (dev only).

The oracle exposes /tokenize, /detokenize, /apply-template, /props, /slots and
/metrics, which Ollama (the engine the product currently drives) does not.
It is never shipped in the installer. Pin and hash are fixed here; a hash
mismatch deletes the download and exits non-zero.

Usage: python tools/pipeline/fetch_llama_oracle.py
"""
import hashlib
import pathlib
import sys
import urllib.request
import zipfile

TAG = "b11913"
ASSET = f"llama-{TAG}-bin-win-cpu-x64.zip"
URL = f"https://github.com/ggml-org/llama.cpp/releases/download/{TAG}/{ASSET}"
SHA256 = "55b31ccaf398e90457cfe28087297f5f3fdf1e3bfa7a28e1108f13d0af8e4621"
ROOT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "engines" / f"llama-{TAG}"


def sha256(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main() -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    z = ROOT / ASSET
    if not z.exists():
        print(f"downloading {URL}")
        urllib.request.urlretrieve(URL, z)
    got = sha256(z)
    if got != SHA256:
        z.unlink()
        print(f"SHA256 MISMATCH expected={SHA256} got={got}; deleted")
        return 1
    with zipfile.ZipFile(z) as zf:
        zf.extractall(ROOT)
    exe = next(ROOT.rglob("llama-server.exe"))
    print(f"ok tag={TAG} zip_sha256={got} server={exe} server_sha256={sha256(exe)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
