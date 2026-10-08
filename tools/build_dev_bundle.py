"""Assemble an unsigned development bundle from verified artifacts, not a release."""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    bundle = ROOT / "dist/reference"
    if bundle.exists():
        raise ValueError("bundle already exists; choose a fresh output before rebuilding")
    (bundle / "bin").mkdir(parents=True)
    shutil.copy2(ROOT / "target/debug/sanctum-runtime", bundle / "bin/sanctum-runtime")
    for relative in ["profiles", "apps/web/dist", ".sanctum/artifacts", ".sanctum/engines"]:
        shutil.copytree(ROOT / relative, bundle / relative, symlinks=False)
    shutil.copy2(ROOT / "LICENSE", bundle / "LICENSE")
    print(bundle)


if __name__ == "__main__":
    main()
