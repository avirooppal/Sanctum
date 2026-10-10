# ADR 0017: Keep the ASR runtime dependency tree permissive-only

- Status: Accepted
- Date: 2026-10-10

## Context

The plan names faster-whisper as a Phase 3 ASR engine. Its package metadata reports
MIT, but the current pinned dependency tree includes `tqdm` with `MPL-2.0 AND MIT`
metadata. The repository's release rule permits only permissively licensed
dependencies. A direct package-license check would miss this transitive dependency.

## Decision

Do not add faster-whisper to the runtime or lockfile. Implement this local file-ASR
adapter for whisper.cpp, whose core project is MIT. Require an existing local executable
and model file, both SHA-256 pinned in a speech profile. Pass explicit paths as argv
with shell execution disabled; do not resolve model IDs, download files, or fall back
to cloud. Select no default model or engine binary until its exact source, revision,
license, hash, and hardware fit are recorded in the artifact/model registry.

## Consequences

This keeps the speech runtime dependency-free and compatible with the permissive-only
gate. The adapter is testable with a fake process runner, but real inference remains
unverified until a registered local whisper.cpp build and model are provisioned. The
planned faster-whisper backend may be reconsidered if its full dependency tree passes
the same license policy.
