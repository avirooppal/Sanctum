# Sanctum

A private local AI platform under construction. Architecture and phase gates: [plan.md](plan.md).
Current slice: offline hardware diagnostics and contracts, **not a working chat platform**.

## Five-minute source quickstart

Install Python 3.10+ and uv, then from this checkout:

```sh
uv sync --locked
uv run --offline sanctum doctor
uv run --offline sanctum doctor --json
uv run --offline sanctum doctor --mode team
```

The initial sync downloads development/build tools; it is an explicit developer setup
step. Doctor has no runtime dependencies, telemetry, downloads or cloud calls.
Privacy enforcement is reported unverified and product startup blocked.

```sh
uv run --offline python tools/check.py
```

On Linux, separately exercise the real network-denial startup test:

```sh
python3 tools/isolated_run.py -- python3 -c "print('isolated command started')"
```

This requires user/network namespace support and is not an untrusted-code sandbox.
See [status](docs/STATUS.md), [architecture](docs/architecture.md),
[profiles](docs/profiles.md), [threat model](docs/threat-model.md), and
[generated API contracts](docs/api.md). Later phases remain gated.
