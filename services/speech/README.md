# Speech service

Phase 3 currently provides the versioned API and streaming event contracts, an
engine-neutral Python pipeline, and a tested whisper.cpp file-ASR adapter. The adapter
requires local executable/model files with SHA-256 values pinned in the speech profile.
No engine binary, model weights, VAD, diarizer, TTS voice, network listener, or
microphone integration is provisioned or started yet. Cloud processing is disabled by
contract; service execution remains subject to the foundation's fail-closed runtime
policy.

## Contract and configuration

- `docs/contracts/speech.openapi.json`: OpenAI-compatible transcription and speech
  endpoints, with explicit workspace and privacy context.
- `docs/contracts/speech-stream.schema.json`: versioned realtime WebSocket messages,
  including audio, transcript, speech output, cancellation, and errors.
- `services/speech/sanctum_speech/interfaces.py`: replaceable VAD, ASR, diarization,
  and TTS protocols. `pipeline.py` composes VAD, ASR, and optional diarization.
- `services/speech/sanctum_speech/realtime.py`: bounded realtime PCM accumulation
  with strict base64 decoding, consistent sample format, and an aggregate byte cap.
- `services/speech/sanctum_speech/audio_io.py`: bounded decoder for uncompressed mono
  PCM16 WAV at 16 kHz; unsupported containers and truncated files fail closed.
- `services/speech/sanctum_speech/responses.py`: OpenAI-style `json`, `text`,
  `verbose_json`, and `vtt` transcription response formatting.
- `docs/contracts/speech-profile.schema.json`: local engine paths and pinned hashes;
  profiles explicitly deny egress. `backends/whisper_cpp.py` invokes argv without a
  shell, writes temporary WAV/JSON files, enforces a timeout, and never downloads.
- Engine and model selection must come from a future hardware profile and model
  registry entry. Check the code, model, and voice license independently; the current
  license review and candidate sources are in `docs/PHASE-3-PLAN.md`.

## Tests and evaluation

Run the full offline repository gate from the root:

```powershell
uv run --offline --group dev --group knowledge python tools/check.py
```

Run speech tests only:

```powershell
uv run --offline --group dev --group knowledge python -m unittest discover -s services/speech/tests -v
uv run --offline --group dev --group knowledge python -m unittest discover -s evals/tests -v
```

Evaluate a licensed, schema-conforming local dataset without network access:

```powershell
uv run --offline --group dev --group knowledge python evals/speech_eval.py --input path/to/suite.json --output evals/results/speech.json
```

Run actual file transcription from a local manifest and profile (the profile's
whisper.cpp executable and model must already exist locally and match their pinned
SHA-256 values):

```powershell
uv run --offline --group dev --group knowledge python evals/run_speech_asr.py --manifest path/to/manifest.json --profile profiles/speech/cpu.json --output evals/results/speech-asr.json
uv run --offline --group dev --group knowledge python evals/speech_eval.py --input evals/results/speech-asr.json --output evals/results/speech-metrics.json
```

The benchmark manifest uses `docs/contracts/speech-benchmark.schema.json`. Audio must
be locally staged, hash-pinned, mono 16 kHz PCM16 WAV, at most 64 MiB per record, and
resolve within the manifest directory. The runner has no dataset download behavior.
Use locally staged LibriSpeech `test-clean` or `test-other` WAVs with their
`CC-BY-4.0` attribution and record provenance; it reports measured results only when
the local runtime and data exist. ASR-only runs do not report voice-loop metrics or
claim the Phase 3 latency gate.

The evaluator reports corpus and per-language WER and real-time factor. When separate
voice-turn measurements are supplied, it also reports p50/p95/max first-audio latency
and barge-in success. Phase 3 latency is gated at p95 <800 ms on
T1 hardware (ADR 0016). ADR 0018 sets initial English WER gates for LibriSpeech
test-clean (<=0.10) and test-other (<=0.20); the suite must pass its explicit
`wer_target`. No hardware measurement is claimed by this initial slice.
