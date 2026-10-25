AMENDMENT 1 — OWNER-AUTHORIZED UX ADDITIONS: LIVE REQUEST STATUS AND A SMOOTHER, MORE INTERACTIVE FEEL

Append this verbatim to docs/MASTER_PROMPT.md and commit it. It changes ONE rule: the "copy upstream exactly, invent nothing" rule no longer applies to the elements in this amendment. The owner authorizes you to design and add NEW UI/UX elements that make the app feel smoother, more responsive and more interactive, starting with a live status display for every prompt the user sends. Everything else still follows the exact-copy rule; all standing rules still apply (reality, evidence, thresholds by ADR, privacy, licenses, tests first, commit and push, hosted CI polled to `completed`).

1. LIMITS OF THE AUTHORIZATION
 a. Real, never fake: every status, progress value, count, speed, elapsed time and message shown comes from a real event or measurement. No fake progress bars, no decorative "thinking" animations, no typing effects that hide latency, no invented percentages. If a value is unavailable show nothing or "Unknown".
 b. Honest feedback: when the system is waiting, say what it is waiting for. If no event arrives for N seconds, show "No response for N s" with Stop and Wait options (N set by ADR).
 c. Quiet and consistent: new elements use the existing design tokens and language (and therefore the Appearance Studio), add no clutter, and follow the existing density. No sounds by default. No marketing copy. No dark patterns.
 d. Cheap: no new infinite animations while idle; idle CPU budget unchanged; bundle and render cost measured; each element has a setting to turn it off (Settings > Interface, via the settings schema) and is logged in docs/ui-deviations.md as "OWNER-AUTHORIZED ADDITION" with before/after screenshots.
 e. No backend, no element: a control or indicator appears only if the real data behind it exists and a test proves it.
 f. Design first: write docs/design/INTERACTION.md (state diagram of the request lifecycle, event contract, exact copy, timings, accessibility behavior) and static frame mockups for every state; two critique rounds; then implement. Present the list of proposed additional elements (section 3) with mockups in REVIEW_QUEUE; build the request lifecycle (section 2) immediately and the rest in priority order, a few at a time, each removable on owner request.

2. REQUEST LIFECYCLE STATUS (build first; this is what the owner explicitly asked for)
 When the user presses Send, the interface shows, within 100 ms (p95, ADR), that the message was accepted, then keeps showing the true phase until the answer is complete. Phases come from a typed `request.status` event stream emitted by the core (define it in contracts with `request_id`, `phase`, `progress` (optional), `detail`, `timestamp`) and rendered by the UI:
 1. Sending: the user's message appears immediately (optimistic render of the user's own message only), marked "Sending"; if the core rejects it, mark it Failed with Retry and the reason.
 2. Queued: position in the queue and lane when the engine is busy (from the real admission data); estimated wait only if it can be measured.
 3. Loading model: model name, real load progress and elapsed time when the engine reports it (reading weights, allocating memory); Cancel available. If the model was already loaded, skip this phase.
 4. Reading your message (prompt processing): tokens processed of total and percent when the engine streams prompt progress (verify what the engine provides and enable it if needed); otherwise just elapsed time.
 5. Searching your documents (RAG pack): number of documents or passages searched and found, with the citations appearing as chips when ready.
 6. Thinking (reasoning models): elapsed time and, if the model emits reasoning content, a collapsible live view; only when real.
 7. Using a tool: tool name, a one-line summary of the arguments, running time; "Waiting for your approval" with the approval prompt inline (exact arguments, Allow/Deny); then the tool result card.
 8. Writing the answer: live tokens per second, token count and elapsed time, a subtle caret, a Stop button that is always visible and responsive.
 9. Finishing: saving the thread; Done: final stats (tokens, time, speed, context used) in a collapsed details popover.
 10. End states: Stopped by you, Cancelled, or Error with a typed, human-readable reason and recovery actions (Retry, switch model, free memory, open settings), and "interrupted" markers on partial answers saved after a crash.
 Layout: a compact inline status line directly under the pending assistant message (with the phase steps visible as a small stepper), plus the existing engine-state indicator in the top bar. Text changes are announced through a polite ARIA live region on phase changes only (never per token). With reduced motion, animations are removed but the text status remains. All phases are themeable.
 Tests: contract tests for the event schema and legal phase transitions; scripted engine fakes (under tests only) emit every sequence: normal, model not loaded, queued, RAG, tool with approval, long reasoning, stall, error, cancel, engine crash mid-answer, offline; the same sequences run against the real engine where possible; E2E timing: Send to first visible feedback p95 within the ADR budget, no gap of silent UI longer than the ADR threshold during a request, phase order valid; honesty tests: percentages appear only when the engine supplied them, "Loading model" appears only after a load event, stalled detection works with a frozen fake engine; accessibility checks for the live region; performance: INP, long tasks and layout shift during streaming within budgets, idle CPU with the UI idle unchanged, no memory growth across 1,000 request cycles.

