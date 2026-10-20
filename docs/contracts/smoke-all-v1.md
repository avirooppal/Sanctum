# Implemented backend smoke — ADR0085

`bash tools/smoke_all.sh` requires a real configured gateway on port 8769,
recorded WAV, installed Playwright and ASR/TTS model/voice IDs. See README for
environment variables. No configured stage is skipped; any failure is named.

Nine stages: retained state HTTP, chat, cited RAG, file ASR, file TTS, ticket admission, purge safety,
journey readiness, and ui_salvage. The last checks that withdrawn UI routes return
404 from the actual gateway, health remains available, API authentication remains
required, and hostile Markdown in Chromium creates no executable DOM or passive
network request. This is isolated renderer testing, not a replacement app screen.

The twelve old browser stages are explicitly retired by ADR0085 with the withdrawn
UI. Existing backend timeout/quality thresholds and journey budgets are unchanged.
STAGE_JOURNEYS remains bidirectionally checked. Readiness reports 12 checks and
zero complete journeys. SANCTUM_RELEASE_GATE=1 continues to fail while product
requirements remain pending. The smoke does not certify desktop UX, optional pack
lifecycle, tools/MCP, providers, computer use, fresh installs or the future broker.

ADR0087 restores HTTP sessions401/400/404/413, real chat/history/rename/search/delete
and profile CRUD previously embedded in the retired browser stages. It changes
only newly-created test UUID records and preserves named failures. This closes a
coverage gap without claiming the removed UI journey remains implemented.
