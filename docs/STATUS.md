# Implementation status

Updated: 2026-10-08. Source of truth: ../plan.md. Phase 0, slice 1 implemented.
No later phase has started. Placeholder service directories are not implementations.

| Phase | State | Exit criteria / evidence |
|---|---|---|
| 0 Foundations | in progress | Doctor prints hardware tier/profile: passed. Expanded early privacy foundation remains incomplete. |
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
- [ ] Transport-aware, per-service egress enforcement and process containment.
- [ ] Native Windows/macOS containment (unverified/unsupported; no services start).
- [ ] Complete GPU/VRAM/CPU-feature/NPU support matrix; real Apple/NVIDIA checks.
- [ ] Rust control-plane toolchain/contracts and executable service foundation.

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
service_start_allowed=false. The Linux prototype has no service transport or hostile
code isolation; it must not be used to claim production privacy. No ACL, injection,
container, GPU/audio, SDK, load or application E2E tests exist yet. They remain gated
requirements for their owning phases, not passing placeholders.

Next: build Rust service contracts and a transport-aware isolated launcher with
per-service egress tests. Revisit the conservative 15.70 GiB -> T0 decision after
actual model fit measurements. ADRs 0001–0004 record current choices; no approval
is required to reproduce this slice. Phase 1 stays blocked until Phase 0 is complete.
