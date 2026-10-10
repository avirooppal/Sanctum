# Implementation status

## Active autonomous mission — 2026-10-10

### Latest slice: Phase 3 hosted meeting notes into Knowledge

Last green commit: `dfe25e4`. Additive authenticated
`POST /v1/workspaces/{id}/meetings` contract, three tests before implementation,
then local JSON-schema summarization in the confined Knowledge worker. Workspace
write authorization precedes inference; model artifact must match the licensed
registry. Notes default to restricted, inherit document ACLs, and action quotes
must occur verbatim in the transcript. Quote presence is not semantic entailment.

`uv run --offline --group knowledge python tools/check.py`: PASS, 126 tests plus
one Windows symlink privilege skip. Clean Linux venv `python tools/check.py`:
127/127 PASS, including that symlink check; lint, formatting, type checks, contract,
license and hardware-fixture gates pass. Rust rebuild and `bash tools/check_rust.sh`:
21 tests, 73 crate licenses, 38 kernel denial probes PASS.

Real isolated runtime on port 8768 with a new state directory:
`python evals/meeting_smoke.py --token-file <state>/local.token --asr-result
evals/results/speech-sdk-parakeet.json --output evals/results/speech-meeting.json`
PASS 7/7. Actual ASR transcript -> local summary -> stored/retrievable document
in 2.053715s. Model returned no action items for the Kennedy speech fixture;
nonempty action evidence is covered by unit tests, not this live sample. Semantic
quality and diarization remain UNVERIFIED. Early calls failed before startup had
created the token; waited for readiness. First completed test incorrectly expected
403 for a malformed workspace ID; corrected fixture to a valid nonexistent ID and
retained a separate 400 assertion for malformed IDs. No product gate relaxed.

Prior chat regression rerun on the same runtime: `python evals/sdk_chat.py
--base-url http://127.0.0.1:8768/v1 --token-file <state>/local.token` PASS 8/8;
chat 0.4039s, streaming TTFT 0.4391s, 1024 embedding dimensions. Evidence updated
in `evals/results/phase1-sdk.json`. Final source gate rerun after smoke-script changes
PASS (`.sanctum/mission-meeting-source-final.log`).

Updated verification clone at `dfe25e4` also passed source checks, nine web tests,
typecheck, build and npm audit (zero advisories). This remains staged-artifact
acceptance, not clean-machine install timing. No phase tag is justified.

Next three steps: meeting review UI; streaming speech/server cancellation;
diarization with verified permissive provenance. Open blockers: no physical audio
or T1 reference hardware; Docker socket unavailable. Phase 4–6 and full final
acceptance remain incomplete. Privacy Ledger is absent; no ledger claim is made.

### Latest slice: fresh-checkout acceptance audit and frontend dependency security

Last green commit: `c5100e2`. Fresh clone from GitHub into `.sanctum/acceptance-20261010`.
README's original `uv sync --locked` produced 4 Knowledge import errors during checks;
corrected setup/validation includes `--group knowledge`. Corrected clean-venv source
suite passes (123 + 1 Windows privilege skip). Doctor reports T0/t0-cpu/llama.cpp/Q4_K_M,
12 CPUs, 15.70 GiB, Intel shared GPU; native Windows startup correctly blocked.
Exact engine extraction commands are now documented.

Fresh clone imported the three reference artifacts using README's `--from-file`
path, verifying size/hash. `npm ci`, typecheck, 8 web tests and build passed on cloned
commit. WSL `cargo build --locked --offline --bin sanctum-runtime` completed in 2m24s;
`bash tools/check_rust.sh` passed 21 tests, 73 crate licenses, 38 real denial probes.
Configured a new empty state directory and port 8767; real official SDK passed 8/8:
chat 0.7924s, streaming TTFT 0.5852s, embedding dimensions 1024. Evidence:
`evals/results/fresh-checkout-sdk.json`. This uses existing dev tools and staged
models; it is NOT a timed clean-machine download/install or final platform acceptance.
Fresh-container rerun blocked: Docker reports an active unit but its socket is
unreachable. No container success is claimed in this run.

Fresh npm install exposed 10 advisories (8 high, 2 moderate). Stopped acceptance to
fix them. Upgraded verified MIT Vite 7.3.7, PostCSS 8.5.29, Rollup 4.64.4, Tailwind
4.3.3 core. ADR 0025 replaces the vulnerable scanner dependency tree with local
compiler glue; retains React/Tailwind. No advisory suppression or threshold relaxation.
New compiler test failed absent implementation, then caught an invalid @source directive;
fixed syntax and reran. Final frontend tests 9/9, typecheck/build PASS. Real browser
7/7 including computed desktop styles, mobile bounds, dictation, chat, playback/stop.
Screenshots inspected; explicit input/button styling preserves the speech panel.

`npm audit --prefix apps/web --audit-level=low`: PASS, zero advisories.
`evals/results/frontend-security.json` records before/after. Changed package license,
tarball and integrity metadata checked against npm; 72 locked packages have only
MIT/ISC/Apache-2.0/BSD-3-Clause licenses. Full `tools/check.py` PASS with updated registry.
CI now includes the audit. Runtime never calls npm. Last Rust gate is the fresh-clone
run above; no Rust implementation changed in this slice.

Next three steps: repeat updated source setup in the verification clone; finish
streaming speech/cancellation; integrate meeting/diarization. Full mission remains
partial and no phase is tagged green. Ledger reconciliation cannot run until ledger
implementation exists; Phase 4–6 remain outstanding, not hardware-only blockers.

### Latest slice: Phase 3 bounded microphone dictation

