# ADR 0020: GGML artifacts for the whisper.cpp fallback

Status: accepted, 2026-10-10.

The plan selects whisper.cpp as an ASR fallback and prefers GGUF/safetensors.
Upstream v1.9.5 still distributes Whisper weights as GGML `.bin` files. Permit
`ggml` in the model registry only for ASR-only entries. Product interfaces remain
engine-neutral. This does not select a new default or change hardware profiles.

Pin the MIT tiny.en conversion to its Hugging Face revision and LFS SHA-256. This
small model is a development smoke-test candidate, not evidence of meeting WER SLOs.
Code and weights require separate license records; successful provisioning does not
establish runtime containment or inference correctness.
