# ADR 0026: Bounded prefix decoding for portable incremental ASR

Accepted 2026-10-10. Existing verified Whisper/Parakeet CLI engines transcribe files.
Expose incremental revised snapshots using bounded prefix re-decoding behind the
same ASREngine interface, without introducing another engine or dependency. Retain
all audio only up to 30 seconds, serialise inference, and invalidate stale results
on cancellation. This enables honest partial-output measurement on current CPU.

Repeated decoding costs more than native streaming and CLI startup remains in the
measurement. Do not claim the 800ms SLO, native streaming, a hosted realtime route,
or server process cancellation. Those remain separate implementation requirements.