3. OTHER SMOOTHNESS AND INTERACTIVITY ELEMENTS (design, list and prioritize; each real, toggleable, measured; build the most valuable first and keep the total modest)
 - Instant local feedback: optimistic renames, pins and deletes with undo toasts; skeleton loaders only when data takes over 150 ms; spinners delayed 200 ms to avoid flashes; scroll position preserved; smooth stick-to-bottom with "Jump to latest" and a new-content indicator.
 - Streaming polish: token updates batched per animation frame, no layout shift, a persistent Stop button, Regenerate and Continue, a live token counter.
 - Composer: per-thread drafts kept in the core database (not browser storage) and restored after a crash, token estimate from the real tokenizer or "Unknown", @-mentions for files, assistants and tools, inline slash menu, drag-and-drop and paste with progress chips, queue a follow-up message while the model is answering, and a model warm-up on composer focus (setting; verify it improves time to first token before enabling by default).
 - Navigation: command palette (Ctrl/Cmd+K), shortcuts overlay (?), quick model switcher, thread switcher, context menus and hover actions.
 - Activity center: downloads, indexing and pack installs with speed, ETA, pause/resume and cancel; OS notifications when a long task finishes while the window is unfocused (opt-in, local only).
 - Optional resource HUD (off by default): live RAM, VRAM, CPU and tokens/s from real metrics.
 - Micro-interactions: press and hover feedback, copy confirmations, code-block "copied", 120–200 ms transitions honoring reduced motion.
 - Session recovery: after a crash or restart restore open threads, scroll positions and drafts, and mark interrupted answers.
 - Contextual hints that disappear after first use, describing only capabilities that really exist.
 Cap the scope: if an element's measured cost (bundle size, CPU, complexity) outweighs its benefit, drop it and record why in docs/FUTURE.md.

4. INTEGRATION AND GATES
 - Appearance Studio: every new element uses tokens, adapts to all presets and per-scope overrides, and stays out of the isolated security-critical zone (approval prompts embedded in the status line must still render inside the isolated component so themes cannot hide or spoof them).
 - Architecture: the status state machine lives in core/ai and contracts; the UI only renders events (no phase logic or timing heuristics in the UI beyond presentation).
 - Fidelity and invention audit: screens unaffected by additions keep their pixel parity with the upstream; additions are allowlisted in docs/ui-deviations.md; anything else the audit finds fails.
 - Feature matrix and click-coverage: every new control and setting has a test proving its effect; the Interface settings toggles each switch the element off and the app still works.
 - Reality audit: regenerate docs/REALITY_AUDIT.md rows for the status line, activity center, HUD and each addition (data source, test ID, status).
 - Performance and leak gates from the master prompt re-run after these additions; any budget miss goes to REVIEW_QUEUE.
 - Milestone placement: request lifecycle status in M3 alongside the Jan parity UI (it needs the event contract from M2); the other elements spread across M3–M5 as their backends exist; re-verified in M9.

REPORT per slice: element, criteria, commit hashes, commands run with real results and key output lines, screenshots, files and docs updated, next slice, decisions awaiting my review.

BEGIN: append this amendment, then write docs/design/INTERACTION.md and the request.status event contract.
