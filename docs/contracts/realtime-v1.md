# Sanctum realtime v1

Handshake: GET `/v1/realtime`, HTTP1.1 Upgrade websocket, Connection Upgrade,
version13, standard16-byte nonce, exact Host/Origin and protocols
`sanctum.realtime.v1, ticket.<64 lowercase hex>`. Ticket obtained from authenticated
empty POST `/v1/realtime/tickets`. No query parameters, owner tokens or cookies.
Return only the negotiated protocol, never the ticket. Duplicate headers fail.

Transport limits: overall24/voice2/shared guarded listener; header16KiB/64 fields,
handshake1800ms; frame64KiB, JSON4KiB; fragmented/unmasked/RSV frames rejected1002;
oversize1009; invalid UTF8/JSON1007; input sequence errors1008. Sessions900s,
ping15s/pong30s; frame delivery1800ms and1024B/s active-delivery budget. Idle sessions
hold a connection lease, never an engine/dispatcher slot. Shutdown closes listener,
then1001/cancel and release. Slow incomplete frames use the same stall/throughput
bound as HTTP upload. No compression/extensions negotiated.

JSON client controls: `config` (sample_rate16000), `start`, `stop`, `interrupt`,
`metrics`, `playback` (sequence acknowledged by the client). Unknown properties
and commands rejected. Each server JSON event has `type`, monotonic `sequence` and
`protocol`. Ready reports actual enabled capabilities; no invented transcripts or
model/TTS events. Speech pipeline integration belongs to Step1b/1c; until then
stop returns a clear capability-unavailable error and audio is discarded.

Binary input: little-endian uint32 sequence, uint32 sample count, signed PCM16 LE,
mono16000Hz;1..3200 samples/frame, exact length, consecutive sequence starting0
after start. Thirty-second/960000-byte PCM cap. Session buffer is bounded and
cleared on stop/interrupt/disconnect. Binary output in Step1c uses the same
sequence/sample-count prefix; playback acknowledgements never advance beyond sent
audio. Transcript partial/final, LLM deltas, TTS chunks and playback markers are
reserved event variants and cannot be emitted until their backend exists.

Audit initially uses existing content-free stderr mechanism: session opened/closed,
reason/counters only. Privacy Ledger integration is Phase5, not claimed here.
