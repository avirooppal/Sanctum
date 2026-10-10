# Reproducing the local ASR check

## Recovery and real execution, 2026-10-10

The affected WSL distribution was restarted; the build completed with `-j 1`.
Executable SHA-256: `5d06d1e07e4b8b5dd29d41b034a0290a06fc984e4ad767d4810bc2d3289c27a0`.
The pinned upstream `samples/jfk.wav` (11 seconds) has SHA-256
`59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e`.
The excerpt is President Kennedy's public-domain inaugural address; reference text:
[National Archives](https://www.archives.gov/milestone-documents/president-john-f-kennedys-inaugural-address).
Audio source: [pinned upstream sample](https://github.com/ggml-org/whisper.cpp/blob/d1be6fde11ac6e0407606b4e42fe72d34add8037/samples/jfk.wav).

Actual invocation from the repository on Linux (with locked dependencies installed):

```bash
python3 tools/isolated_run.py -- /home/aviroop/.local/share/sanctum-dev-venv/bin/python evals/run_speech_asr.py --manifest .sanctum/speech-smoke/manifest.json --profile .sanctum/speech-smoke/profile.json --output evals/results/speech-jfk-smoke.json
/home/aviroop/.local/share/sanctum-dev-venv/bin/python evals/speech_eval.py --input evals/results/speech-jfk-smoke.json --output evals/results/speech-jfk-smoke-metrics.json
```

`evals/results/speech-jfk-provenance.json` contains the exact manifest and profile;
copy those objects into the indicated local files and copy the pinned upstream WAV
beside the manifest. Adjust local paths and verify a newly compiled executable hash
before repeating on another host. Do not assume binaries from other builds hash identically.
Result: 4 network-denial probes passed; 1 real file transcribed; WER 0/22 words,
1.109763671s processing, RTF 0.100887606. This is a smoke test on T0, not a quality
corpus or voice-loop/T1 gate. The failure record below is retained as history.

This is a development fallback check, not the Phase 3 acceptance benchmark. The
reference model is registry entry `asr-whisper-tiny-en-reference`; hardware defaults
are unchanged. ADR 0020 explains its legacy GGML format.

## Observed provisioning on 2026-10-10

- whisper.cpp v1.9.5 resolves to source commit
  `d1be6fde11ac6e0407606b4e42fe72d34add8037`; its source LICENSE is MIT.
- Hugging Face revision `5359861c739e955e79d9a303bcbc70fb988958b1`
  declares MIT. Downloaded `ggml-tiny.en.bin` is 77,704,715 bytes and its measured
  SHA-256 matches the registry/published LFS hash:
  `921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f`.
- CMake 3.22.1 was installed in Ubuntu 22.04. Compilation was launched with four
  jobs, but no completion status or executable hash was obtained. New WSL shell
  attempts failed with `Wsl/Service/0x8007274c`. The cause is not established.
- No ASR execution, dataset result, containment result or voice SLO is claimed.
  No global WSL restart was performed because other distributions were running.

Source/build/download logs were directed to `/opt/sanctum-speech/{clone,configure,
build,download}.log` inside Ubuntu-22.04. Inspect them once that distribution responds.
The source and model are staged there; they are not committed to Git.

## Resume in a functioning Linux environment

After explicitly provisioning the registry's pinned source and model, verify them
and build with one job to limit peak resource use:

```bash
set -eu
cd /opt/sanctum-speech
test "$(git -C source rev-parse HEAD)" = d1be6fde11ac6e0407606b4e42fe72d34add8037
printf '%s  %s\n' 921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f ggml-tiny.en.bin | sha256sum -c -
cmake -S source -B build -DCMAKE_BUILD_TYPE=Release -DGGML_OPENMP=OFF -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF
cmake --build build --target whisper-cli -j 1
sha256sum build/bin/whisper-cli
```

Create a local profile conforming to `docs/contracts/speech-profile.schema.json`
with the measured executable hash, registry model hash, absolute paths, thread count,
`vad.engine=none` and `egress=denied`. This field is a requirement, not enforcement.
Stage licensed mono 16 kHz PCM16 WAVs and human reference transcripts in a manifest
conforming to `speech-benchmark.schema.json`, including each audio hash and license.
Use T0 for this host. Do not repurpose a smoke-test WER target as a LibriSpeech gate.

Run the existing scripts from the repository with a Linux Python environment containing
the locked development dependencies. The wrapper first verifies IPv4/IPv6 TCP/UDP
denial, and fails closed if a network namespace cannot be established:

```bash
python tools/isolated_run.py -- python evals/run_speech_asr.py --manifest /absolute/manifest.json --profile /absolute/profile.json --output evals/results/local-speech-asr.json
python evals/speech_eval.py --input evals/results/local-speech-asr.json --output evals/results/local-speech-metrics.json
```

The namespace wrapper is development containment, not an adversarial agent sandbox.
Before distributing a compiled engine, audit linked libraries and produce its SBOM;
the recorded upstream MIT license alone does not certify all system dependencies.
Phase 3 still needs real VAD/TTS/diarization integration, complete LibriSpeech gates
on T1, and end-of-speech-to-first-audio p95 below 800 ms with barge-in measurements.
