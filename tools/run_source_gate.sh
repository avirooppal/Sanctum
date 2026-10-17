#!/usr/bin/env bash
set -euo pipefail

# tools/run_source_gate.sh
# Deterministic local source gate runner in WSL.
# Enforces clean environment: unsets inherited host PYTHONPATH and PYTHONUSERBASE,
# runs with the verified Linux dev venv, tees output to a log, and prints a summary.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_FILE="${1:-evals/results/source-gate-latest.log}"
mkdir -p "$(dirname "$LOG_FILE")"

# Clean environment
unset PYTHONPATH || true
unset PYTHONUSERBASE || true

VENV_PYTHON="/home/aviroop/.local/share/sanctum-dev-venv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
    echo "ERROR: Dev venv not found at $VENV_PYTHON" >&2
    exit 1
fi

# Keep ty's environment discovery on the same verified interpreter; the checkout
# may contain an unrelated Windows or incomplete .venv.
export VIRTUAL_ENV="${VENV_PYTHON%/bin/python}"

echo "=== Sanctum Source Gate ==="
echo "Working directory: $ROOT"
echo "Python interpreter: $VENV_PYTHON"
echo "Logging output to: $LOG_FILE"
echo ""

set +e
"$VENV_PYTHON" tools/check.py 2>&1 | tee "$LOG_FILE"
EXIT_CODE="${PIPESTATUS[0]}"
set -e

echo ""
echo "=== Summary ==="
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "STATUS: PASS (exit code 0)"
else
    echo "STATUS: FAIL (exit code $EXIT_CODE)"
fi
exit "$EXIT_CODE"
