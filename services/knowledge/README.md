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

Run `uv sync --locked --group knowledge`, then
`uv run --offline --group knowledge python -m unittest discover -s services/knowledge/tests -v`.
Run the real upload/retrieve/citation smoke test against a confined Linux runtime with
`python evals/knowledge_smoke.py --token-file PATH`. The frozen 30-question ablation is
`python evals/knowledge_retrieval.py --token-file PATH`; outputs are written to
`evals/results/phase2-retrieval.json` and checkpointed per question. Synthetic results
do not establish quality on representative customer corpora. Folder watching, a local
faithfulness judge, human review, and the full exit gate remain outstanding.
