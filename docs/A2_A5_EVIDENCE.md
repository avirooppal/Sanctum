# A2–A5 retained-function audit

This slice audits M0 retirement; it does not certify a new desktop.
ADRs0087/0088 record the coverage repair, dead-code removal and history index.

## Evidence observed

- `npm test --prefix apps/web`: 34 tests passed; a2-web.log.
- `npm run build --prefix apps/web`: passed; a2-build.log.
- `npm run typecheck --prefix apps/web`: passed.
- `npm audit --prefix apps/web --audit-level=low`: zero vulnerabilities.
- `bash tools/run_source_gate.sh evals/results/a2-source.log`: exit0,
  all foundation source gates passed, license/secret/workflow checks passed.
- First restored real HTTP run: FAIL, TimeoutError searching sessions after
  saving a real chat; a2-retained-state-first.json/.log. The exact pre-formatting
  script executed is preserved as a2-retained-state-first-executed-source.txt.
- Read-only database diagnostic: 3,716 conversations, 3,717 turns, no turns
  index; correlated search interrupted at15.000858 seconds. No contents exported.
- `cargo test --locked --offline -p sanctum-gateway --test sessions
  populated_history_search_fits_existing_metadata_deadline -- --nocapture`:
  tiny-payload fixture passed before the fix (3.20s total; a2-history-red.log);
  representative4KB-payload fixture FAILED at29.656911s
  (a2-history-representative-red.log). With migration0005 it passed in0.40s
  total including two searches/reopens (a2-history-green.log).
- `bash tools/check_rust.sh`: exit0;71 Rust tests,92 reviewed crate licenses,
  22 foundation plus16 runtime/exec-child denial probes; supervision scenarios
  leave zero surviving processes (a2-rust.log).
- Rebuilt release runtime, same configuration/metadata deadline:
  a2-retained-state-fixed.json PASS on all10 recorded HTTP checks.
- `bash tools/smoke_all.sh` with the existing provisioned real runtime/token,
  audio/voice and Playwright environment: exit0; all9 stages passed
  (a2-smoke-all-reference.json and named a2-smoke-* logs). Full journey and release
  acceptance remain explicitly false.

Raw logs are under evals/results/. No timeout or acceptance threshold was
relaxed. The original A1 measurements continue to describe their pinned revisions.

## Scope and review

TEST_REMOVAL_AUDIT.md reconciles187→183 source,95→45 web,19→8 smoke.
It identifies the HTTP and dependency-check coverage lost in retirement;
ADR0087 restores those assertions. A3 removes five M8-only helper files and
their11 tests, leaving six modules with concrete M3 consumers (UI_MODULE_RETENTION).
The new HTTP stage makes smoke9 stages; source/Rust backend coverage is retained.

STATUS history is preserved byte-for-byte in the linked archive with SHA256.
Merge timing is PROVISIONAL: recommend keeping main unchanged until a usable
M3 desktop; the owner decides. No merge, new tag or release is performed.
