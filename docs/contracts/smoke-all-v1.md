# Offline smoke entry point v1

`bash tools/smoke_all.sh` runs against a configured local gateway on8769, with
explicit token-file, recorded WAV, ASR/TTS IDs and browser runtime supplied via
environment variables. It runs real SDK chat, upload/retrieve/cited answer,
file ASR and TTS, ticket HTTP admission and real browser dictation/playback flows.
Any stage failure fails the command, preserves output and stops. Credentials
are never printed. Existing fixed-path historical results are preserved bytewise.

This initial implemented-feature scope is **not release acceptance**: real
WebSocket voice/barge-in/diarization, vision, agents/approval/ledger, LAN and
fresh-clone installation are still pending. The result explicitly lists them;
`SANCTUM_RELEASE_GATE=1` refuses success while any remain. Extend the command
as those backends land; final acceptance still requires all five offline flows.
Missing browser/assets/runtime is a failure, never a skipped test.
