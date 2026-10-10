# ADR 0037: Separate large embedding setup from slow-reader delivery bounds

Accepted 2026-10-10, before the next run. The real slow-reader probe creates a large
response with 128 embedding inputs. With optional prompt caching disabled and
serialized model execution, the second admitted batch can exceed the harness's
incidental 30-second response-header wait. Latest failure: 30.031s, zero header
bytes. Earlier measured header arrivals were 12.623s/26.837s and up to 27.081s.
This wait measures computation before the client can become a slow response reader.
The plan specifies no 30-second latency gate for this large embedding batch.

Explicit harness exception: allow 120 seconds for the slow-reader probe's headers,
while retaining the identical 128 inputs, 16 attempts, concurrency four, and all
resource tolerances. Keep chat/disconnect waits at 30 seconds. Keep response pending
block/idle deadlines at 1800ms, upload bounds, caller total deadline, five-second
shutdown and 2s cancellation p95 unchanged. Record header setup separately; never
count setup time as response delivery throughput. Preserve every failed log/result.
This does not qualify ordinary chat/voice latency or the sustained overload gate.
