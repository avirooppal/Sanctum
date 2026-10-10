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
- `services/speech/sanctum_speech/service.py`: validates upload requests against the
  OpenAPI contract, enforces the configured local profile, then composes decode,
  transcription, and response formatting. It also validates local TTS requests against
  a configured profile/voice and packages engine audio as WAV or PCM. It is not yet
  mounted on a network listener. Voice definitions must validate against the model
  registry schema, including license, source, revision, and artifact hash.
- `services/speech/sanctum_speech/realtime_session.py`: schema-validates authenticated
  session context and realtime events, buffers push-to-talk audio until commit, invokes
  the selected local ASR engine, and clears buffered input on cancellation. Microphone
  capture, partial streaming recognition, output TTS, and a WebSocket listener remain
  unimplemented.
- `services/speech/sanctum_speech/meeting.py`: requires a locally registered summary
  model, verifies action-item evidence against the transcript, and stores notes using
  Knowledge's owner check, reader ACLs, and data classification.
- `services/speech/sanctum_speech/responses.py`: OpenAI-style `json`, `text`,
  `verbose_json`, and `vtt` transcription response formatting.
- `docs/contracts/speech-profile.schema.json`: local engine paths and pinned hashes;
  profiles explicitly deny egress. `backends/whisper_cpp.py` invokes argv without a
  shell, writes temporary WAV/JSON files, enforces a timeout, and never downloads.
- Engine and model selection must come from a future hardware profile and model
  registry entry. Check the code, model, and voice license independently; the current
  license review and candidate sources are in `docs/PHASE-3-PLAN.md`.

## Hosted file transcription

The Linux Rust gateway can launch `worker.py` through its confined `--engine-child`
entry for each authenticated multipart upload. Add an optional `speech` object to
the existing runtime config:

```json
{"speech":{"python":"/absolute/locked-venv/bin/python","profile":"/absolute/speech-profile.json","model_id":"asr-whisper-tiny-en-reference"}}
```

The profile follows `speech-profile.schema.json`, selects explicit `vad.engine=none`
whole-file mode, sets `timeout_seconds` at most 120, and pins the local model and
executable hashes. Its ID/model hash must match the registry. No model is downloaded
by startup or requests. This hosted route uses the authenticated solo session;
Knowledge workspace selection and diarization are not implemented by this slice.
Uploads are at most 8 MiB, mono PCM16 16 kHz WAV. Gateway injects private context;
the official SDK needs only `model` and `file`. JSON, text, verbose JSON and VTT work.
The content-type allowlist includes the serializers' UTF-8 charset parameters.

Run the actual SDK integration after starting that configured gateway:

```bash
python evals/sdk_speech.py --base-url http://127.0.0.1:8766/v1 --token-file /absolute/local.token --audio /absolute/licensed.wav --model asr-whisper-tiny-en-reference --output evals/results/local-speech-sdk.json
```

Contract: `docs/contracts/speech-worker-v1.md`. Test modules: `test_multipart.py`,
`test_worker.py` and Rust `speech::tests`. TTS and realtime HTTP/WebSocket
hosting remain unavailable. A whole-file response is not streaming ASR or voice chat.

## Tests and evaluation

`backends/flite.py` supplies an opt-in CPU TTSEngine. Its v1 TTS profile pins the
executable containing the registered built-in voice data (ADR 0024). Voice cloning
and URL/file voice selection are unavailable. Preserve `docs/licenses/flite-COPYING.txt`.
Build reference: pinned source commit in registry, `./configure --with-audio=none
--disable-shared`, `make -j 1`. Run `evals/tts_smoke.py` under the isolation wrapper;
the exact executed command and measured WAV hash are in STATUS.md / speech-tts-smoke.json.
This non-neural reference generates WAV files; it does not establish device playback.

ASR profiles can select `whisper.cpp` or `parakeet.cpp`; `backends/factory.py` performs
the dispatch without a remote fallback. Parakeet uses a pinned local CLI, reports one
coarse clip segment and unknown detected language, and rejects vocabulary prompts.
`speech-parakeet-profile.json` records the tested reference. Keep
`docs/model-attributions.md` with redistributed model artifacts (ADR 0023).

For opt-in file VAD, select `vad.engine=silero.cpp` with registered model ID,
model/executable paths and SHA-256 pins, threads, and timeout at most 20s. The adapter
converts upstream centiseconds to validated seconds. Run `evals/vad_smoke.py --profile
PROFILE --audio WAV --output JSON` under `tools/isolated_run.py`. The exact reference
profile and real speech/silence results are in `speech-vad-smoke.json`.
`speech-sdk-vad.json` records 8/8 real SDK checks and a 36.004s first file request;
this is not streaming VAD or a voice-latency pass. No default profile enables it.

See [reference provisioning and reproduction](../../docs/speech-reference.md) for
the pinned fallback candidate, observed download hash and current WSL build failure.

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
