# Inference adapter v1

Rust Engine trait: send(path, JSON) -> engine status/content type/stream reader.
Only locally configured numeric loopback URLs are valid. Product code supplies
requests through the trait; llama.cpp implements OpenAI-compatible upstream HTTP.
No retries to cloud and no proxy environment variables. Runtime namespace confines
all engine processes, which repeat startup egress checks before exec.

Runtime config specifies executable and resource SHA-256, model IDs/files/hashes,
chat and embedding ports, thread/context settings. Registry holds license evidence.
Model identifiers live in config. Unknown model IDs and wrong modalities are errors.
Adapter errors return local API errors, never fabricated model output.
