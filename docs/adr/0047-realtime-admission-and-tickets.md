# ADR0047: Realtime session admission and tickets

Proposed 2026-10-11, before transport implementation/measurement.

Use a same-origin authenticated POST to issue a single-use 256-bit random ticket,
bound to exact Origin. Keep only its SHA256 in memory; expiry30s, pending cap32.
Consume atomically, including rejected origin attempts; no URL/query credentials,
no persistent browser storage, no ticket/token in logs. Browser handshake carries
the ticket in a subprotocol and negotiates `sanctum.realtime.v1` only. Missing,
duplicate or mismatched Origins fail closed; native callers must supply the same
explicit origin. Product remains local; no CORS allow-all/native bypass.

Guarded session admission uses existing overall24/voice2 limits and listener;
session processing must not hold a voice dispatcher/engine slot while idle.
Keep HTTP330s deadline. WS session hard lifetime900s permits the required held
gate; idle ping interval15s/pong deadline30s, fragmented frames rejected, masked
client frames only, frame cap64KiB, bounded message/control queues. Existing
1800ms blocked-write/1024B/s active-delivery bounds and request cancellation apply.
Per-turn deadline remains bounded by both session expiry and existing engine bound.
Session disconnect/shutdown cancels its turns; explicit turn cancel does not close
the session. Protocol/engine work lands incrementally, no placeholder speech claims.

Held gate predeclared: attempt3 simultaneous authenticated sessions (voice cap2),
assert third quickly shed503/Retry-After, hold admitted2 for at least600s with
ping/pong, record health/models p95<=250ms, resource/queue bounds per ADR0041 and
quiescent leak tolerance per ADR0028. Mixed speech workload holds1 session so a
second voice connection remains available; same180s/lane limits as ADR0041.
No held-session pass until actual WebSocket transport is tested. Proposed values
are new transport limits;900s is deliberately separate from HTTP330s.
