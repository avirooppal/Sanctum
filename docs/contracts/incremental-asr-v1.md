# Incremental ASR v1

`IncrementalASR(engine, interval_seconds=2, max_seconds=30)` adapts an existing
ASREngine. `append(pcm_s16le)` accepts nonempty complete mono 16 kHz PCM16 frames;
at each configured interval it returns a full revised transcript snapshot, otherwise
None. `finish()` transcribes all accumulated audio and returns a final snapshot.
Snapshots have `revision` (increasing integer), `text`, `final`, `audio_seconds`.
Consumers replace prior text; they must not concatenate snapshots.

Audio is limited to 30 seconds; reject overflow before modifying state. Only one
inference may run per session. `cancel()` clears buffered audio and invalidates an
in-flight result. It does not terminate engine computation; that requires the
future process supervisor. No snapshot from a cancelled generation is delivered.
Errors clear audio. No downloads/network calls are added by this adapter. Hosting
must enforce the existing network confinement. This is bounded prefix re-decoding,
not a claim of native streaming model state or WebSocket support.
