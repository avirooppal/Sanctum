# ADR0048: Incremental real smoke entry point

2026-10-11. The mission explicitly asks to extend smoke_all as features land.
Start with real currently implemented chat/RAG/file speech/ticket/browser flows;
name pending release requirements in its manifest. Exit0 means this implemented
scope passed, never that the product's five-modality RC gate passed. Explicit
release mode fails with pending requirements. No unavailable feature is simulated.
No test, timeout, SLO or final gate relaxed. A provisioned running service/browser
is required initially; fresh-clone automatic startup remains final acceptance work.
Each later slice must add its actual feature and remove the corresponding pending
entry only with real evidence. Final bare smoke_all must encompass all requirements.
