# Reliability scope — 2026-10-28

The supported entry point is `JanAppShell`: setup, model hub, chat, projects/search,
and settings. Legacy research/arena/agent screens are not reachable from it and
are not release-verified by this work.

- [x] Repair actual chat streaming, cancellation, retry and settings propagation.
- [x] Make setup, downloads, attachments and message actions truthful.
- [x] Preserve conversations and bookmarks; recover interrupted requests on reload.
- [x] Improve search navigation and narrow-screen access.
- [x] Add behavioral regression tests; run type checks, build and browser journeys.
- [x] Correct setup instructions and document remaining integration limits.

Baseline: 173 tests passed, 16 skipped (the 500 ms engine probe reported unavailable). Type check failed on
the approval callback's inferred return type in the existing P8 test. The lint
command requires an unconfigured ESLint installation. Architecture check passed.


## Implementation

- Chat updates target their originating thread, with a real AbortController and
  a single active generation guard. Retry removes the previous turn before
  resending, preserving document/image attachments. IDs use random UUIDs.
- System instructions, temperature (including zero) and top-p reach inference.
  The web app now has a same-origin `/api/chat` proxy with request validation.
- Stream decoding handles split Unicode, SSE/NDJSON and final lines, propagates
  engine errors and rejects premature EOF. Timings no longer use fake fallback
  constants. Downloads require an explicit success event and cancellation aborts
  the transport; the pull proxy forwards cancellation.
- Setup probes engine availability, offers retry/continue-offline, and no longer
  declares a service ready because model files exist. Disk discoveries are kept
  separate from runnable models. Browser-only window controls are hidden.
- Completed responses expose actions, persistent bookmarks and a bookmark filter.
  Search supports arrows/Enter and navigates out of Settings to the selected chat.
  Dialogs receive focus, trap Tab, restore focus and handle Escape.
- Text attachments reject unsupported/binary/empty inputs and files over 10 MB.
  Chat retrieval filters by collection before top-k. Zero configured overlap is
  preserved. Storage failures warn; unreadable stored JSON is not overwritten.
  Reload converts unfinished message statuses to stopped. Model refresh preserves
  configured model parameters.
- Small screens start with the sidebar collapsed, parameter panels overlay the
  chat, and request status lines wrap. README describes the actual entry point,
  setup commands, storage, verification and integration limits.

## Verification performed

- `npm run typecheck`: passed (also checked during the final build).
- `npm run lint`: architecture gate passed. This repository does not have ESLint
  configured; the broken interactive `next lint` script was replaced by the
  existing architecture gate and its meaning is documented.
- `npm test`: **197 tests, 189 passed, 0 failed, 8 skipped** in 76.3 seconds.
- Sequential follow-up of P2, P4 and P6: **26 passed, 0 failed, 0 skipped** in
  21.7 seconds. This includes all eight tests skipped by the full run's short
  engine probe. These are separate runs, not a claim of a zero-skip full run.
- Eight new behavioral tests in `tests/chat_reliability.test.ts` passed: thread
  affinity/settings/retry, cancellation, Unicode/errors, stream completion,
  truthful downloads, attachment retry/IDs, collection isolation and blocked-read
  cancellation. Tests call the actual store/client/parser rather than checking
  source strings.
- Final `npm run build`: passed; all 11 static pages generated.
- Production smoke: `/` returns 200, malformed/invalid chat requests return 400,
  and model discovery returns the expected schema.
- Browser: completed setup with live engine discovery, sent a real Qwen 1.7B
  prompt and received `SANCTUM_READY`, stopped a request before its first token,
  retried without a duplicate user message, bookmarked a response, reloaded and
  verified the bookmark filter, searched with arrows/Enter from Settings, and
  inspected the chat at 390 x 844. Reloaded the final production build as well.
- Local evidence logs/screenshots: `.cache/polish-tests-final.log`,
  `.cache/polish-live-followup.log`, `.cache/polish-build-final.log`,
  `.cache/reliability-mobile.png`, `.cache/reliability-production.png`.

## Remaining limits

This pass completes the local chat reliability scope, not every experimental
subsystem in the repository. The Windows installer/EXE was not rebuilt or
reverified. Cloud-provider dispatch, MCP execution, speech/vision quality and
legacy research/arena/agent journeys were not verified end to end. PDF extraction
is explicitly unavailable. No new model weights were downloaded during browser
verification; download success/error/abort behavior was exercised at the client
and stream layers. Settings for desktop-only integrations may require their
host/service and are not evidence of browser functionality.

The existing live-test availability probe is only 500 ms and can skip working
engines under concurrent build/test load; sequential reruns passed here. The
Next.js production server is left listening only on `127.0.0.1:3000` for review.
