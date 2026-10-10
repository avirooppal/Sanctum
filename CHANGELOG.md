# Changelog

## 2026-10-10 — Phase 2 v6 retrieval and grounded answer gate

- Added the frozen exact machine-identifier v6 challenge, its retrieval-only ablation,
  and an ACL-filtered hybrid answer replay. On 480 parsed passages, vector/hybrid
  recall@5 measured 0.60/1.00 (+0.40); citation support and expected-answer inclusion
  measured 1.00, and unsupported-query abstention passed.
- Added deterministic unique-identifier answer resolution with source heading context
  (ADR 0012), plus a local judge checkpoint runner and human review packet.
- Phase 2 remains in progress: hybrid local judge supports 30/30 answers; vector-only answer comparison and
  human review are pending. Phase 3 remains gated.

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
