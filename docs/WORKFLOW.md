# Sanctum Desktop owner workflows

Version: 1.1.0. Ground truth: plan.md, ADR0084 and ADR0085. All full journeys
are PENDING. There is no user-facing app at this checkpoint. The retired shell
cannot verify the replacement. Its source/evidence is archived; see ARCHIVE.md.

The future product uses a left navigation sidebar, center chat and collapsible
thread-settings drawer. Models, assistants, tools and generated settings appear
only after real journeys pass. Network features and cloud providers start off;
future downloads and enabled requests must use the broker and readable ledger.

## Current journey registry

| ID | Status | Acceptance test ID | Blocker |
|---|---|---|---|
| J1 | PENDING | journey:J1 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Signed installers/bundle verification absent |
| J2 | PENDING | journey:J2 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Real hardware onboarding/import progress missing |
| J3 | PENDING | journey:J3 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Journey budgets/chaos/ledger not established |
| J4 | PENDING | journey:J4 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Folder/progress/restart and quality gates incomplete |
| J5 | PENDING | journey:J5 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Full resident WebSocket voice/barge-in absent |
| J6 | PENDING | journey:J6 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Recording,diarization and speaker-note pipeline absent |
| J7 | PENDING | journey:J7 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Vision/OCR/indexing/evaluation absent |
| J8 | PENDING | journey:J8 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Governed agent runtime/policy/ledger absent |
| J9 | PENDING | journey:J9 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Startup self-test exists;Privacy Ledger absent |
| J10 | PENDING | journey:J10 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Prerequisite policy/ledger/broker absent |
| J11 | PENDING | journey:J11 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. LAN/crypto/update/full-purge contracts incomplete |
| J12 | PENDING | journey:J12 | Desktop UI retired under ADR0085; replacement and full journey acceptance pending. Unified recovery,diagnostics and chaos evidence absent |

## Acceptance budgets retained from ADR0071

| ID | Clicks | Navigation keys | Text entries |
|---|---|---|---|
| J1 | 6 | 16 | 3 |
| J2 | 7 | 16 | 3 |
| J3 | 8 | 16 | 3 |
| J4 | 9 | 20 | 4 |
| J5 | 8 | 16 | 2 |
| J6 | 10 | 24 | 4 |
| J7 | 7 | 16 | 2 |
| J8 | 9 | 20 | 3 |
| J9 | 5 | 12 | 0 |
| J10 | 8 | 20 | 1 |
| J11 | 24 | 48 | 8 |
| J12 | 8 | 20 | 2 |

## Required steps (not available screens)

| Step | Required owner action | Current implementation boundary |
|---|---|---|
| J1.1 | 1. Verify package checksum and signature. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J1.2 | 2. Install to the chosen supported destination. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J1.3 | 3. Start Sanctum. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J1.4 | 4. Read the startup result and open the desktop. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J2.1 | 1. Open desktop setup and read detected tier/profile. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J2.2 | 2. Consent to a fitting local model or import an offline pack. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J2.3 | 3. Enter the local key;optionally choose a Knowledge folder. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J2.4 | 4. Ask a question with the detected model. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J3.1 | 1. Start or select a conversation;optionally select a model. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J3.2 | 2. Type and send one question. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J3.3 | 3. Press Stop if needed;Retry only by explicit action. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J3.4 | 4. Search,rename or reopen saved history. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J4.1 | 1. Create/select a personal workspace. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J4.2 | 2. Add files or optionally register a folder;watch indexing progress. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J4.3 | 3. Ask a question and inspect cited passages/pages. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J4.4 | 4. Refine the question/add sources after abstention,or cancel/restart indexing. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J5.1 | 1. Dictate or choose a supported audio file;review transcript. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J5.2 | 2. Start live conversation only when advertised. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J5.3 | 3. Interrupt by speaking or press Stop. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J5.4 | 4. Read an answer aloud,or stop audio and return to chat. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J6.1 | 1. Record with explicit consent or choose an audio file. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J6.2 | 2. Review transcript and speaker labels;edit speaker names. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J6.3 | 3. Review summary and verbatim-quote action items. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J6.4 | 4. Choose Knowledge workspace and save reviewed notes. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J7.1 | 1. Choose a local image/scan. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J7.2 | 2. Ask an image question or choose document indexing. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J7.3 | 3. Inspect answer and page-region citations/thumbnails. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J7.4 | 4. Correct scope/add sources or cancel. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J8.1 | 1. Choose task,workspace and allowed tools. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J8.2 | 2. Start with visible budgets and sandbox tier. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J8.3 | 3. Approve exact arguments after preview,or deny. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J8.4 | 4. Inspect result or stop the run. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J9.1 | 1. Open status and inspect live self-test scope. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J9.2 | 2. Open What left this machine when ledger is available. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J9.3 | 3. Run ledger verification. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J9.4 | 4. Export metadata or investigate a discrepancy. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J10.1 | 1. Read verified provider/retention terms and explicitly enable. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J10.2 | 2. Select cloud for this conversation and confirm disclosure. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J10.3 | 3. Send one prompt and inspect result/usage. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J10.4 | 4. Switch back to local in one action or use connector kill switch. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.1 | 1. Change theme/layout or assistant profile. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.2 | 2. Inspect resource use and set supported limits. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.3 | 3. Enable private LAN only after TLS/fingerprint/Host/Origin checks. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.4 | 4. Lock/unlock,rotate key,or back up/restore. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.5 | 5. Verify and apply an update with recovery information. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J11.6 | 6. Export or purge the selected supported data scope after confirmation. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J12.1 | 1. Read what happened and the permitted next action. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J12.2 | 2. Cancel waiting work or explicitly restart a failed engine request. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J12.3 | 3. Free memory/disk or restore a verified backup after corruption. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |
| J12.4 | 4. Inspect recovery result or export sanitised diagnostics. | PENDING: new desktop journey, action budget and relevant safety/chaos evidence |

The existing journey runner checks twelve backend readiness contracts and reports
zero full journeys verified. `--require-verified` fails while these gaps remain.
A–L additions (MCP, computer use, packs, providers and typed settings) are tracked
in PLAN_COVERAGE.md and require new contracts and full acceptance before exposure.

ADR0087: retained_state_http.py restores real HTTP sessions boundaries and owner
state CRUD (J3/J11/J12) independently of the removed UI. It is supporting backend
evidence, not full desktop acceptance; no click/key budget is changed.
