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
