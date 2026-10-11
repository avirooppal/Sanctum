#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec "${SANCTUM_PYTHON:-python3}" tools/smoke_all.py
