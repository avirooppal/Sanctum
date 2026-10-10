# Engine admission v1

Private root <state>/engine-admission (0700), regular slot files (0600), opened
without following symlinks. Keys contain only ASCII alphanumeric or hyphen;
numeric engine keys are `port-N`. Slot path `KEY-SLOT.lock`. Nonblocking exclusive
flock, open-file lifetime lease, never unlink lock files. Capacity two for chat and
embedding, one for reranking/ASR/TTS. With two slots, background can only use zero;
interactive tries one then zero. Exhaustion is a retryable busy error, not waiting.
Rust runtime and Python Knowledge worker share this contract. No client-supplied
path, key, capacity or priority. HTTP 503 includes Retry-After: 1.
