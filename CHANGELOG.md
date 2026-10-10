# Changelog

## 2026-10-10 — Phase 3 bounded WAV intake

- Added a shared 64 MiB PCM16 mono 16 kHz WAV decoder that rejects malformed,
  truncated, empty, or unsupported inputs. The upload contract now advertises only
  the audio container implemented by this slice; the ASR runner uses the same decoder.

## 2026-10-10 — Phase 3 transcription response formats

- Added tested JSON, plain text, verbose segment JSON, and WebVTT serialization for
  engine-neutral transcription results; declared WebVTT in the API response contract.

## 2026-10-10 — Phase 3 bounded realtime audio input

- Added an engine-neutral realtime PCM buffer with strict base64 validation,
  per-buffer sample-format consistency, complete-frame checks, a configurable byte
  limit capped at 256 MiB, and explicit commit/clear behavior.
- Documented the distinction between per-message schema limits and aggregate session
  memory limits. Hardware-backed streaming and latency remain unverified.

## 2026-10-10 — Phase 3 local ASR benchmark runner

- Added a schema-validated, offline manifest runner for hash-pinned local PCM WAV
  inputs and profiles, with strict directory containment and a 64 MiB audio bound.
- Split voice-turn measurements from ASR records so file transcription cannot imply
  a passing streaming-latency or barge-in gate. Real inference remains unverified.

## 2026-10-10 — Phase 2 gate closed; Phase 3 contract planning started

- Calibrated exact-entity faithfulness judging: hybrid 30/30 supported (1.00),
  vector-only 18/30 (0.60), matching citation and expected-answer measures. Codex
  verified all four sampled hybrid answers against the frozen source at the user's
  direction; ADR 0014 records this reviewer substitution and its limits.
- Phase 2 is complete for the synthetic v6 suite. Phase 3 is in progress with its
  contract-first plan; the T1 latency gate and unspecified WER threshold remain open.

## 2026-10-10 — Phase 2 v6 retrieval and grounded answer gate

- Added the frozen exact machine-identifier v6 challenge, its retrieval-only ablation,
  and an ACL-filtered hybrid answer replay. On 480 parsed passages, vector/hybrid
  recall@5 measured 0.60/1.00 (+0.40); citation support and expected-answer inclusion
  measured 1.00, and unsupported-query abstention passed.
- Added deterministic unique-identifier answer resolution with source heading context
  (ADR 0012), plus a local judge checkpoint runner and human review packet.
- Hybrid local judge supports 30/30 answers. Matched vector-only answers measured 0.60
  citation support and expected-answer inclusion versus hybrid 1.00. A directed
  reviewer spot-check found the initial local judge falsely accepted three vector-only
  decoy answers; ADR 0013 adds exact-identifier validation. The calibrated vector judge
  supports 18/30 (0.60), matching answer containment; calibrated hybrid judging remains
  underway. Phase 3 remains gated.

## 0.1.0 — 2026-10-08

- Add Rust gateway envelope contracts and policy containment foundation, pinned toolchain.
- Add two-process offline IPC diagnostic with 22 kernel denial probes and fail-closed startup.
- Add Rust CI, reviewed crate licenses/checksums and shared Python/Rust contract fixtures.

- Preserve supplied plan and scaffold its exact apps/services directory layout.
- Add offline hardware doctor, configurable tier recommendations and JSON contract.
- Add request envelope, permissive model registry schema and dependency inventory.
- Add Linux network namespace prototype with fail-closed startup probes.
- Add CI, contract/unit tests, license checks, generated API docs and evaluation baseline.
- Document incomplete containment and all later phase gates; no inference or weights ship.

## Phase 1 reference chat
Added immutable artifact import/download and fit estimates, confined real llama.cpp chat and embeddings, OpenAI streaming/tools/schema compatibility, local auth, SQLite conversations, React/Tailwind UI, official SDK and offline clean-rootfs timing gates.

## Phase 2: ACL and retrieval foundations
Added workspace/document ACL catalog, upstream parser adapters, sqlite-vec prefiltering, RRF glue and seven adversarial/contract tests. Retrieval-quality exit remains unverified.

## Phase 2 evaluation update — 2026-10-09
Recorded the completed frozen v4 challenge run. Recall improvement and exact citation thresholds failed; Phase 2 remains gated.

## Phase 2 retrieval and ingestion update — 2026-10-09
Added grounded quote fallback, configurable loopback-only folder polling, and a frozen 480-passage v5 retrieval challenge. V5 also saturated dense recall; Phase 2 remains gated.

## Phase 2 retrieval and ingestion update — 2026-10-09
Added grounded quote fallback, configurable loopback-only folder polling, and frozen 480-passage v5 retrieval/citation evidence. Citation and abstention checks pass; hybrid recall-gain gate remains failed.
