# Inference adapter
Rust Engine trait: send an OpenAI path and JSON body, receive status/content-type
and streaming reader. LocalEngine accepts only numeric IPv4 loopback URLs with a
port, disables environment proxies and redirects. Engine processes are launched
and hash-verified by gateway inside its isolated network namespace.

Config: profiles/runtime-cpu.json. No remote provider fallback. MLX is unverified.
Run `cargo test --locked --offline -p sanctum-inference`; full real-engine contract
suite is `uv run --offline python evals/sdk_chat.py --token-file PATH`.
