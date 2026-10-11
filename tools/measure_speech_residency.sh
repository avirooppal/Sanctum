#!/usr/bin/env bash
# Explicit offline developer setup; no download or product startup.
set -euo pipefail
if [ "$#" -ne 7 ]; then
  echo 'usage: measure_speech_residency.sh SOURCE BUILD RUNTIME PYTHON MODEL AUDIO FLITE' >&2
  exit 2
fi
cd "$(dirname "$0")/.."
c++ -O2 -I"$1/include" -I"$1/ggml/include" -I"$1/examples" \
  tools/speech_residency.cpp "$2/examples/libcommon.a" "$2/src/libparakeet.a" \
  "$2/src/libwhisper.a" "$2/ggml/src/libggml.a" "$2/ggml/src/libggml-cpu.a" \
  "$2/ggml/src/libggml-base.a" -ldl -lm -pthread -fopenmp \
  -o .sanctum/speech-residency-probe
cargo build --locked --offline -p sanctum-gateway --example speech_residency
target/debug/examples/speech_residency "$3" "$4" \
  --probe .sanctum/speech-residency-probe --model "$5" --audio "$6" --flite "$7" \
  --output evals/results/speech-residency-reference.json
