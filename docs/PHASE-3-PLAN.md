# Phase 3: Speech

Plan for the first vertical slice, before implementation.

## Slice 1: contracts and engine seams

Tasks: specify OpenAI-compatible transcription and speech routes plus a versioned
WebSocket event protocol; validate those contracts; define stable interfaces for VAD,
streaming/file ASR, diarization, and TTS; provide strict local profiles and a dataset-
driven WER/latency report. Keep runtime engines injectable so implementations remain
swappable.

Interfaces: OpenAPI for `/v1/audio/transcriptions` and `/v1/audio/speech`; a JSON
contract for `/v1/realtime` messages; Python protocols for `VoiceActivityDetector`,
`ASREngine`, `Diarizer`, and `TTSEngine`.

Tests: required OpenAPI paths and schemas; reject oversized or malformed audio and
unknown fields; adapter conformance; deterministic VAD segment boundaries; ASR segment
timestamps and speaker labels; cancellation on barge-in; WER normalization and latency
measurement with a fake clock. No microphone, speaker, or GPU test may be marked passed
without the relevant hardware.

Risks: plan.md defines voice first-audio latency <800 ms on T1 but gives no numeric WER
target; ADR 0018 sets initial English LibriSpeech test-clean/test-other gates at 0.10/0.20.
This Windows host profiles as T0, and audio hardware is unavailable.
Model weights and TTS voices have licenses independent of their engine packages. No
model defaults or benchmark claims will be added until each artifact's license, source,
revision, and hash are verified. The Phase 3 exit remains blocked until WER and latency
metrics are measured on T1.

## Verified candidate components (2026-10-10)

## Security audit and real ASR verification slice

Tasks: authorize meeting ingestion before summarization; bound encoded audio before
decoding and avoid per-chunk memory overhead; build a pinned whisper.cpp fallback
and run real file ASR inside the Linux network namespace. Contracts: explicit Knowledge
authorization preflight and existing speech profile/benchmark schemas. Tests: reproduce
unauthorized summarizer calls and oversized decoding first, then run the full gate.
Risks: this T0 smoke test cannot establish T1 WER or voice-loop latency. Transcript
quote matching proves source presence, not semantic entailment of generated notes.

## Candidate sources

- faster-whisper code: MIT, reported by its project packaging metadata; the current
  locked dependency tree includes `tqdm` components declared MPL-2.0 AND MIT, so it is
  excluded by the permissive-only dependency rule (ADR 0017):
  [project license](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE),
  [tqdm license](https://github.com/tqdm/tqdm/blob/master/LICENCE).
- whisper.cpp core and CLI: MIT according to the upstream license. The adapter accepts
  only a locally provisioned executable and model file with profile-pinned SHA-256;
  optional non-MIT build features are not selected:
  [project](https://github.com/ggml-org/whisper.cpp),
  [license](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE).
- Whisper code and weights: MIT according to the official project card:
  [OpenAI Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md).
- English WER datasets: OpenSLR identifies LibriSpeech as CC BY 4.0. ADR 0018 sets
  test-clean <=10% and test-other <=20% weighted WER as initial T1 gates:
  [OpenSLR LibriSpeech](https://www.openslr.org/12/).
- whisper.cpp fallback: MIT according to its repository license:
  [whisper.cpp license](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE).
- Silero VAD project: MIT according to its repository metadata:
  [Silero VAD](https://github.com/snakers4/silero-vad).
- NVIDIA Parakeet TDT 0.6B v3 weights: CC-BY-4.0 per its model card. This permits
  commercial use with attribution but is not added as a default before profile and
  registry/license review:
  [Parakeet model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3).
- The archived Rhasspy Piper repository is MIT, but its voice artifacts have separate
  licenses and the engine is archived; do not select it as a default without a maintained
  compatible distribution and per-voice review: [Piper license](https://github.com/rhasspy/piper/blob/master/LICENSE.md).
- sherpa-onnx reports local streaming ASR, TTS, diarization, and VAD support; use only
  after pinning its Apache-2.0 code and separately verifying a selected model/voice:
  [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).
