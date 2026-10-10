# Engine admission v1

Private root <state>/engine-admission (0700), regular slot files (0600), opened
without following symlinks. Keys contain only ASCII alphanumeric or hyphen;
numeric engine keys are `port-N`. Slot path `KEY-SLOT.lock`. Nonblocking exclusive
flock, open-file lifetime lease, never unlink lock files. Capacity two for chat and
embedding, one for reranking/ASR/TTS. With two slots, background can only use zero;
interactive tries one then zero. Exhaustion is a retryable busy error, not waiting.
Rust runtime and Python Knowledge worker share this contract. No client-supplied
path, key, capacity or priority. HTTP 503 includes Retry-After: 1.

Execution refinement: two admissions do not mean two HTTP generation requests.
A shared one-slot `execute-port-N` lease serializes actual engine work outside the
engine's opaque queue. Rust waits poll caller cancellation every 10ms; Python waits
stay inside the owned worker and its operation deadline. Keep admission held while
waiting, so the external queue is bounded by the original admission capacity.
Retain execution through helper/body cleanup. After a crash, pending callers wait
for readiness before sending their generation POST once. This limits the crashed
model's in-flight request fault domain to the one executing request.

CPU voice priority: speech holds the one-slot `voice-priority` lease during its
owned job. New background inference execution waits for this lease to be free, checking
cancellation every 10ms. Existing model jobs continue. Interactive chat waits at most 2500ms, then proceeds; control/health traffic
bypasses the gate. There is no new unbounded queue, suspension or deadline reset.
