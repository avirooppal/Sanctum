# Inference adapter
Rust Engine trait: send an OpenAI path and JSON body, receive status/content-type
and streaming reader. LocalEngine accepts only numeric IPv4 loopback URLs with a
port, disables environment proxies and redirects. Engine processes are launched
and hash-verified by gateway inside its isolated network namespace.

Config: profiles/runtime-cpu.json. No remote provider fallback. MLX is unverified.
Run `cargo test --locked --offline -p sanctum-inference`; full real-engine contract
suite is `uv run --offline python evals/sdk_chat.py --token-file PATH`.

Cancellation contract: `docs/contracts/cancellation-v1.md`. Runtime entry points
use additive `Engine::send_with_context`; legacy `send` stays source-compatible.
The initial default checks before starting only: in-flight HTTP interruption is
pending S0-3 and must not be inferred from this interface. Run the cancellation
integration tests with the ordinary inference crate suite.

The confined runtime bridge uses bounded one-input embedding subrequests to limit
vendor task queues. Global indices, encoding/model and summed usage remain OpenAI
compatible; failed batches never publish partial aggregates. Contract:
`docs/contracts/bounded-embeddings-v1.md`. Run its Rust contract tests and
`evals/sdk_batch_embeddings.py` against the ready reference runtime.
