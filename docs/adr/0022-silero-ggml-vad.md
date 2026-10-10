# ADR 0022: Silero VAD through the pinned whisper.cpp runtime

Accepted 2026-10-10. Reuse whisper.cpp v1.9.5's MIT VAD executable with the separately
MIT-licensed Silero v6.2.0 GGML conversion. This implements the existing replaceable
VoiceActivityDetector protocol without adding a Python ML dependency or writing a
detector. Extend ADR 0020's GGML allowance to VAD-only entries as well as ASR-only.
Mixed or text GGML capabilities remain rejected. No hardware defaults change.

Add the `silero.cpp` discriminator and optional artifact fields to speech profile
schema v1.0. Conditional requirements apply only to this new discriminator; previously
valid `none` and `silero` profiles remain schema-valid. Legacy `silero` has no runtime
implementation and still fails closed. Pin executable and model hashes, registry ID,
thread count and timeout. No automatic model download.

The upstream executable emits centiseconds (confirmed in source and real output),
despite README examples showing second-like values. Convert to seconds, reject missing
or malformed output, and validate ordering and bounds. File VAD adds latency; this
does not establish streaming end-of-utterance detection or the voice SLO.
