# Current state

- Authority: MISSION.md (Amendment1), WRAPUP.md, ADR0027; feature freeze active.
- Step: docs-first1a–1c; current-evidence coverage/checklist rewritten; frontend next.
- Last green source: `7cbc426d13b284856563c6e0a103f202b24557bf`, hosted run38145322030/all5 PASS observed.
- Baseline: source157/Rust57/web34 PASS;38 denial/startup probes;8 real smoke stages PASS.
- Additional probes: Linux WS13 PASS; Windows handshake<2s FAILED. Doctor exits1/no-fit at8167555072 bytes. Both retained, no thresholds changed.
- Open software gates: full UI,live voice,vision,agents/ledger,LAN,crypto,packaging/soak.
- Next3: commit audit/checklist and verify CI; history search/rename/delete; model/settings and U6 gates.
- Tags/main: no tags; ui-hermes-port not merged. Three pre-existing owner untracked paths untouched.

## Current work list and evidence

[PLAN_COVERAGE](PLAN_COVERAGE.md) is the section-by-section source of current
claims, with stable row IDs and fresh E1–E8 evidence. [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md)
tracks support,gates and owner-run commands. Both must change in every affected
code/test slice. Missing verifier commands are explicit open work,not invented.
[KNOWN_LIMITS](KNOWN_LIMITS.md) records software gaps and failed probes.

Commands actually run: `python tools/check.py`, `bash tools/check_rust.sh`,
`npm test --prefix apps/web`, `npm run typecheck --prefix apps/web`,
`npm run build --prefix apps/web`, `npm audit --audit-level=low --prefix apps/web`,
`bash tools/smoke_all.sh`; real meeting/microphone browser runners; Windows and
WSL `evals/realtime_transport.py`; `python -m sanctum doctor --json`.
The WSL test environment is /home/aviroop/.local/share/sanctum-dev-venv with
PYTHONPATH unset; runtime at127.0.0.1:8769 using .sanctum/runtime-dispatch.json.
Full raw outputs retained as evals/results/audit-refresh-*.
Linux realtime handshake1.877212s/partial-frame1.870464s PASS; Windows initial
assertion failure emitted no numeric sample. Doctor's recommendation=null is
not a successful recommended-profile gate. SDK8 PASS,chat3.5742s,TTFT0.5524s;
smoke timings are not controlled SLO benchmarks. Meeting5/emulated microphone4
PASS; no semantic-quality/physical-audio claim. Supervision3/zero survivors.
No software changed in the docs-first slice and no old long-load gate rerun claimed.

## Preserved history

Previous STATUS archived verbatim at
[pre-audit status](status-archive/2026-10-11-before-coverage-refresh.md), SHA256
`263e93ebcc8f8996d8d439bf97beaf50f3c32f60e12e7c06a628675d77b0a9e8`.
Old PLAN_COVERAGE archived verbatim at
[pre-audit coverage](status-archive/2026-10-11-plan-coverage-before-refresh.md), SHA256
`3697d6ac2d2a3e76c9f4ef58e3e07b063c2e35e7c3018bec09483eb5b3117932`.
Earlier measurements remain historical in those archives. The new audit does not
copy their completion claims. No measurement removed or rewritten.
