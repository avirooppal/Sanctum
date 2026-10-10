# Phase 2 evaluation plan (dataset design before benchmark)

Create and freeze 30 manually authored, single fact/query/source labels across six
small Markdown documents with lexical distractors (`knowledge-qa.json`). This synthetic
local set verifies pipeline behavior only; it is not representative of a domain corpus.
If dense recall saturates, create a separate versioned challenge rather than editing
the first set. V3 adds 30 opaque-key lookups with near-duplicate decoys across six
target and six decoy Markdown registers (`build_knowledge_needle.py`). V4 concentrates
the same fixed fact table into one target and one decoy register, forcing retrieval to
distinguish individual passages (`build_knowledge_needle_v4.py`). V2 is retained as
invalid diagnostic evidence: its expected citation included heading metadata that the
parser excludes from the child quote. V3's source labels are valid; its measured results
exposed missing heading context in the pipeline. The runner preflights every expected
quote against its parsed source chunk and refuses malformed suites.

For each immutable set, run vector-only and hybrid retrieval against the same index at
k=5. `knowledge_retrieval.py --dataset PATH` records the dataset SHA-256 and checkpoints
each completed case to a suite-named JSON file.
Record recall@5 and MRR against exact expected passages. Then ask all questions with
hybrid retrieval and record exact source/quote support and abstention on an unsupported
question. Save dataset/fixture SHA-256 and raw outputs. A separate local-model judge and
human review are required for faithfulness; substring citation support alone is not
enough. Do not alter a dataset after seeing scores; improvements require a new suite.

Exit targets from docs/PHASE-2-PLAN.md: hybrid recall@5 gains >=0.05 absolute over
vector-only, no answer-faithfulness regression, >=0.95 exact citation support across
at least 30 questions, local judge and human spot-check. These toy-set results cannot
establish general RAG quality. If dense baseline is already saturated, add a separately
versioned harder dataset before tuning; never silently tune on frozen cases.


V4 completed on 2026-10-09: dense and hybrid recall@5 both 1.00 (gain 0.00), MRR
1.000/0.983, citation support 0.867, expected-answer containment 0.867, abstention passed.
The recall and citation targets fail. Do not advance Phase 3. The result records the resumed
segment time only; it is not an end-to-end benchmark duration.


V5 expands the corpus to 480 passages (30 targets, 450 decoys). Its retrieval-only pass
still measured vector/hybrid recall@5 at 1.00/1.00 (gain 0.00); see
`evals/results/knowledge-needle-v5-retrieval-only.json`. This independently confirms that
the current metric is saturated even at higher corpus size. Do not tune the ranking metric
or invent a lower dense baseline; keep improving grounded answers and use a measured
customer-like corpus review to decide whether the gain threshold is a useful release gate.


V5 citation run completed on the 480-passage workspace: exact citation support 1.00,
expected-answer inclusion 1.00, and unsupported-query abstention passed. Dense/hybrid recall@5
remained 1.00/1.00. This confirms the grounded citation fallback against this synthetic suite,
but does not satisfy the hybrid-gain gate or establish no faithfulness regression. Local judge
and human spot-check are pending; the review packet is
`evals/results/knowledge-needle-v5-human-review.md`.

V6 is a separately versioned exact machine-identifier challenge over the same 480
passages (30 targets, 450 near-duplicate decoys). Dataset SHA-256:
`bd2c1f62b08284eb62fbc8781969ffc1c530f93b38d5e00942b9569d4039247e`. On one indexed
workspace, vector/hybrid recall@5 measured 0.60/1.00 (gain +0.40) and MRR 0.60/1.00.
The completed ACL-filtered hybrid answer replay measured exact citation support 1.00,
expected-answer inclusion 1.00, and passed unsupported-query abstention. Artifacts:
`evals/results/knowledge-needle-v6-retrieval-only.json` and
`evals/results/knowledge-needle-v6-grounded-answers.json`.

The v6 hybrid and vector-only local judge runs initially both reported 30/30 supported,
but a directed spot-check found three sampled vector-only answers cited values for
different identifiers. ADR 0013 adds exact-entity evidence validation before local
entailment judgment. Calibrated vector-only judge supports 18/30 (0.60); calibrated
hybrid judge supports 30/30 (1.00). Answer exact citation support and expected-answer
inclusion are likewise 0.60 vector-only vs. 1.00 hybrid; abstention passed. At the
user's direction, Codex checked four hybrid examples against the frozen source and
citation; all four were supported. ADR 0014 records the reviewer substitution and its
limits. Artifacts: `evals/results/knowledge-needle-v6-judge-entity-v2.json`,
`evals/results/knowledge-needle-v6-vector-judge-entity-v2.json`, and
`evals/results/knowledge-needle-v6-human-review.md`. No independent human review is
claimed. The user's explicit instruction accepts this source-anchored review for Phase 2.
