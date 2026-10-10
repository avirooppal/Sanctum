# Bounded embedding adapter v1

The product embed(texts) and OpenAI /v1/embeddings contracts remain unchanged.
A list of strings or token arrays is divided into one-input HTTP requests. A string
or single token list stays one input. Return all data with original global indices;
validate per-batch indices for completeness/uniqueness. Preserve encoding/model,
sum usage token counts, and return an error instead of a partial aggregate if any
batch fails. Existing bounded response buffers remain enforced. No generation
request is retried. Caller cancellation closes the current batch connection.

The Knowledge cross-encoder adapter also evaluates one query/candidate pair per
subrequest. Preserve original global indices and return the complete permutation
sorted by descending pair score, then original index for ties. Validate the single
result's index and finite score; fail atomically on a bad/missing result. The pinned
reranker's one-pair vs three-pair test measured maximum score difference 0.0.
