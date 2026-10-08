# Sanctum

Private local AI platform. Architecture and phase gates: [plan.md](plan.md).
Working Linux x86_64 reference: confined llama.cpp chat/embeddings, local auth,
SQLite history, React/Tailwind UI, verified offline artifact import.

## Five-minute offline bundle quickstart

Requires Linux x86_64 with user/network namespaces, glibc, libstdc++, libgomp,
and libssl3. WSL Ubuntu 22.04 is verified. Native Windows/macOS runtime is unsupported.
With the development bundle already available, copy its contents into an empty
folder, then run from that folder:

```sh
bin/sanctum-runtime --config profiles/runtime-cpu.json
```

Open http://127.0.0.1:8765 and enter the key from the printed token-file path.
The key is only held in browser memory. Runtime startup verifies all engine/model
hashes and kernel egress denial; failures prevent startup. Cloud is disabled.

Measured offline bundle copy through first answer: **50.6005 seconds** in a fresh
Linux container. Downloads, compiling, and creating the bundle are excluded;
this is an unsigned development artifact, not the Phase 6 signed release.

## Source setup

Install uv/Python 3.12, Rust 1.99.0, Node 20.19+; these developer setup commands
explicitly access package registries. Runtime services never download anything.

```sh
uv sync --locked
uv run --offline sanctum doctor
cargo fetch --locked
npm ci --prefix apps/web
npm run build --prefix apps/web
uv run --offline sanctum estimate chat-tiny-q8
uv run --offline sanctum pull chat-tiny-q8 --allow-network
uv run --offline sanctum pull embed-small-q8 --allow-network
uv run --offline sanctum pull llama-cpu-linux --allow-network
```

Artifact IDs and immutable URLs are in profiles/artifacts.json. Extract the engine
archive into .sanctum/engines/llama-b11429, preserving its library layout, then:

```sh
python3 tools/configure_reference.py
cargo build --locked --offline --bin sanctum-runtime
target/debug/sanctum-runtime --config profiles/runtime-cpu.json
```

For a development bundle, run `python3 tools/build_dev_bundle.py` on Linux after
building. Offline import uses `sanctum pull ID --from-file PATH` instead of network.

## Validation

```sh
uv run --offline python tools/check.py
bash tools/check_rust.sh
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
uv run --offline python evals/sdk_chat.py --token-file ~/.local/share/sanctum/local.token
```

SDK validation requires the running reference runtime. See [status](docs/STATUS.md),
[architecture](docs/architecture.md), [threat model](docs/threat-model.md),
[profiles](docs/profiles.md), and [API contracts](docs/api.md).

