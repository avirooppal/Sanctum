"""Assemble an unsigned development bundle from verified artifacts, not a release."""

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build_bundle(root: Path, bundle: Path):
    root, bundle = root.resolve(), bundle.resolve()
    sources = ["profiles", "apps/web/dist", ".sanctum/artifacts", ".sanctum/engines"]
    if any(bundle.is_relative_to(root / relative) for relative in sources):
        raise ValueError("bundle cannot be inside a copied source directory")
    if bundle.exists():
        raise ValueError("bundle already exists; choose a fresh output before rebuilding")
    (bundle / "bin").mkdir(parents=True)
    shutil.copy2(root / "target/debug/sanctum-runtime", bundle / "bin/sanctum-runtime")
    for relative in sources:
        shutil.copytree(root / relative, bundle / relative, symlinks=False)
    shutil.copy2(root / "LICENSE", bundle / "LICENSE")
    print(bundle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/reference")
    args = parser.parse_args()
    build_bundle(ROOT, args.output)


if __name__ == "__main__":
    main()
