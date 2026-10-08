# Knowledge (Phase 2 in progress)

Contracts: docs/contracts/knowledge.openapi.json and knowledge.md. Library interfaces
separate Parser, Embedder, VectorStore and Reranker. SQLite Catalog is authoritative
for membership, per-document readers and current chunks; ACLs apply before candidate
ranking and again on parent expansion. Only owners can ingest/change readers.

Initial permissive parser adapters: markdown-it-py and pypdf (ADR 0009). Vector adapter:
sqlite-vec (ADR 0010); LanceDB is not implemented. No model download or service
listener exists in this library slice. Runtime service wiring is pending.

Run `uv sync --locked --group knowledge`, then
`uv run --offline --group knowledge python -m unittest discover -s services/knowledge/tests -v`.
Fixtures use actual local storage/vector kernels but stub-sized vectors; they do
not count as RAG-quality or inference benchmarks.
