# cli

Offline Python diagnostics. Contract: docs/contracts/diagnostics.openapi.json.
Run from root: `uv run --offline sanctum doctor`.
Config: `--profiles profiles/hardware.json`, `--mode solo|team`.
Tests: `uv run --offline python -m unittest discover -s apps/cli/tests -v`.
Exit 0: hardware recommendation; exit 2: unknown/unsupported/config error.
Neither exit code attests to production privacy readiness.
