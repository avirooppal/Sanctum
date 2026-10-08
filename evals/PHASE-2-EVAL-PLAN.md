# Phase 2 evaluation plan (dataset design before benchmark)

Create and freeze 30 manually authored, single fact/query/source labels across six
small Markdown documents with lexical distractors. This synthetic local set verifies
pipeline behavior only; it is not representative of a domain corpus. After upload,
run vector-only and hybrid retrieval against the identical immutable index at k=5.
Record recall@5 and MRR against exact expected passages. Then ask all questions with
hybrid retrieval and record exact source/quote support, abstention on an unsupported
question, and a local-model plausibility check. Save dataset/fixture SHA-256 and raw
outputs. Do not alter the dataset after seeing scores; improvements need a new suite.

Exit targets from docs/PHASE-2-PLAN.md: hybrid recall@5 gains >=0.05 absolute over
vector-only, no answer-faithfulness regression, >=0.95 exact citation support across
at least 30 questions, local judge and human spot-check. These toy-set results cannot
establish general RAG quality. If dense baseline is already saturated, add a separately
versioned harder dataset before tuning; never silently tune on frozen cases.
