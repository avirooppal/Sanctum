# Implementation status

Updated: 2026-10-08. Source of truth: ../plan.md. Phase 0, slices 1–2 implemented.
Phase 1 starts after the Phase 0 completion commit below. Placeholder service directories are not implementations.

| Phase | State | Exit criteria / evidence |
|---|---|---|
| 0 Foundations | done (Linux x86_64) | Doctor tier/profile passes; real isolated HTTP ingress, exec inheritance and egress startup probes pass. Other runtime platforms fail closed. |
| 1 Chat | not started | Clean install to answer <5 min; official OpenAI SDK compatibility: unverified. |
| 2 Knowledge | not started | Hybrid beats vector-only on recall and faithfulness: unverified; numerical margin pending. |
| 3 Speech | not started | T1 voice latency <800 ms and WER target: unverified; WER target pending. |
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
