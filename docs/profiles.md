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

Implemented ASR discriminators: `whisper.cpp` and `parakeet.cpp`. Optional file VAD:
`silero.cpp` with independent executable/model pins. Profiles are opt-in; the hardware
recommendation has not been changed by small smoke tests. Reference evidence is in
`evals/results/speech-*-profile.json` and `speech-vad-smoke.json`. Legacy `silero`
profiles still validate for compatibility but cannot launch an unimplemented engine.
Parakeet emits coarse whole-clip timestamps and does not force language or support
vocabulary prompts. Retain the attribution in `docs/model-attributions.md`.

The Linux CPU reference ASR profile is `profiles/asr-parakeet-cpu-reference.json`:
six threads selected from measured candidates on this 12-logical-CPU host. It
requires the documented local `/opt/sanctum-speech` artifacts and is not a universal
hardware recommendation. Same-fixture transcripts matched at 2/4/6 thread settings;
see `evals/results/asr-thread-candidates.json` and ADR 0043. Admission gives voice
priority over background work and bounds interactive deferral to 2500ms.
