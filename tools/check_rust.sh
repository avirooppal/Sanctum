#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo fmt --all -- --check
cargo clippy --locked --offline --workspace --all-targets -- -D warnings
cargo test --locked --offline --workspace
cargo metadata --locked --offline --format-version 1 > target/cargo-metadata.json
python3 tools/rust_license_scan.py target/cargo-metadata.json
python3 tools/verify_containment.py target/debug/sanctum-foundation
python3 tools/verify_runtime.py target/debug/sanctum-runtime
python3 tools/verify_supervision.py target/debug/sanctum-runtime
