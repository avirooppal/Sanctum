# cli

Offline Python diagnostics. Contract: docs/contracts/diagnostics.openapi.json.
Run from root: `uv run --offline sanctum doctor`.
Config: `--profiles profiles/hardware.json`, `--mode solo|team`.
Tests: `uv run --offline python -m unittest discover -s apps/cli/tests -v`.
Exit 0: hardware recommendation; exit 2: unknown/unsupported/config error.
Neither exit code attests to production privacy readiness.

Installation preflight contract: [install-check-v1](../../docs/contracts/install-check-v1.md).
Run `sanctum doctor --install-check --probe-binary /absolute/path/sanctum-foundation --port 8770 --json`.
Exit0 admits installation prerequisites only;78 blocks. Linux x86_64 glibc>=2.35,
unprivileged owner and all22 kernel denial checks are mandatory. No download,
install,start or model readiness is implied. Default staging reserve2GiB;
`--install-root` selects the disk to inspect. Port availability is momentary.
