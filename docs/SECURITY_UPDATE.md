# Dependency security update — 2026-10-28

The reported npm vulnerabilities were addressed without a framework major upgrade:

- Next.js 15.1.7 → 15.5.28 (exact direct dependency).
- PostCSS 8.5.32, including Next.js's nested dependency through a scoped override.
- Sharp 0.35.5 through a scoped Next.js override, preventing selection of its
  older vulnerable optional dependency range.
- package-lock.json updated. npm audit reports **0 vulnerabilities** across
  all severities. This is a registry audit result, not a complete security audit.

Official release: https://github.com/vercel/next.js/releases/tag/v15.5.28

The distribution manifest now reads dependency versions from the lockfile instead
of hardcoded obsolete versions, and records the actual package creation time.

## Verification

- Clean frontend and Windows executable rebuild passed, including TypeScript.
- Architecture gate passed.
- Full tests: 197 tests; 189 passed, 6 skipped, 2 reported failures (the P4.1
  determinism assertion and its parent suite). The live model returned different
  poem wording during simultaneous build/test activity.
- Isolated sequential P1–P4 rerun: **26 passed, 0 failed, 0 skipped**, including
  the determinism check and all tests skipped in that full run. The inference
  implementation and assertions were not weakened or changed.
- Production root, invalid chat request validation, model discovery and Sharp
  image optimization smoke checks passed.
- Both EXEs' embedded archives match the fresh payload (49 files each).
  Portable archive integrity, frontend asset equality and release hashes passed.
- Desktop PE checks: ASLR, DEP and asInvoker passed. Native UI runtime behavior
  was not re-exercised during this dependency update.

## Artifacts

- dist/Sanctum.exe
- dist/Sanctum-Setup-1.0.0-x64.exe
- dist/Sanctum-Portable-1.0.0-x64.zip
- dist/SHA256SUMS

Logs: .cache/security-audit-before.json, .cache/security-audit-after.json,
.cache/security-tests.log, .cache/security-live-recheck.log,
.cache/security-exe-build.log. Earlier binaries remain in timestamped .cache
backup folders and should not be used in place of the patched dist artifacts.
