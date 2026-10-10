# Hardware profiles

Run `uv run --offline sanctum doctor --json` from repository root after setup.
`--mode team` enables team rules. `--profiles PATH` selects an explicit config.
Doctor does not download or launch the recommended engine. Exit 0 means a hardware
recommendation exists, not that runtime privacy or model execution is ready.
Exit 2 means unsupported/unknown memory, no matching profile, or invalid config.

Rules live in profiles/hardware.json; descending priority selects the first match.
Memory is bytes converted to GiB, not vendor decimal GB. Dedicated NVIDIA memory
comes from nvidia-smi. Apple arm64 uses shared RAM. Other VRAM/NPU and some CPU
features are unverified. Model lists intentionally remain empty until verified.

Model registry: profiles/registry.json, validated by docs/contracts/registry.schema.json.
Only allowlisted permissive licenses, immutable revision, SHA-256 and verification
date are admissible for weights. Dependency licenses include development tooling.

Speech engine profiles are validated by `docs/contracts/speech-profile.schema.json`.
The whisper.cpp adapter requires explicit local executable/model paths and matching
SHA-256 values; it does not accept upstream model IDs. Register the exact model license,
source revision, and hash before making any speech model available as a profile default.
