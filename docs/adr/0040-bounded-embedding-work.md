# ADR 0040: Bound embedding work inside the engine, not only HTTP admissions

Accepted 2026-10-10. Direct slot observation passed chat cancellation smoke checks,
but Knowledge compute cancellation FAILED: model still processing after three
seconds although the gateway lane was free. The Knowledge adapter submitted the
entire document's inputs in one HTTP request. Inspection of pinned upstream
server-queue.cpp shows the disconnect callback is checked only when result waiting
times out; frequent batch results can delay that check.
Source: https://github.com/ggml-org/llama.cpp/blob/b11429/tools/server/server-queue.cpp

Keep the pinned engine and its kernels unchanged. Behind the stable embedding
interface, issue at most eight inputs per HTTP subrequest, preserving input order,
global indices, encoding and summed token usage. Apply this to Python Knowledge
and Rust's supervised direct embedding bridge. Each subrequest remains within
owned cancellation; no replay. Fail the whole response if any batch fails. Bounded
result accumulation keeps existing response caps. Background calls yield to a
reserved interactive admission between batches. This bounds opaque task queues
and cancellation tails; it must meet the unchanged <=2s p95/<3s maximum gate.
No test/workload or cancellation threshold removed or relaxed.

The eight-input implementation's real Knowledge compute smoke FAILED the unchanged
three-second maximum. Tighten the reference adapter to one input per subrequest.
A single result cannot keep the upstream wait loop continuously populated by other
queued inputs. Update the contract and batching tests to this stricter limit while
preserving all order/usage/error assertions. This is not a relaxed timing gate.
Retain the failed eight-input evidence (`bounded-eight-compute-failure.json`).

The pinned reranker uses the same wait_for_all path and can create an opaque queue
for all retrieved candidates. Apply the same one-pair bound to Knowledge reranking.
Read-only namespace integration compared three candidate scores together and
individually: maximum difference 0.0. Preserve descending global ranking with a
stable index tie-break. Add actual reranker cancellation observation to the harness;
do not infer this branch's cancellation from ingestion tests.
