# ADR0049: Direct admitted realtime transport

2026-10-11. Use pinned Tungstenite0.30.0 raw-frame codec (MIT OR Apache-2.0,
upstream docs and downloaded source verified), without TLS/client/url features.
The guarded ingress handles WebSocket sessions directly after its existing header
and overall/lane admission. Sessions never enter tiny_http's accept threads or
hold dispatcher workers. HTTP remains on its existing bounded private relay.
Reject non-final frames explicitly; no extension/compression negotiation. Reuse
bounded response writer and request-side15s/1800ms/1024B/s upload policy for frames.
Frame codec buffers are bounded128KiB plus frame64KiB; PCM capped960000 bytes.

Add hierarchical cancellation: each turn has its own deadline, capped by session
parent; interrupt cancels only turn, parent shutdown/disconnect propagates to
engine checks. This is additive to existing Cancellation API, not a timeout change.
Protocol/audio buffer handling first; actual warm ASR/LLM/TTS pipeline is Step1b–1c.
Ready advertises only transport capability until those exist; no fake events.
ADR0047 held-session/latency/cap bounds remain unchanged. No gate pass claimed.

Primary references: https://docs.rs/tungstenite/0.30.0/tungstenite/protocol/frame/struct.FrameSocket.html
and downloaded crate's LICENSE-MIT/LICENSE-APACHE and src/protocol/frame.

Measurement supplement: original180s mixed-engine workload rerun first, PASS
181.419s/all unchanged latency/resource limits. Add opt-in --held-websocket;
default upload workload remains intact. New mode holds one authenticated session
with real ping/pong throughout mixed chat/ingest/file-ASR/TTS load, leaving one
voice connection available. Client250ms receive timeout is polling, never a
session timeout; request/heartbeat/SLO/queue/RSS thresholds unchanged.
