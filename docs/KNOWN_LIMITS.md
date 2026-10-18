# Known limits

Current audit: PLAN_COVERAGE.md and RELEASE_CHECKLIST.md. This is not a release.

- Existing Linux CPU chat,RAG,file-ASR/TTS and scoped browser smoke are verified;
  full live voice,vision,governed agents,ledger,LAN TLS and encryption are incomplete.
- No packet-capture/ledger reconciliation exists. Kernel denial probes establish
  only their tested process boundary, not full-product privacy or hostile-code safety.
- Current WSL RAM is8167555072 bytes; doctor finds no profile at the configured8GiB
  floor. Profiles/fit estimates need work; this audit does not lower the threshold.
- Windows-side raw WebSocket probe failed the unchanged2s handshake-release bound.
  Linux rerun passed. The cause is not established; preserve both records.
- ASR fixture smoke is not a WER corpus. Emulated audio is not physical audio.
  Voice latency requires the complete WebSocket path and T1 hardware measurement.
- Knowledge supports Markdown/text-PDF; no verified OCR,page-region overlays or
  comparative real-document quality gate in this session.
- UI fidelity,complete accessibility and all-screen HTTP/WS egress remain open.
- No verified signed release artifacts,one-hour complete-workload soak or final
  README-only fresh-clone acceptance. Hardware verifier blanks block release.
- Optional visual retrieval,extra UI polish and Phase7 remain unfinished. No new
  scope cut was made in this docs slice. Future cuts require recorded decisions;
  team-only exclusions remain ADR0027.

## Workflow alignment safety limits

Full purge is hidden pending a transactional/cancellable implementation. ADR0075 disables the legacy HTTP mutation:valid requests return501 without
deleting data. This is not an implementation of full or secure erasure.
The old25-case browser_e2e_suite uses canned API replies;it is fixture coverage,
not real journey acceptance. Full journey action/chaos/ledger proof is pending.

Installation:ADR0077 selects Linux tar/deb and a dedicated-WSL Windows launcher.
Only source preflight is tested;no downloadable installer/package has been
verified. Windows host preflight,rootfs trust/signatures,Ubuntu24 executable
AppArmor policy,clean installs,upgrades and uninstall remain software work.
Never bypass containment to use an unsupported platform. macOS unsupported.

Redesign is partial:S1 iteration1 is real and verified;the remaining screens,
full state captures,all-theme accessibility/contrast,axe/zoom/performance and
further critique iterations are pending. Historical standalone browser_shell/
browser_themes target pre-auth controls and need contract migration before
reuse;the current16-stage real smoke passes. No whole-redesign claim.

S1 iteration3 (2026-10-18): stable two-line startup chip; guarded owner accent
also controls focus. Preferences now serialize the actual preference object,
not the Content-Type header object; API test and browser readback cover it.
Malformed historical preferences are preserved with an honest recovery notice.
Unsupported deletion Undo and local-only message deletion are hidden. Metadata
floor is12px;notification duration remains5s without a layout-width animation.
Evidence:evals/results/redesign-round3-*;182 source,70 Rust,89 web tests,
typecheck/build,audit0,38 kernel probes;18 implemented smoke stages. Authenticated
shell runner covers5 widths;theme runner covers96 samples and3 system checks.
Unlock primary48px,contrast6.85586/7.16261;focus6.23336/5.83256;no foreign requests
or page errors. Actual archived-baseline rebuild:JS+862/CSS+739 gzip bytes.
Full redesign and release are NOT verified. Native Chrome reports zoom2 and
711x402 CSS viewport, but screenshot inspection finds clipped content despite
root overflow=false: zoom accessibility gate FAILED, not a passing claim.
See ui-after/round-3/native-zoom/review.json. Capture/layout diagnosis,axe,
all-theme contrast,streaming/performance and S2-S7 remain open. No tag or merge.

Liquid landing:reference footage is rights-blocked(see landing-media.md);
original local SVG artwork renders instead. Real video behavior is UNVERIFIED
despite clock-unit coverage. No newsletter/signup/social-account backend exists,
so those controls are replaced with real links. Full accessibility/performance/
pixel-fidelity and the larger release requirements remain open.
