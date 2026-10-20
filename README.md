# Sanctum Desktop — development pivot

Sanctum is being rebuilt as a local-first desktop app with optional engines,
explicit network controls, tools and MCP. The new desktop is PENDING. There is no
end-user UI or verified installer at this checkpoint. The public website, docs
site and old Hermes-style shell have been retired under [ADR0085](docs/adr/0085-retire-legacy-ui.md).
Do not open the old local UI URL: it now returns 404.

The retained Linux/WSL runtime supports local inference, auth, engine supervision,
SQLite history and existing knowledge/speech APIs. Windows/macOS native runtime,
new desktop onboarding, model manager, settings, tools/MCP, providers and computer
use remain pending. Python belongs to existing development/engine paths; the new
Rust-only core/optional pack split has not been implemented.

[plan.md](plan.md) is the ground truth. See [STATUS](docs/STATUS.md),
[performance evidence](docs/PERFORMANCE.md), [release checklist](docs/RELEASE_CHECKLIST.md)
and [required journeys](docs/WORKFLOW.md). No desktop performance or whole-product
security claim follows from legacy runtime checks. `apps/web` is now a development
reuse library with no HTML entry point, documented in [UI provenance](docs/ui-provenance.md).

## Source setup

Install uv/Python 3.12, Rust 1.99.0, Node 20.19+; these developer setup commands
explicitly access package registries. Runtime services never download anything.
Run the runtime/build commands on Linux or inside WSL. Native Windows can run doctor,
Python source tests and the web build, but cannot launch the confined service.

```sh
uv sync --locked --group knowledge
uv run --offline --group knowledge sanctum doctor
cargo fetch --locked
npm ci --prefix apps/web
npm run build --prefix apps/web
uv run --offline --group knowledge sanctum estimate chat-tiny-q8
uv run --offline --group knowledge sanctum pull chat-tiny-q8 --allow-network
uv run --offline --group knowledge sanctum pull embed-small-q8 --allow-network
uv run --offline --group knowledge sanctum pull llama-cpu-linux --allow-network
```

Artifact IDs and immutable URLs are in profiles/artifacts.json. Extract the verified
engine archive preserving its library layout, then:

```sh
mkdir -p .sanctum/engines
tar -xzf .sanctum/artifacts/llama-b11429-bin-ubuntu-x64.tar.gz -C .sanctum/engines
python3 tools/configure_reference.py
cargo build --locked --offline --bin sanctum-runtime
target/debug/sanctum-runtime --config profiles/runtime-cpu.json
```

For a development bundle, run `python3 tools/build_dev_bundle.py` on Linux after
building. Use `--output /path/to/new-bundle` for another run; existing destinations
are never overwritten. Offline import uses `sanctum pull ID --from-file PATH` instead of network.
For an isolated verification session, set `state_dir` in `profiles/runtime-cpu.json`
to a new empty directory before launch; pass `--port 8767` if 8765 is occupied.
Use that session's printed token-file path and base URL for SDK validation.

## Validation

```sh
bash tools/run_source_gate.sh
bash tools/check_rust.sh
npm run typecheck --prefix apps/web
npm test --prefix apps/web
npm run build --prefix apps/web
uv run --offline --group knowledge python evals/sdk_chat.py --token-file ~/.local/share/sanctum/local.token
```

SDK validation requires the running reference runtime. See [status](docs/STATUS.md),
[architecture](docs/architecture.md), [threat model](docs/threat-model.md),
[profiles](docs/profiles.md), and [API contracts](docs/api.md).

## Implemented-feature smoke

With the configured local service running on8769, run `bash tools/smoke_all.sh`.
Supply `SANCTUM_CONFIG`, `SANCTUM_TOKEN_FILE` (file path, never the key itself),
`SANCTUM_AUDIO` (16kHz mono recorded WAV), `SANCTUM_PYTHON` (provisioned dev venv),
`SANCTUM_NODE`, `SANCTUM_PLAYWRIGHT` (installed package path) and
`SANCTUM_TTS_VOICE` (public voice ID from the configured TTS profile).
The command runs real chat, cited RAG, file ASR/TTS, ticket admission, purge safety,
journey readiness, retired-route checks and isolated browser Markdown safety.

This initial scope is not release acceptance: authenticated WebSocket voice and
barge-in, diarization, vision, agents/ledger, LAN and fresh-clone offline bundles
remain unfinished. The result names these gaps. `SANCTUM_RELEASE_GATE=1` refuses
release success until they are implemented. Missing prerequisites fail the smoke;
no configured stage is skipped. Scope amendment: ADR0085.
