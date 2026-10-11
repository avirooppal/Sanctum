# Realtime held-session gate v1

Use the real authenticated loopback WebSocket and pinned CPU models. Attempt3
sessions against voice connection cap2; admit2 and quickly shed the third503.
Hold admitted sessions >=600s with actual ping/pong. While held, issue real health,
models and chat requests and background ingestion. Record every latency, p95
health/models<=250ms/chat<=5s; assert background503 shedding and queue<=8.
Record owned process/FD/thread/socket/RSS snapshots before and after10s quiescence,
using unchanged ADR0028/0041 tolerances. No speech SLO or real audio claim.

Then rerun the mixed-engine180s workload with one held WebSocket (leaving one
voice connection available for file ASR/TTS). Preserve default historical upload
workload for comparison; no existing metric removed or threshold relaxed.
