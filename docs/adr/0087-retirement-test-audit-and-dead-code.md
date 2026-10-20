# ADR0087: Audit retired tests and remove post-M3 frontend dead code

Date: 2026-10-20. Status: adopted within the owner's A2–A5 follow-up.

The explicit test-name/stage audit is docs/TEST_REMOVAL_AUDIT.md, linked from
ADR0085. The earlier187→183 source,95→45 web and19→8 smoke totals must reconcile.
The review found that direct sessions HTTP assertions and profile HTTP CRUD had
been embedded in removed browser journeys. Restore them as a real-gateway
retained_state stage, including401/400/404/413 responses and real chat/history,
rename/search/delete and profile create/read/update/delete. No mock gateway.
Restore the full forbidden dependency list and devDependency inspection from the
old reference-boundary test in the surviving retirement test. Do not describe the
earlier removal as lossless; these are explicit coverage repairs.

Six frontend modules have named M3 consumers. Five audio/meeting helpers have only
M8 consumers and no M3 use: meeting.ts,microphone.ts,pcm.ts,speech.ts and
capture-worklet.js. Delete them now, with11 tests in four dedicated files, per the
owner's dead-code rule. Preserve them in Git history for a fresh M8 review. Existing
knowledge/speech backend implementations, their unit/contract tests, real file
ASR/TTS smoke and ticket tests remain. No verified vision implementation is implied.

The resulting web count is45−11=34; unchanged Python/Rust tests retain their scope.
Smoke becomes8+1=9. Existing timeouts/quality gates are not relaxed. The restored
HTTP probe uses the existing readiness client's10-second metadata/1MiB bounds and
the SDK's180-second real inference bound, without retry. It deletes only its own
newly-created UUID-labelled session/profile, including failure cleanup.

Archive the full current STATUS bytes with SHA256 and make Current state one
screen. Recommend keeping main at the pre-pivot snapshot until a usable M3 app
exists; this is PROVISIONAL for owner review, and no merge is authorized here.
