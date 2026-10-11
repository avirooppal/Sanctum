# Shutdown v1

SIGTERM/SIGINT stops admission and closes the public listener first, cancels queued
contexts, cancels active transport/engine contexts, and joins workers before owned
engine guardians are destroyed. Slow upload reads observe shutdown every <=100ms.
The overall active-engine shutdown deadline is five seconds (ADR 0031). No orphan
or zombie owned PID may remain. A failed cleanup is a failure, not a successful
drain. `evals/active_shutdown.py` starts real in-flight work against a ready gateway,
records listener closure and process disappearance, and rejects unobserved work.
The harness terminates its explicitly supplied gateway PID.

The listener must refuse new connections within 250ms, matching the 200ms accept
poll plus scheduling allowance. Include at least one queued chat request alongside
active engine calls. The full five-second bound is unchanged.
# Authenticated WebSocket extension (Step1a)

Opt-in harness mode admits one real authenticated WebSocket before active
chat/ASR/ingestion/queued jobs. The slow-body probe uses the background lane,
leaving voice cap2 for the WebSocket and ASR. Require an actual100-continue
acknowledgement before the one-byte body and SIGTERM; do not claim a refused
connection is an admitted slow body. Check WS close1001. Existing shutdown5s
and listener250ms bounds remain unchanged; original mode remains available.
