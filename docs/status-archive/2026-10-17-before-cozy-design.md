# Current state

- Step:installation slice1;ADR0077;read-only install preflight.
- Last green:f8d15e097972095894b25bcffae4d6fb6b56b4a0;hosted39055449581/all5 completed success.
- Branch:codex/runnable-installation;preflight implementation pushed and exact-SHA CI verified.
- Gate:source182,Rust70/38 denial probes,web81/types/build,audit0 PASS.
- Real preflight:Ubuntu22 WSL exit0;busy/disk/missing/root/Windows refuse78.
- Smoke:15 implemented-feature stages PASS;full journeys/release remain OPEN.
- Blockers:no Linux/Windows installer,signature,clean-install or upgrade proof.
- Next3:finish/push slice1 and exact-SHA CI;Linux tar install lifecycle;deb/integrity.
- J1/J2 not VERIFIED;no release/phase tags;owner files preserved.

## Slice1 evidence

Contract:docs/contracts/install-check-v1.md. Implementation:apps/cli/sanctum/
install_check.py and cli.py. Tests:8 new,32 CLI total,182 source total.
Commands:bash tools/run_source_gate.sh;bash tools/check_rust.sh;apps/web npm
test,typecheck,build,audit --audit-level=low. Raw evals/results/install-check-*.
Real doctor --install-check used target/debug/sanctum-foundation,port8770,
unprivileged Ubuntu22 owner;all22 denial results required. RAM8167559168 bytes,
free890072842240 bytes at measurement;model readiness stays unverified.
Busy8769,required disk999999999999999,missing probe,root and native Windows
all refused78. These are source executions,not installed-artifact validation.
Baseline174/70/81/15 with38 probes and audit0;hosted baseline all5 completed.
Initial chat502 preserved;targeted clean runtime restart restored full smoke.
Startup readiness timeout and type-tool environment discovery failure retained;
correct VIRTUAL_ENV source gate passes. Malformed-probe test first exposed
TypeError;comparison now rejects non-string result safely;rerun passes.
All actual package installs,Windows host preflight,Ubuntu24 AppArmor concrete
policy,signing,offline/clean-install,upgrade,rollback/uninstall remain OPEN.
No native Windows containment or complete privacy/release claim.

## Preserved history

[Previous STATUS](status-archive/2026-10-17-before-installation-preflight.md),SHA256
`262d6be3780088df73951597389d836fdd9935c6e6c613040d524b36f4e202a3`. Narrative preserved verbatim;older linked archives unchanged.

Implementation commit:f8d15e097972095894b25bcffae4d6fb6b56b4a0;hosted run
39055449581 completed success,all5 jobs. Raw install-check-hosted-ci.json.
The documentation checkpoint has its own exact-SHA hosted verification after push.