Last green commit: `354d993`. Explicit Start microphone / Finish dictation uses a
same-origin AudioWorklet, mono 16 kHz PCM16 WAV, and the existing local ASR route.
Worklet and main-thread buffer both cap capture at 480,000 samples; a wall-clock
30-second limit closes devices as well. Stop/navigation/unmount discard audio and
close tracks/context. Late permission grants after cancel are discarded and closed.
Contract added before tests/implementation in `docs/contracts/web-speech-v1.md`.

Verification: baseline web typecheck/build and 4 controller tests were green from
`354d993`; new PCM tests failed missing implementation before code. Final `npm test
--prefix apps/web`: 8/8, covering PCM headers/clamping/nonfinite input/overflow and
worklet's own 30-second bound. `npm run typecheck --prefix apps/web`, production
build and `node --check apps/web/src/capture-worklet.js`: PASS. Worklet is emitted
as a local asset, not an inline data URL. Full `tools/check.py`: PASS, 123 tests +
1 Windows privilege skip and existing lint/type/format/license/eval gates.

`node evals/browser_microphone.mjs <playwright-package> <token-file>
.sanctum/speech-smoke/jfk.wav asr-parakeet-q4k-reference`: PASS 4/4 with real worklet
and local ASR, using Chromium's emulated microphone. Fixture loops after 11 seconds;
12-second capture includes its repeated beginning, not an ASR quality benchmark.
Default headless-shell runs failed getUserMedia with NotSupportedError; full Chromium
headless passed. [Playwright documents this browser-mode distinction](https://playwright.dev/docs/browsers).
Evidence: `evals/results/speech-microphone.json`, zero page errors. Browser file
dictation/playback regression also rerun. Physical microphone/speaker and T1 SLO
remain UNVERIFIED. No hardware success is inferred from device emulation.

Next three steps: streaming ASR; cancellable server execution; meeting/diarization.
Phase 3 remains in progress, no phase tag. Phase 4–6 implementation remains outstanding.

### Latest slice: Phase 3 browser file dictation and playback

Last green commit: `555caa4`. Added opt-in Local speech panel, draft-only file
transcription, explicit profile/voice IDs, real WAV playback and Stop audio. Controller
suppresses stale delivery when cancellation races; credentials/audio remain in memory.
Contract: `docs/contracts/web-speech-v1.md`. CSP allows blob media only, same-origin
connections unchanged. Microphone/streaming/server-side barge-in are not implemented.

Baseline `npm run typecheck --prefix apps/web` + `npm run build --prefix apps/web`
passed before edits. New controller tests first failed missing implementation; now
`npm test --prefix apps/web` passes 4/4 and is wired into CI. Typecheck/build PASS.
`uv run --offline --group dev --group knowledge python tools/check.py` PASS: 123 tests
+ 1 Windows privilege skip, lint/format/type/license/doc gates. Rust full check PASS:
21 tests, 73 crate licenses, 38 kernel denial probes after rebuilding gateway for CSP.

Real browser command: `node evals/browser_speech.mjs <playwright-package> <token-file>
.sanctum/speech-smoke/jfk.wav asr-parakeet-q4k-reference tts-flite-slt-reference
tts-flite-slt-reference`. Bundled Playwright used as external test tooling, no new
product dependency. First navigation timed out while models initialized; rerun after
startup passed. Screenshot exposed composer overlap; removed sticky positioning,
rebuilt and repeated browser test. Final: 6/6 checks, zero page errors, real dictation,
chat, browser play promise and stop; mobile width 390px has no horizontal overflow.
Evidence: `evals/results/speech-browser.json`; screenshots in `.sanctum/`.

`python evals/sdk_voice_turn.py --token-file <local.token> --audio
.sanctum/speech-smoke/jfk.wav --asr asr-parakeet-q4k-reference --chat chat-tiny-q8
--tts tts-flite-slt-reference --voice tts-flite-slt-reference --output <result.json>`
ran twice. `speech-voice-turn.json`: 22.978690s including startup overlap;
`speech-voice-turn-warm.json`: ASR 3.579339s, chat 0.548261s, TTS 0.992409s,
complete WAV available 5.120009s, generated duration 4.69s. These are single-file
smokes, not a corpus percentile or physical voice turn. T1 <800ms gate NOT met/verified.

Next three steps: microphone capture; streaming ASR and cancellable server execution;
meeting/diarization integration. Blockers: T1/audio device verification unavailable;
current CLI engine startup cannot meet streaming latency. No phase green tag.

### Latest slice: Phase 3 hosted TTS

Last green commit: `6972cf8`. Optional `speech.tts` adds authenticated bounded
`/v1/audio/speech`; context derives from the solo session. Same kernel-confined worker
path as ASR; WAV/PCM responses are decoded with a strict type and size limit.
Contract/test first: missing worker adapter and Rust decoder failed before implementation.

Verification in this slice:
- `uv run --offline --group dev --group knowledge python tools/check.py`: PASS,
  123 passed + 1 Windows privilege skip; format, lint, typing, 26 Python and 145
  frontend dependency licenses, 8 profile fixtures and generated docs passed.
- WSL equivalent with `VIRTUAL_ENV` set and `PYTHONPATH` unset: PASS, 124 tests,
  including the symlink case. First attempt selected the Windows venv; next attempt
  found inherited Python 3.10 user packages (`cloudpickle`) through PYTHONPATH.
  Neither gate was bypassed; explicit clean environment resolved both failures.
- `cargo build --locked --offline -p sanctum-gateway --bin sanctum-runtime` and
  `bash tools/check_rust.sh`: PASS, 21 Rust tests, 73 crate licenses,
  22 bootstrap + 16 runtime/exec-child kernel denial probes.
- Restarted real gateway on 127.0.0.1:8766 with optional TTS profile.
  `python evals/sdk_tts.py --token-file <local.token> --model tts-flite-slt-reference
  --voice tts-flite-slt-reference --output evals/results/speech-sdk-tts.json`: 8/8.
  WAV and PCM matched; 3.31s audio. First request 36.655314s overlapped gateway
  startup. This does NOT satisfy the voice SLO; physical playback UNVERIFIED.
- `python evals/sdk_speech.py --token-file <local.token> --audio .sanctum/speech-smoke/jfk.wav
  --model asr-parakeet-q4k-reference --output evals/results/speech-sdk-parakeet.json`:
  8/8, first request 4.130616s. `python evals/sdk_chat.py --base-url
  http://127.0.0.1:8766/v1 --token-file <local.token>`: 8/8, chat 0.3812s,
  streaming TTFT 0.4572s, embeddings 1024 dimensions.

No phase gate/tag: streaming speech, device playback, diarization and T1 corpus/SLO
remain incomplete or UNVERIFIED. Next three steps: cancellable voice orchestration;
browser audio UI; real voice-turn evaluation. Full mission coverage remains partial.

### Latest slice: Phase 3 real CPU TTS adapter

Last green commit: `1c2fcd4`. Added opt-in Flite 2.2 TTSEngine, versioned TTS profile,
strict registered voice selection, private temporary text input and bounded WAV output.
ADR 0024 records the permissive CMU collection license and compiled-voice format
exception; exact upstream COPYING is preserved. This is a small non-neural reference,
not a replacement claim for planned neural voice quality. No new Python dependency.

Build executed on pinned source: `./configure --with-audio=none --disable-shared &&
make -j 1`; `ldd bin/flite` lists only libc, libm and the OS loader. Hash and profile
are in `evals/results/speech-tts-profile.json`. Contract-first tests initially failed
import, then passed; `tools/check.py` PASS, 122 tests passed + 1 Windows privilege skip,
type/lint/format/license gates and 8 profile fixtures pass.

Real command: `python3 tools/isolated_run.py -- /home/aviroop/.local/share/sanctum-dev-venv/bin/python
evals/tts_smoke.py --profile .sanctum/speech-smoke/tts-profile.json --voice
tts-flite-slt-reference --text "Sanctum keeps your conversations on this machine."
--wav .sanctum/speech-smoke/tts.wav --output evals/results/speech-tts-smoke.json`.
PASS 4 network denial probes; nonzero mono 16 kHz PCM, 3.31s audio generated in
0.052706995s. Physical playback, neural quality and voice-turn latency UNVERIFIED.

Next three steps: host TTS API; cancellable voice-turn orchestration; browser audio UI.

### Latest slice: Phase 3 second real ASR backend

Last green commit: `08b8711`. Added profile-selected `parakeet.cpp` behind ASREngine;
the existing worker/eval runner now use an engine factory. Both adapters ran for real.
Registry keeps NVIDIA CC-BY-4.0 plus conversion MIT obligations with required attribution
and upstream revision (ADR 0023). Inspected model magic `lmgg`: recorded GGML despite
upstream repository naming it GGUF. No default profile changed.

Fresh checks: `tools/check.py` PASS, 118 tests passed + 1 Windows privilege skip;
lint/format/type/license/profile gates pass. Contract-first adapter test initially
failed import, then 3 new adapter tests plus attribution validation passed.
Real command: `python3 tools/isolated_run.py -- /home/aviroop/.local/share/sanctum-dev-venv/bin/python
evals/run_speech_asr.py --manifest .sanctum/speech-smoke/parakeet-manifest.json --profile
.sanctum/speech-smoke/parakeet-profile.json --output evals/results/speech-parakeet-smoke.json`.
PASS 4 egress probes; 11s public-domain JFK sample transcribed in 1.760729854s,
WER 0/22, RTF 0.160066350; score via `evals/speech_eval.py`. Artifacts and exact
profile/binary/model hashes: `speech-parakeet-{profile,smoke,smoke-metrics}.json`.
`evals/sdk_speech.py` with model `asr-parakeet-q4k-reference`: PASS 8/8 real HTTP checks,
first request 23.964087261s (`speech-sdk-parakeet.json`). Timestamps are explicitly
whole-clip coarse boundaries, detected language unknown, vocabulary prompts unsupported.
These are file ASR implementations, not streaming input or Phase 3 SLO verification.

Next three steps: audio UI; cancellable voice streaming; audited real TTS/diarization.

### Latest slice: Phase 3 real Silero file VAD

Last green commit: `a53a2f5`. Added SileroCppVAD behind the detector protocol, MIT
model pins, additive profile fields and registry support (ADR 0022); defaults unchanged.
Contract-first tests failed import before implementation, then passed. Upstream README
named an obsolete build target; inspecting CMake resolved the failed build to target
`whisper-vad-speech-segments`. Actual output uses centiseconds, covered by adapter tests.

Fresh results: `tools/check.py` PASS, 114 tests passed + 1 existing Windows privilege
skip, typing/lint/format and 26 Python/145 frontend license checks pass.
`python3 tools/isolated_run.py -- /home/aviroop/.local/share/sanctum-dev-venv/bin/python
evals/vad_smoke.py --profile .sanctum/speech-smoke/profile.json --audio
.sanctum/speech-smoke/jfk.wav --output evals/results/speech-vad-smoke.json`: PASS,
4 network-denial probes, 4 intervals in 0.141802387s, zero intervals for digital silence.
`evals/sdk_speech.py` using the prior arguments and output `speech-sdk-vad.json`:
PASS 8/8 actual VAD-enabled gateway tests; first request 36.004429950s. This is not
streaming or a T1 SLO pass; exact transcript and profile/hashes are in result artifacts.

Next three steps: second ASR engine; bounded streaming/voice cancellation; real TTS.
Remaining Phase 3 requirements include diarization, live audio and T1 measurements.

### Latest slice: Phase 3 authenticated file-ASR endpoint

Last green commit: `5c4b3a1` (real isolated ASR and mandatory speech typing).
Acceptance: real official SDK multipart WAV upload through the isolated authenticated
gateway, bounded inputs, private context, no chat regression. Added versioned worker
contract, optional backward-compatible runtime speech config, strict multipart intake,
contained per-request worker with registry/hash verification and deadlines, and SDK
integration script. Whole-file/no-VAD mode is explicit. TTS/realtime remain disabled.

Commands/evidence:
- Before edits: full Python source gate, Rust regression/license/kernel gates green.
- Contract-first multipart test initially failed import (implementation absent); then
  3 multipart and 3 worker security tests passed. Rust config/type tests initially failed
  compilation before implementation. These expected development failures were not committed.
- First SDK attempt failed because pinned OpenAI 3.26 uses `httpx2`, not `httpx`;
  corrected to the already locked dependency. JSON upload then worked, but text failed
  503 due to missing charset allowlist entries. Added a Rust regression and fixed it.
- `evals/sdk_speech.py --token-file /home/aviroop/.local/share/sanctum-speech-smoke/local.token
  --audio .sanctum/speech-smoke/jfk.wav --model asr-whisper-tiny-en-reference
  --output evals/results/speech-sdk.json`: PASS 8/8 real tests. First request 3.782195892s;
  JSON/text/verbose/VTT, unknown model, invalid WAV, cross-workspace spoof and bad token.
- `evals/sdk_chat.py --base-url http://127.0.0.1:8766/v1 --token-file
  /home/aviroop/.local/share/sanctum-speech-smoke/local.token`: PASS 8/8 real regression;
  chat 0.3047s, TTFT 0.4484s, embedding dimension 1024 (`phase1-sdk.json`).
- `tools/check.py`: 111 pass, 1 Windows privilege skip; CLI/speech typing, Ruff,
  26 Python + 145 web license checks, 8/8 profile fixtures pass. Worker typing targets
  Linux explicitly because SIGALRM is intentionally unavailable on Windows.
- Full `tools/check_rust.sh`: PASS, 20 Rust tests, fmt/Clippy, 73 licenses,
  22 bootstrap + 16 runtime/child denial probes. The added compatibility test first
  triggered Clippy's test-module ordering rule; moved the test module to the end and
  reran successfully without suppressing the lint.

Next three steps: streaming/VAD engine integration; cancellable TTS voice loop;
real Knowledge/document and clean-clone acceptance audit. Phase 3 gate is NOT green:
no diarizer, second ASR engine, live microphone/speaker path or T1 SLO measurements.

Initial slice in this mission: Phase 0 re-verification and strict coverage audit; then Phase 3
independent speech orchestration. Tested base / last committed source-green slice:
`303d16ea409792dd5f1052adef53a3edde4f48f9`. Historical phase completion records below
are not fresh verification. No fully green phase tag has been created this session.

Fresh commands and results:
- `uv run --offline --group dev --group knowledge python tools/check.py`: PASS,
  105 tests passed, 1 existing Windows symlink privilege skip; Ruff/CLI typing,
  26 Python and 145 frontend dependency license checks passed. Profile fixture
  evaluation: 8/8, accuracy 1.0, false-ready 0. Log: `.sanctum/mission-baseline.log`.
- `uv run --offline sanctum doctor`: PASS; Windows AMD64, 12 CPUs, 15.70 GiB RAM,
  Intel Iris Xe with unknown/shared VRAM, T0 / t0-cpu / llama.cpp / Q4_K_M.
  Privacy correctly reports egress UNVERIFIED and startup BLOCKED.
- `npm run typecheck --prefix apps/web` and `npm run build --prefix apps/web`: PASS;
  Vite built 28 modules. This is not a browser or real chat request test.
- Linux re-entry: FAIL `Wsl/Service/0x8007274c`. Targeted Ubuntu-22.04 termination
  requested to recover that distribution; recovery not yet confirmed. No global
  WSL shutdown requested. Fresh Rust, containment and inference checks are blocked.

Recovery and additional fresh evidence (supersedes that blocker): targeted termination
completed and Linux shell access recovered. `bash tools/check_rust.sh` passed: 16 Rust
tests, fmt/Clippy, 73 crate licenses, 22 bootstrap and 16 runtime/child denial probes.
The first invocation had a shell PATH quoting error; retried with a literal Linux PATH.
`python3 tools/isolated_run.py -- python3 -c "print(123)"` passed all 4 network probes.
`evals/sdk_chat.py --token-file /home/aviroop/.local/share/sanctum/local.token` against
the running confined reference passed 8/8; chat 0.435s, streaming TTFT 0.540s, embedding
dimension 1024. This is a single CPU smoke run, not a throughput benchmark.

whisper.cpp built successfully with one compiler job. The existing ASR runner executed
inside `tools/isolated_run.py` (4/4 denial probes) against the real pinned tiny.en model:
11.0s JFK audio, 1.109763671s processing, RTF 0.100887606, WER 0/22 = 0.0.
Artifacts: `evals/results/speech-jfk-{provenance,smoke,smoke-metrics}.json`.
This single public-domain speech excerpt is not LibriSpeech or a T1/voice-loop result;
`phase3_slo_verified=false`. Reproduction: `docs/speech-reference.md`.

Expanded `ty check services/speech/sanctum_speech` initially FAILED with 3 optional-value
diagnostics. Explicit guards now preserve existing failure behavior; the mandatory
gate includes speech type checking. Final source rerun is recorded with the slice commit.

Next three steps: (1) recover Linux and rerun foundation containment; (2) complete
bounded voice-loop orchestration with cancellation tests; (3) connect real local
speech engines and measure the file/voice path. Independent work may continue under
ADR 0021; unmet plan gates remain unmet. Missing T1/Apple/NVIDIA/audio hardware must
remain explicitly UNVERIFIED. See PLAN_COVERAGE.md for the stricter scope audit.

Updated: 2026-10-10. Source of truth: ../plan.md. Phase 0 complete; Phase 1 reference implemented.
Phase 1 starts after the Phase 0 completion commit below. Placeholder service directories are not implementations.

| Phase | State | Exit criteria / evidence |
|---|---|---|
| 0 Foundations | done (Linux x86_64) | Doctor tier/profile passes; real isolated HTTP ingress, exec inheritance and egress startup probes pass. Other runtime platforms fail closed. |
| 1 Chat | done (Linux reference) | Offline clean-rootfs install to answer 50.6005s; official SDK 8/8. Downloads/build excluded; native macOS/Windows unverified. |
| 2 Knowledge | done (v6, user-directed reviewer) | Vector/hybrid recall@5 0.60/1.00 (gain +0.40); MRR 0.60/1.00. Hybrid exact citation and expected-answer inclusion 1.00; abstention passed; calibrated local judge 30/30 supported. Vector-only answer/citation/judge rates 0.60. Codex checked 4/4 hybrid cases against frozen sources at the user's direction (ADR 0014); no independent human audit. |
| 3 Speech | in progress (meeting-to-Knowledge integration, local TTS orchestration, chunked dictation, file transcription) | T1 first audio p95 <800 ms; LibriSpeech test-clean WER <=0.10 and test-other <=0.20 (ADR 0018). Host is T0; measurements unverified. |
| 4 Vision | not started | Measurable visual QA lift: unverified; dataset/threshold pending. |
| 5 Agents | not started | Red team passes and zero unexpected ledger egress: unverified. |
| 6 Team | not started | 20 concurrent users meet reference SLO; verified air-gapped install: unverified. |
| 7 Ecosystem | not started (optional) | Installer, SDK and ecosystem polish deferred. |

## Phase 0 checklist

- [x] Preserve full plan, section 13 layout, ADR template and phase/slice plan.
- [x] OpenAPI request envelope (user/workspace/data_class/trace_id/policy_context).
- [x] Model registry schema requiring permissive license, source, revision and hash.
- [x] Hardware doctor prints tier and config-selected profile; no model names in code.
- [x] Local lint, formatting, CLI typecheck, unit/contract tests and license gate.
- [x] CI definition on Linux, Windows and macOS; hosted runs **unverified** (not pushed).
- [x] Early evaluation harness with measured foundation baseline and regression rejection.
- [x] Early Linux isolated startup self-test exercised under WSL2.
- [x] Two-process Rust bootstrap with inherited IPC and per-process kernel denial tests.
- [x] HTTP health ingress and exec/thread-compatible runtime egress isolation on Linux x86_64.
- [ ] Native engine execution verification is the next Phase 1 integration gate.
- [ ] Native Windows/macOS containment (unverified/unsupported; no services start).
- [ ] Complete GPU/VRAM/CPU-feature/NPU support matrix; real Apple/NVIDIA checks.
- [x] Rust toolchain, envelope contracts and executable supervisor/worker foundation.

## Measured results for slice 1

Host: Windows AMD64, Python 3.12.13; local date 2026-10-08.

| Check | Observed result |
|---|---|
| `uv run --offline python tools/check.py` | PASS |
| CLI/contract tests | 14/14 pass |
| Isolation/evaluation tests | 7/7 pass |
| Ruff lint + format | Pass; 13 Python files formatted |
| ty CLI type checking | Pass |
| Installed package license metadata | 9/9 match permissive reviewed registry |
| Profile evaluation | 8/8 correct; accuracy 1.0; false-ready count 0 |
| Windows doctor | 12 logical CPUs, 15.70 GiB RAM, Intel Iris Xe, T0 / t0-cpu |
| WSL Ubuntu 22.04 doctor (Python 3.10.12) | 7.61 GiB RAM, CPU flags detected; no matching profile, exit 2 as designed |
| Dedicated Intel VRAM, NPU, Windows CPU features | Unknown/unverified; no guessed values |
| WSL2 Linux isolated startup | 4/4 IPv4/IPv6 TCP/UDP probes denied, child executed |
| Native Windows isolated launch | Refused; child not executed |
| WSL host namespace bypass (`--inside`) | Refused before probes; child not executed |

Baseline artifact: ../evals/results/foundation-baseline.json. This uses deterministic
hardware fixtures, **not model/RAG/audio benchmarks**. Default regression threshold:
5%; zero tolerance for security (ADR 0004). No tokens/sec or latency estimates claimed.

## Limits and next slice

Doctor does not attest runtime containment; it always reports egress unverified and
service_start_allowed=false. The Rust bootstrap has inherited local IPC, but no product
HTTP/gRPC adapter or engine-compatible confinement. Neither diagnostic is a hostile
code sandbox; neither establishes production privacy. No ACL, injection,
container, GPU/audio, SDK, load or application E2E tests exist yet. They remain gated
requirements for their owning phases, not passing placeholders.

Next: production HTTP/gRPC adapter over brokered transport, startup health contract,
and engine-compatible Linux isolation before starting Phase 1. Revisit the conservative
15.70 GiB -> T0 decision after model fit measurements. ADRs 0001–0005 record choices; no approval
is required to reproduce this slice. Phase 1 stays blocked until Phase 0 is complete.

## Slice 2 evidence

Rust 1.99.0 installed in WSL Ubuntu 22.04 (Linux x86_64, kernel 6.6.87.2).
Dependencies fetched only during explicit development setup; all verification below
uses offline/locked builds. Native Windows/macOS Rust containment remains unsupported.

| Check | Observed result |
|---|---|
| `bash tools/check_rust.sh` in WSL | PASS |
| Rust contract/integration/unit tests | 10/10 pass |
| Rust fmt and Clippy (`-D warnings`) | Pass |
| Resolved Rust crates | 12/12 permissive licenses and cached archive SHA-256 verified |
| Separate supervisor + worker | 11 EPERM checks each; 22/22 pass; envelope/trace round trip succeeds |
| Prohibited operations | IPv4/IPv6 TCP/UDP sockets, Unix socket, file open, exec, namespace, connect, descriptor passing, io_uring |
| Invalid request/transport tests | Missing workspace, zero trace, cloud enabled, unknown fields, empty user, invalid class, malformed JSON, oversized stdin/frame, wrong stdio: rejected |
| Python source gate after Rust integration | 25/25 tests, lint/format/typecheck and nine Python dependency checks pass |
| Existing profile evaluation | 8/8 correct; false-ready count 0 (unchanged) |
| Hosted Rust CI | Configured; execution unverified (not pushed) |

Measured response: ../evals/results/containment-linux.json; schema validated by the
Python contract suite. These kernel checks do not measure inference, RAG, or latency.
ADR 0005 scopes the bootstrap protocol and containment limitations. Phase 0 remains
in progress until actual product-service startup uses an enforceable supported profile.

## Phase 0 completion evidence (slice 3)

ADR 0006 defines Linux x86_64 as the verified initial runtime; other operating
systems remain unsupported, not silently unconfined. Doctor's configured tier/profile
exit passes on the Windows host. Partial accelerator discovery remains documented.

Rust tests: 13/13 pass; formatting/Clippy pass. All 17 resolved crate licenses and
archive hashes pass. The actual host-to-isolated-gateway HTTP request succeeds;
16/16 runtime/exec-child denial probes pass. Existing strict bootstrap probes remain
22/22. Python suite: 26/26 plus formatting, lint, typecheck and license checks pass.
Evidence: evals/results/runtime-linux.json. Hosted CI remains unverified.

Phase 0 is complete for this support scope. Engine-specific real inference, model
licenses, auth, persistence, UI, SDK compatibility and clean-install timing are
Phase 1 work; no Phase 1 exit claim is made. Historical slice limitations above
remain as provenance, superseded only by this completion record and ADR 0006.

## Phase 1 completion evidence

- [x] Hash-verified official Apache-2.0 chat/embedding GGUFs and MIT llama.cpp.
- [x] Explicit logged download/import; estimates report unmeasured speed honestly.
- [x] Rust loopback-only adapter, OpenAI streaming/tools/schema/embeddings/models.
- [x] Local bearer auth, SQLite history, React/Tailwind model picker and chat.
- [x] Official SDK: 8/8 real tests; 0.4787s chat, 0.4714s streaming TTFT,
  1024-dimensional embedding (single CPU run, not a quality/performance guarantee).
- [x] Clean Linux rootfs offline bundle copy to first answer: 50.6005s <300s.
- [x] 31 Python tests; 16 Rust tests; formatting, Clippy, typecheck, web build pass.
- [x] 22 Python, 73 Rust and 145 frontend dependency license entries checked.
- [x] Browser login, real streamed response, saved conversation restoration verified.
- [x] Runtime/child denial probes 16/16; strict bootstrap probes 22/22.
- [ ] Hosted CI, MLX/Apple and native Windows runtime: unverified.

Evidence: evals/results/phase1-sdk.json, phase1-clean-install.json, phase1-web.png.
The clean-rootfs harness requires Docker's default capabilities during namespace
creation, then the application drops all capabilities and applies its own filter.
Outer Docker seccomp must allow namespace setup; outer network is disabled. The
first cap-drop-ALL attempt failed closed (EPERM). Docker is test-only, not required
for solo operation. This is an unsigned local bundle, not the Phase 6 air-gap release.
ADRs 0007–0008 document model/reference scope and reproducible frontend build pin.

## Phase 2 slice 1

Seven new tests pass for workspace membership, per-document ACL prefilters and
revocation, dedup/versioning, stale-parent denial, structural Markdown chunks,
real sqlite-vec prefiltering, RRF and exact quote validation. Total Python tests 38.
This is a library slice, not an exposed Knowledge service or a completed RAG system.
Parser and vector adapter deviations are recorded in ADRs 0009 and 0010 after
transitive license checks rejected Docling/certifi and LanceDB/tqdm respectively.

## Phase 2 slice 2

Confined Knowledge worker is wired through the isolated Rust gateway. Its startup
checks the Linux loopback-only namespace and inherited seccomp before opening its
SQLite state or making requests to local OpenAI-compatible engines. Profile selects
the model IDs, hashes, paths and ports. API contract includes authenticated workspace
listing, upload, search and ask. The real integration smoke passed: upload, ACL-filtered
retrieval, exact cited answer and empty-evidence abstention. Evidence:
`evals/results/phase2-smoke.json`.

Python source gate passed (38 tests total including 7 Knowledge tests), Ruff format,
lint, typecheck, and 26 installed Python / 145 frontend reviewed license checks.
Rust offline/locked check passed: 16 integration/unit tests, fmt/Clippy, 73 reviewed
crate licenses, 22 two-process kernel denial checks, and 16 runtime/exec-child denial
checks; the isolated HTTP health contract also passed.
Full frozen 30-question retrieval/citation benchmark completed on WSL2 CPU in 1759.045s.
Dense recall@5 1.00, hybrid recall@5 1.00, absolute gain 0.00 (required >=0.05), MRR
1.00 for both, exact citation support 1.00, expected-answer containment 1.00, and
unsupported-query abstention passed. Because dense retrieval is saturated, the recall
exit criterion failed; per the eval plan, a separately versioned harder set is required
before tuning. The questions/corpus are synthetic, so this is pipeline evidence only.
No no-faithfulness-regression result is available (only hybrid answers were judged).
Folder watch, local judge and human faithfulness review remained outstanding at that
time. The later v6 separately versioned challenge below resolves the saturated recall
problem; Phase 3 remains gated on all Phase 2 exit criteria.

## Phase 2 slice 3

V2's zero scores were invalid: expected quotes included heading metadata absent from
child citation text. The runner now validates every frozen expected quote against the
real parser output before making API calls. V3 is a valid 30-question opaque-key suite;
it completed with dense/hybrid recall@5 1.00/1.00, MRR 0.708/0.783, exact citation
support 0.567, and abstention passed. No faithfulness comparison was performed.

Those records exposed that embeddings, BM25, reranking, and answer generation omitted
structural heading context. The pipeline now embeds and lexically indexes parent text,
reranks with parent context, and gives the answer model context while restricting quotes
to child text. A recoverable SIGALRM deadline handler prevents slow inference from
terminating the worker; the eval runner resumes only matching hash-verified checkpoints.
Knowledge tests: 10/10; full Python source/license gate passes. V4 is an independent
30-question/two-register challenge with 60 parsed passages. It completed on the confined
WSL2 CPU runtime (resumed segment 764.355s): dense/hybrid recall@5 1.00/1.00 (gain
0.00; required >=0.05), MRR 1.000/0.983, exact citation support 0.867 (required >=0.95),
expected-answer containment 0.867, and unsupported-query abstention passed. Raw evidence:
`evals/results/knowledge-needle-v4.json`; suite SHA-256 is recorded there. Dense baseline remains
saturated, so the retrieval gate fails. No faithfulness regression comparison, local judge, or
human spot-check is available; folder watching was not yet implemented in slice 3. V4 is synthetic pipeline
evidence, not a customer-corpus benchmark. Phase 3 remains gated.


## Phase 2 slice 4

The v5 challenge expands to 480 parsed passages (30 opaque-key targets and 450
near-duplicate decoys). A retrieval-only comparison completed against a single indexed
workspace: dense/hybrid recall@5 remained 1.00/1.00, gain 0.00. Raw evidence is
`evals/results/knowledge-needle-v5-retrieval-only.json`; answers were not part of this
ablation. The retrieval gain gate remains failed; increasing this synthetic corpus did
not resolve saturation.

Small-model quote handling now falls back to the selected child passage verbatim when
its quote is paraphrased, and rejects unknown chunk IDs. Folder polling ingestion is
implemented as an opt-in local-only client using the existing upload contract. It skips
hidden files and symlinks, permits only Markdown/text PDFs up to 10 MiB, and does not
propagate file deletion (ADR 0011). The 30-question v5 answer run completed: exact citation support 1.00, expected-answer
inclusion 1.00, unsupported-query abstention passed; dense/hybrid recall@5 stayed 1.00/1.00
(gain 0.00). Evidence is `evals/results/knowledge-needle-v5-citation.json`. Watcher integration
smoke passed initial upload, unchanged skip, changed upload and retrieval (`evals/results/folder-watch-smoke.json`).
All 15 Knowledge tests passed on Linux (including symlink rejection); full Python source,
license and foundation evaluation gates passed. The hybrid-gain gate is still failed; no
vector-only answer faithfulness comparison or local judge has been run. A human review packet
is provided at `evals/results/knowledge-needle-v5-human-review.md`; review remains pending.
Phase 3 remains gated.

## Phase 2 slice 5 — v6 discriminative challenge and grounded answers

The separately versioned v6 suite uses 30 exact machine-identifier questions over
480 parsed passages (30 targets and 450 near-duplicate decoys). The frozen dataset
SHA-256 is `bd2c1f62b08284eb62fbc8781969ffc1c530f93b38d5e00942b9569d4039247e`.
Against the same indexed workspace, vector/hybrid recall@5 is 0.60/1.00 (absolute
gain +0.40; target >=0.05), with MRR 0.60/1.00. The retrieval-only artifact is
`evals/results/knowledge-needle-v6-retrieval-only.json`.

The completed ACL-filtered hybrid answer replay has exact citation support 1.00,
expected-answer inclusion 1.00, and unsupported-query abstention passed. Evidence is
`evals/results/knowledge-needle-v6-grounded-answers.json`. An exact-identifier path
returns the matching child passage and parent heading directly when the identifier
is unique in retrieved evidence, avoiding small-model confusion between near-duplicate
records; citations retain heading context. The previous v6 answer run is retained as
diagnostic evidence of 28/30 before this fix.

The first local judge pass marked both suites 30/30 supported. At the user's direction,
Codex checked the four hybrid packet examples against the frozen source and answer
artifacts; all four are supported by the expected source/quote. The same inspection
found three of four sampled vector-only answers cited decoy facts for different
identifiers, despite the prior judge marking all supported. ADR 0013 adds a
deterministic exact-entity check before local entailment judgment. The calibrated
vector judge supports 18/30 (0.60), matching vector answer containment/citation
metrics; calibrated hybrid judging also supports 30/30 (1.00). Artifacts:
`evals/results/knowledge-needle-v6-judge-entity-v2.json` and
`evals/results/knowledge-needle-v6-vector-judge-entity-v2.json`. ADR 0014 records the
user-directed Codex review substitution. Phase 2 is complete under that instruction,
with no claim of independent human review. The corpus is synthetic and demonstrates
pipeline behavior only, not customer-corpus quality.

## Phase 3 slice 1 — speech contracts and evaluation plan

Tasks: define OpenAI-compatible file transcription and speech contracts plus a
WebSocket event protocol; contract tests first; then stable VAD, ASR, diarization, and
TTS engine interfaces; add a dataset-driven WER/latency harness and document local-only
profiles. Tests cover schema validity, malformed/oversized audio, adapter conformance,
VAD segmentation, transcription timing, and barge-in cancellation. Risks: no numeric
WER threshold is stated in plan.md, this machine is T0 rather than T1, audio hardware is
unavailable, and each weight/voice has its own license. No T1 performance result will be
claimed here.
## Phase 3 implementation update

Phase 3 contracts, Python engine protocols, VAD-to-ASR composition with optional
diarization, offline WER/voice-loop evaluator, and a hash-pinned whisper.cpp file-ASR
adapter are implemented. Speech contracts and evaluator are wired into the normal
repository check. No whisper.cpp binary/model, VAD runtime, voice, listener, or hardware
benchmark is provisioned. T1 latency and WER remain unverified; Phase 3 is in progress.
ADR 0018 defines initial LibriSpeech WER gates (test-clean <=0.10, test-other <=0.20);
ADR 0016 defines p95 aggregation for the plan's <800 ms first-audio SLO; ADR 0017
excludes a transitive MPL dependency. T1 metric measurements remain unverified.
Candidate licensing review is documented in `docs/PHASE-3-PLAN.md`; no model is pinned
as a default.

## Phase 3 checklist and measured slice results

- [x] OpenAPI speech routes and realtime WebSocket event contract; schema tests pass.
- [x] Stable VAD, ASR, diarization, and TTS interfaces; VAD/ASR composition tests pass.
- [x] Local whisper.cpp file-ASR adapter with profile hash verification and no shell/network fallback.
- [x] Speech engine profile contract requires explicit egress denial and SHA-256 pins.
- [x] Offline speech evaluation schema and WER/latency/RTF/barge-in report; evaluator tests pass.
- [x] Local manifest-based PCM WAV ASR benchmark runner with manifest-root path checks, 64 MiB bound, and audio hash verification; ASR-only results cannot claim voice-loop success.
- [x] Bounded realtime input audio accumulation with strict base64 validation, consistent format, PCM frame alignment, and hard aggregate memory cap.
- [x] Contracted OpenAI transcription response formats (`json`, `text`, `verbose_json`, `vtt`) with tested segment and timestamp serialization.
- [x] Bounded local PCM16 WAV decoder shared by upload processing and ASR benchmark; advertised input MIME type narrowed to the implemented format.
- [x] Contract-driven upload orchestration composes local profile validation, WAV decoding, VAD/ASR/diarization pipeline, and OpenAI-style response formatting; fake-engine end-to-end tests pass.
- [x] Chunked realtime push-to-talk session handler validates events and private context, commits to local ASR, and clears buffered audio on cancellation; stub-engine tests pass.
- [x] Contract-validated local TTS request orchestration checks the selected model and complete voice registry entries (permissive license, source, revision, hash), then returns bounded WAV or PCM; fake-engine tests pass.
- [x] Meeting notes and action items are stored through Knowledge with the requested readers and classification; action items require transcript quotes, and an integration test confirms cross-reader ACL filtering.
- [x] Generated API documentation updated; all speech tests included in `tools/check.py`.
- [ ] Integrate a locally licensed streaming ASR backend, VAD backend, TTS, and audio capture/output.
- [ ] Implement push-to-talk, file transcription with diarization, barge-in voice loop, and meeting-to-Knowledge integration.
- [ ] Record licensed dataset and model/voice provenance, revision, and hashes in the registry.
- [ ] Measure WER against an agreed numeric target and end-of-speech-to-first-audio p95 <800 ms on T1.

| Check | Observed result |
|---|---|
| Full offline `tools/check.py` | PASS |
| Foundation tests | 23/23 pass |
| Isolation/evaluation tests | 9/9 pass |
| Knowledge tests | 20 pass, 1 Windows symlink privilege skip (21 discovered) |
| Speech contract/interface tests | 45/45 pass, including 2 new buffer regressions; previous 46 count was incorrect |
| Speech profile and whisper.cpp adapter tests | 4/4 pass |
| Speech evaluation/runner tests | 8/8 pass |
| Ruff lint/format, CLI type checks, Python/frontend license scans | PASS; type checking currently covers the CLI only |
| T1 WER and voice latency | Unverified; model downloaded and hash verified, engine build has no completion result after WSL service failure; host is T0; WER thresholds set by ADR 0018 |

Phase 3 remains in progress and Phase 4 has not started because the Phase 3 exit gate
has not been verified. `evals/run_speech_asr.py` creates measured local ASR records;
`evals/speech_eval.py` scores them. Neither can substitute for a real T1 voice-loop run.

Latest verification: meeting authorization now precedes summarization, and encoded
audio is bounded before decoding. The source gate passed after both regressions were
fixed. The registry now pins a MIT whisper.cpp/tiny.en fallback candidate (ADR 0020),
without changing recommended profiles. Real inference remains unverified: WSL shell
creation failed with `Wsl/Service/0x8007274c` during the build attempt. See
`docs/speech-reference.md` for observed hashes, limitations and reproduction commands.
Earlier statements above about no model being provisioned describe earlier slices.

### Phase 3 ASR adapter slice

The machine check still reports Windows AMD64, 15.70 GiB RAM, Intel Iris Xe with
unverified VRAM, and T0. No usable audio endpoint or whisper.cpp binary was found.
The adapter's fake-process integration tests verify its WAV serialization, argv,
timeout, JSON parsing, and hash checks. This is not an inference or WER measurement.
The faster-whisper optional dependency was resolved and audited, then removed before
commit because its current transitive `tqdm` package includes MPL-2.0-licensed files;
see ADR 0017. The speech runtime dependency set remains unchanged.
