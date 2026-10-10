# Changelog

## 2026-10-10 — Status housekeeping and cancellation context

- Archive status history verbatim and surface current Step 0 gates; correct Phase 6
  to single-owner scope. Repair hosted macOS CI with managed Python; all five jobs pass.
- Add shared first-wins cancellation/deadline state and private-peer association
  through dispatch and Rust engine entry points. In-flight engine cancellation
  remains pending supervision and I/O work; no Step 0 completion claim.
- Record the future warm supervised speech-worker architecture and proposed memory
  budgets; no warm-worker implementation or voice latency result yet.

## 2026-10-10 — Bounded ingress (partial Step 0)

- Guard the public TCP listener with connection/lane/backlog and framing limits,
  upload deadlines and sampled rejection counts. Private HTTP handlers retain auth.
- Add real socket disconnect/stall and three-minute upload-flood harnesses.
  Full engine cancellation and WebSocket acceptance remain outstanding.

## 2026-10-10 — Repeatable development bundle verification

- Add an optional fresh output path while preserving existing bundles and rejecting
  recursive destinations. Rerun all source gates on Linux and Windows.
- Fresh no-network container reaches a real answer in 31.7311s from an offline
  unsigned bundle. Downloads, build and Phase 6 signed packaging remain excluded.

## 2026-10-10 — Bounded incremental recognition

- Add replaceable transcript snapshots over bounded PCM prefixes, with stale-result
  suppression after cancellation and explicit concurrency/overflow guards.
- Measure both real local ASR engines in network isolation. Native streaming,
  hosted realtime transport and process cancellation remain outstanding.

## 2026-10-10 — Browser meeting capture

- Add workspace selection/creation and explicit reviewed transcript save to Knowledge.
- Display generated summaries/action evidence as plain text; preserve drafts on errors.
- Verify 12 web tests and five real browser integration checks.

## 2026-10-10 — Hosted local meeting notes

- Add authenticated meeting transcript summarization into Knowledge, with workspace
  authorization before inference, restricted default classification and action quotes.
- Verify real local summary, ingestion/retrieval and request-security checks (7/7).
  Diarization and semantic summary evaluation remain incomplete.

## 2026-10-10 — Fresh-checkout validation and frontend security refresh

- Fix README's missing Knowledge dependency group and document exact engine extraction.
- Remove vulnerable Tailwind 3 scanner dependencies using pinned Tailwind 4 core;
  update Vite/PostCSS/Rollup, recheck licenses, and gate CI on npm audit.
- Registry audit falls from 10 advisories to zero; real browser styling/speech checks
  pass. Fresh checkout reaches a real answer with staged verified artifacts.

## 2026-10-10 — Bounded local microphone dictation

- Capture mono PCM locally with explicit start/finish controls, a 30-second cap,
  and track cleanup on cancellation/navigation. No browser speech/cloud fallback.
- Emulated microphone passes real worklet-to-ASR integration and cleanup checks;
  physical audio devices and streaming ASR remain unverified or incomplete.

## 2026-10-10 — Browser file speech

- Add local WAV dictation to draft, response playback and cancellation with stale
  response suppression. Keep model IDs explicit and audio/credentials in memory.
- Real browser passes six checks; warm file-ASR/chat/TTS completes in 5.12s.
  Physical audio, streaming speech and T1 latency remain unverified or incomplete.

## 2026-10-10 — Authenticated local TTS API

- Host opt-in WAV/PCM synthesis under inherited kernel containment with bounded
  requests, responses and execution deadlines. Reject forged workspace context.
- Verify real official-SDK TTS, transcription and chat requests (8 checks each).

## 2026-10-10 — Real permissive CPU TTS reference

- Added a pinned Flite TTSEngine/profile with registered built-in voices, bounded
  temporary files and explicit speed handling. Preserved CMU license/voice notices.
- Real isolated synthesis produced 3.31s of audio in 0.053s. This is file-generation
  evidence, not physical playback, neural voice quality or a full voice-turn SLO.

## 2026-10-10 — Second real local ASR backend

