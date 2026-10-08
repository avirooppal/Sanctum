# Phase 2: Knowledge

Order: workspace/document ACL contract and adversarial tests; structural parser
adapter and parent/child chunks; embedded LanceDB dense search plus SQLite FTS5
BM25 with ACL prefilters; RRF and local cross-encoder reranking; confined worker
and Rust API routes; upload/folder polling; cited answers with page/text highlights;
frozen labeled retrieval/answer benchmark and vector-only ablation.

Tests: cross-workspace and denied-document retrieval, ACL changes, malicious IDs,
parse/chunk provenance, dedup/versioning, real ingest-to-ask with citations, injected
instructions, empty evidence abstention. All model calls remain local. No agent tool
execution is available through retrieved content. Candidate/document text is untrusted.

Risks: Docling dependency licenses, PDF layout fidelity, small-model grounding,
CPU reranker latency and model-memory budget. Parser fallbacks require explicit ADR.
Phase 2 exit requires recall@5 improvement >=0.05 absolute over the same dense-only
baseline, no faithfulness regression, and >=0.95 exact citation support on at least
30 frozen labeled questions. Semantic faithfulness also requires local-judge and
human spot checks; citation substring agreement alone cannot establish it.
