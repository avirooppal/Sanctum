# Cancellable I/O v1

ContextIo owns a file/pipe/socket with O_NONBLOCK enabled at construction and the
request Cancellation context. Every read/write checks cancellation before attempting
I/O; WouldBlock polls in <=10ms intervals. Cancellation returns ConnectionAborted,
not Interrupted (standard read_to_end retries Interrupted). A caller may replace
the context only between sequential worker requests. BufReader retains framing;
existing byte caps remain mandatory above this transport. No unbounded queues or
detached I/O threads are created. Drop does not imply process cleanup; an owned
guardian must terminate/reap the worker when an operation returns early.

Tests exercise real blocked Unix sockets, partial reads, and deadlines. Passing
these tests is necessary but insufficient for real per-engine release acceptance.
