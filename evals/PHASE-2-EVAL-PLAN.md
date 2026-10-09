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
