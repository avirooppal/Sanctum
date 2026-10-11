# Current state

- Mission: [MISSION.md](MISSION.md); single owner, ADR0027. No RC or phase tag.
- Step: 1a ticket HTTP endpoint under verification; WebSocket transport pending.
- Last hosted-green commit: `d89feb2` (mission); baseline below rerun this session.
- Blockers: no software blocker; T1/GPU/physical audio/native targets UNVERIFIED.
- Next: finish endpoint checks/push; guarded WebSocket; real >=600s held/mixed gates.

| Gate | Current evidence |
|---|---|
| Linux source baseline | PASS145; lint/format/types, licenses26/72, foundation eval/API docs |
| Rust/security baseline | PASS54; fmt/clippy, licenses74, denial/startup38, supervision3/zero survivors |
| Web baseline | PASS12; typecheck/build; audit zero advisories |
| Real SDK baseline | PASS8; chat0.4114s, streaming TTFT0.4328s, embeddings1024 |
| Active baseline shutdown | PASS0.793983s; listener0.183991s; zero survivors |
| Step0 engine storms/mixed | Historical PASS; must rerun after resident workers |
| Held authenticated WebSocket | PENDING; no real transport yet |
| Speech WER/T1 voice latency | Not measured; T1 hardware UNVERIFIED |
| Vision/agents/LAN/packaging/RC acceptance | Not done; no hardware-only exemption for software gaps |

## Evidence and decisions

All previous STATUS narratives preserved verbatim in
[archive](status-archive/2026-10-11-through-ticket-preparation.md), SHA256
`8a5e4cd509a551c4761808bd3a30d591085f61cfee6c93584b384b47b6a71e7e`.
Earlier archives, phase scope table and failed runs are linked inside it.
[REVIEW_QUEUE](REVIEW_QUEUE.md) preserves decision changes; ADR0047 transport gate pending.

Baseline commands: Linux `python tools/check.py`, `bash tools/check_rust.sh`;
web `npm test`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=low`;
`target/debug/sanctum-runtime --config .sanctum/runtime-dispatch.json --port 8769`;
`python evals/sdk_chat.py --base-url http://127.0.0.1:8769/v1 --token-file <state>/local.token`;
`python evals/active_shutdown.py --pid 1438 --token-file <state>/local.token --output evals/results/final-mission-baseline-shutdown.json`.
Logs `.sanctum/final-mission-baseline-{source,rust}.log`; named JSON results in evals/results.
Hosted mission [run38115384663](https://github.com/avirooppal/Sanctum/actions/runs/38115384663): exact d89feb2, all5 jobs PASS.
Incorrect quoted PID lookup failed before shutdown; corrected numeric PID run above PASS.

Step1a contract and Origin test first (missing SessionAuth FAILED, then implemented).
Endpoint requires owner bearer plus exact canonical gateway Host/Origin, empty POST;
random256-bit ticket, memory-only hash store, cap32/TTL30s, no-store/503 Retry-After.
Generated OpenAPI docs updated. Full source rerun first FAILED because VIRTUAL_ENV
was omitted and ty selected the Windows venv; named failure retained. Corrected
Linux environment rerun PASS146/all gates. Rust PASS55/fmt/clippy/licenses74,
38 denial/startup probes/supervision3, zero survivors. Real endpoint PASS6 checks
(`realtime-ticket-http-reference.json`): missing auth, Origin, method, body limit,
32 unique random credentials and cap503/Retry-After. Initial real attempt timed out
before ready observation; named startup failure retained, corrected after ready.

`bash tools/smoke_all.sh` implemented-feature scope PASS exit0 using Windows Git
Bash/Windows venv and bundled browser, against the confined WSL service on8769.
ChatSDK8 (0.3720s/TTFT0.4182s), Knowledge4/cited amber, ASR8 (2.983581s), TTS8
(1.060266s/3.31s WAV), ticket6, browser7/page errors0/mobile no-overflow. Manifest
`smoke-all-reference.json` explicitly release_complete=false and names pending
WS voice/diarization, vision, agents/ledger, LAN and fresh-clone/offline bundle.
ADR0048/REVIEW_QUEUE explains incremental scope; full RC smoke remains not done.
First smoke failed internal Flite voice name; corrected to configured public ID;
named failed manifest/log preserved. WSL Windows-node launch then failed exec format;
preserved log, used existing Windows Git Bash, no WSL reset or check suppression.
Source after smoke additions PASS148/all checks; web12/typecheck/build/audit0.
No WebSocket/resident-worker/voice-SLO/physical-audio/RC completion claim. Next:
commit/push and exact hosted CI, then actual guarded WebSocket/held-session gates.

Successful smoke invocation: Windows Git Bash `bash tools/smoke_all.sh`,
SANCTUM_CONFIG=.sanctum/runtime-dispatch.json; SANCTUM_PYTHON=.venv/Scripts/python.exe;
SANCTUM_NODE/SANCTUM_PLAYWRIGHT=bundled workspace Node/playwright paths;
SANCTUM_TOKEN_FILE=WSL UNC path to <state>/local.token;
SANCTUM_TTS_VOICE=tts-flite-slt-reference. Logged
`.sanctum/realtime-smoke-all-windows.log`; six stage logs/results retained.
Post-slice active engine/queue/slow-body shutdown PASS0.785774s, listener0.191896s,
zero survivors (`realtime-endpoint-active-shutdown.json`). No runtime left running.
