# ADR 0023: Second local ASR adapter and weight attribution

Accepted 2026-10-10. Use the pinned MIT whisper.cpp v1.9.5 Parakeet executable as
the second ASR implementation, selected by `asr.engine=parakeet.cpp`. This is an
additive discriminator in speech profile v1.0; existing Whisper profiles are unchanged.
Both implement ASREngine; no product code selects model names.

The conversion repository is named `parakeet-GGUF`, but the downloaded Q4_K file
begins with `lmgg` (legacy GGML), not `GGUF`. Record the inspected format as `ggml`
under ADR 0020 rather than trusting repository tags. Source and SHA-256 stay pinned.

The converted Parakeet model card labels the conversion MIT, but its NVIDIA source
weights are CC-BY-4.0. Preserve both with registry license `MIT AND CC-BY-4.0`, required
attribution and upstream provenance. CC-BY permits commercial reuse and adaptation
with attribution; it is not a non-commercial license. This exception is only for
model weights; the software dependency license policy is unchanged. Do not claim the
conversion label removes NVIDIA's conditions. See `docs/model-attributions.md`.

This CLI provides text-file output, not structured timestamps or forced language.
The adapter reports one coarse segment covering the supplied clip and no detected
language. The language argument is a hint only; nonempty vocabulary prompts are
rejected explicitly. This does not implement diarization or live streaming input.
Use VAD externally when configured; retain the 150s hosted worker deadline.
