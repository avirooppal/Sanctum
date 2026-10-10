# Knowledge (Phase 2 in progress)

Contracts: `docs/contracts/knowledge.openapi.json` and `knowledge.md`. Library
interfaces separate Parser, Embedder, VectorStore and Reranker. SQLite Catalog is
authoritative for membership, per-document readers and current chunks; ACLs apply
before candidate ranking and again on parent expansion. Only owners can ingest/change
readers.

Initial permissive parser adapters: markdown-it-py and pypdf (ADR 0009). Vector adapter:
sqlite-vec (ADR 0010); LanceDB is not implemented. The Rust gateway starts `worker.py`
only as a confined child. The worker verifies its Linux network namespace and inherited
seccomp filter before opening state or contacting loopback-only OpenAI-compatible
embedding, reranking and chat engines. Configure those local endpoints and model IDs
through `profiles/runtime-knowledge.json`; no cloud fallback is provided. Knowledge
endpoints and bearer requirements are specified in
`docs/contracts/knowledge.openapi.json`.

An optional standalone poller imports changed Markdown and text-based PDF files through
the owner-authenticated upload endpoint. Its configuration contract is
`docs/contracts/folder-watch.schema.json`; see ADR 0011 for root confinement, limits,
and deletion behavior. Keep `token_file` outside the watched directory and readable only
by the local account. Start one watcher per workspace with:

```powershell
uv run --offline --group dev --group knowledge python services/knowledge/watch.py --config PATH
```

Pass `--once` to perform one scan and exit. The watcher accepts only loopback HTTP, does
not follow symlinks, skips hidden files, and never follows gateway redirects.

Run `uv sync --locked --group knowledge`, then
`uv run --offline --group knowledge python -m unittest discover -s services/knowledge/tests -v`.
Run the real upload/retrieve/citation smoke test against a confined Linux runtime with
`python evals/knowledge_smoke.py --token-file PATH`. The frozen 30-question ablation is
`python evals/knowledge_retrieval.py --token-file PATH`; use `--dataset PATH` for a
versioned alternative, `--workspace-id ID` for an already indexed workspace, and `--resume`
to continue a matching partial checkpoint. `evals/knowledge_retrieval_ablation.py` runs a
retrieval-only pass against an existing workspace; `evals/knowledge_watch_smoke.py` checks
change detection and retrieval through the local API. After a completed answer run, use
`python evals/knowledge_judge.py --token-file PATH --dataset PATH --answers PATH --workspace-id ID`
to score faithfulness with the configured local judge against ACL-filtered evidence;
`--mode vector` evaluates the vector-only comparison; `--run-tag entity-v2` preserves
a calibrated rerun separately; `--resume` continues a hash-checked checkpoint. Outputs
are written to suite-named files in `evals/results/`. Synthetic results do not establish
quality on representative customer corpora. Run
`python evals/knowledge_answer_eval.py --token-file PATH --dataset PATH --retrieval-results PATH --workspace-id ID --mode vector`
to replay a frozen answer suite in vector or hybrid mode against its existing indexed
workspace; pass the same `--mode` to `knowledge_judge.py` for a matched faithfulness
comparison. Folder
watching is implemented. The v6 exact-key challenge passes the hybrid-gain target;
local judge, vector-only answer comparison, and human review are still required before
Phase 2 can exit.
