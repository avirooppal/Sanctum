# Retained UI module audit — ADR0087

These are planned M3 consumers, not an existing desktop app. Six modules remain;
five helpers with only M8 use are removed now. No backend engine/tests are removed.

| Original module | Consumer / decision |
|---|---|
| `apps/web/src/api.ts` | M3: authenticated chat/model/history transport; native shell transport adaptation must preserve these contracts |
| `apps/web/src/chat-run.ts` | M3: active chat request ownership, Stop and stale-response cancellation |
| `apps/web/src/health-observation.ts` | M3: first-run/runtime status observation, including honest unknown state |
| `apps/web/src/runtime-truth.ts` | M3: connection/assurance copy and redacted understandable errors |
| `apps/web/src/workspace-bootstrap.ts` | M3: initial capability/model/preference reads before showing available features |
| `apps/web/src/ui/SafeMarkdown.tsx` | M3: chat message renderer with injection and passive-egress protections |
| `apps/web/src/meeting.ts` | DELETE: meeting-note pack UI is M8; no M3 consumer |
| `apps/web/src/microphone.ts` | DELETE: speech-pack dictation UI is M8; no M3 consumer |
| `apps/web/src/pcm.ts` | DELETE: speech-pack audio encoding is M8; no M3 consumer |
| `apps/web/src/speech.ts` | DELETE: speech-pack controls are M8; no M3 consumer |
| `apps/web/src/capture-worklet.js` | DELETE: speech-pack capture is M8; no M3 consumer |

## Deleted dedicated tests (11)

| Test | File | Reason |
|---|---|---|
| meeting save uses restricted same-origin authenticated request | `apps/web/tests/meeting.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| invalid workspace and oversized or blank input never send requests | `apps/web/tests/meeting.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| failed writes are surfaced without retrying | `apps/web/tests/meeting.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| encodes finite mono PCM16 with accurate WAV header and clamping | `apps/web/tests/pcm.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| bounded memory accepts no partial overflow and resets after discard | `apps/web/tests/pcm.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| rejects nonfinite data without mutating captured audio | `apps/web/tests/pcm.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| uses same-origin multipart and bearer auth without storing credentials | `apps/web/tests/speech.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| stop discards stale audio even if fetch ignores abort | `apps/web/tests/speech.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| stop releases playback and next operation cannot reuse it | `apps/web/tests/speech.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| rejects oversized inputs and unexpected audio content types | `apps/web/tests/speech.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
| worklet itself stops after 30 seconds even if UI messages are not handled | `apps/web/tests/worklet.test.mjs` | Dedicated removed frontend helper; no M3 consumer |
