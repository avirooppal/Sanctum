# Embedding batching cost experiment v1

Evaluation only; no production batch-size override. The `embedding_cost` Rust example
creates its own namespace/filter, verifies engine/weight hashes, launches a supervised
embedding resident and runs the Python benchmark through `--engine-child`. Merely
entering an existing namespace does not inherit seccomp and is rejected. Pin config/artifact hashes, git
commit, host memory/CPU and real document paths/SHA256. Reject host-network runs.

Compare whole-document batches (pre-ADR0040 behavior) with the current one-input
adapter, using identical parsed parent-child chunks and a fresh SQLite catalog/vector
store for each run. Measure full parse -> embedding -> catalog/vector publication
time, documents/minute and chunks/second. Do one untimed representative warmup for
each variant, then three paired repetitions alternating order. Keep every sample;
report failures rather than dropping or retrying them. Verify vector dimensions,
counts and maximum absolute paired vector difference. Report corpus size: these
repository documents are a reference corpus, not a large deployment benchmark.

No throughput result can waive the existing cancellation or retained-RSS bounds.
The historical variant is unsuitable for production cancellation. A cache comparison
is a separate H3 experiment and remains pending until actually run.

Run (Linux source checkout, provisioned CPU config):
```sh
cargo build --locked --offline -p sanctum-gateway --example embedding_cost
target/debug/examples/embedding_cost .sanctum/runtime-dispatch.json \
  /home/aviroop/.local/share/sanctum-dev-venv/bin/python \
  target/debug/sanctum-runtime evals/results/embedding-cost-reference.json
```