- Added Parakeet CLI ASR and profile factory without changing product API or defaults.
  Both Whisper and Parakeet passed real isolated file/SDK integration.
- Preserve upstream NVIDIA weight attribution alongside the conversion license;
  record inspected GGML format rather than relying on repository tags (ADR 0023).
- Document coarse timestamps and unsupported vocabulary prompts; no voice SLO claim.

## 2026-10-10 — Real Silero VAD adapter

- Added hash-pinned Silero file VAD with timestamp conversion and silence checks.
  Additive profiles preserve prior configurations (ADR 0022).
- Recorded real denied-network VAD and VAD+ASR SDK results. VAD remains opt-in;
  the measured 36.004s first file upload is not a real-time voice result.

## 2026-10-10 — Authenticated hosted file transcription

- Added optional gateway speech configuration and an isolated, bounded multipart
  file-ASR worker. Registry/model/binary hashes are checked before inference; the
  gateway supplies solo restricted context and rejects unauthorized requests.
- Real official SDK tests cover four response formats and four rejection cases;
  existing chat SDK tests still pass. OpenAPI 0.2 adds gateway-injected context
  semantics; existing runtime configurations remain valid without speech.
- File ASR is whole-file only: streaming, VAD, diarization and voice chat remain partial.

## 2026-10-10 — Recovered runtime and real speech verification

- Recovered the affected WSL distribution and completed the pinned whisper.cpp build.
  Recorded real isolated ASR on the upstream JFK sample, with audio/model/binary hashes.
- Reran Rust containment and real OpenAI SDK integration; added strict plan coverage
  and resumability records (ADR 0021). No unverified phase gate is declared green.
- Extended mandatory Python type checking to speech and fixed three optional-value
  diagnostics without removing tests or weakening validation.

## 2026-10-10 — Phase 3 reference ASR provisioning

- Record MIT source/model pins for whisper.cpp v1.9.5 and tiny.en; verify the downloaded
  model hash. Restrict legacy GGML registry entries to ASR (ADR 0020, contract test).
- Document the WSL service failure that prevented real inference verification and
  provide build/evaluation reproduction commands. Phase 3 remains in progress.

## 2026-10-10 — Phase 3 intake security verification

- Reject unauthorized meeting ingestion before invoking the summarizer, including
  invalid reader memberships. Knowledge repeats authorization at ingestion.
- Bound encoded audio before base64 decoding and accumulate PCM in a bytearray to
  avoid per-chunk object amplification. Regression tests reproduced both defects.
- Correct recorded test counts and clarify that type checks currently cover the CLI.

## 2026-10-10 — Phase 3 meeting notes in Knowledge

- Added local-only meeting summary orchestration that requires a model registry entry,
  rejects action items without verbatim transcript evidence, and stores the transcript,
  summary, and actions in the selected Knowledge workspace with its reader ACLs.
- ADR 0019 aligns speech classification with Knowledge's `confidential` vocabulary.
  Integration tests confirm an unauthorized workspace member cannot retrieve notes.

## 2026-10-10 — Phase 3 local TTS request orchestration

- Added contract-validated TTS request handling with a selected local model ID,
  configured voice IDs constrained to the registry's permissive license set, bounded
  PCM output, WAV packaging, and speed forwarding. Fake-engine tests pass; real voices,
  TTS runtime, microphone/speaker loop, and latency remain unverified.

## 2026-10-10 — Phase 3 chunked local dictation

- Added a schema-validated realtime dictation session that accumulates bounded local
  PCM chunks, transcribes on commit through the replaceable local ASR interface, and
  clears input on cancellation. Tests use a stub engine; microphone capture, partial
  streaming ASR, TTS output, and WebSocket hosting remain unverified/unimplemented.

## 2026-10-10 — Phase 3 file transcription orchestration

- Added a contract-validated local upload service that binds requests to the selected
  local profile and composes bounded WAV decoding, the replaceable VAD/ASR/diarization
  pipeline, and OpenAI-style response formatting. Fake-engine integration tests pass;
  no network listener or real speech engine is claimed.

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
