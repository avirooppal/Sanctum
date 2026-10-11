# ADR0061: desktop renderer rail and bounded mobile shell

2026-10-11. Target desktop chat shell, using inspected237px default rail and640px
dock floor from apps/desktop/src/store/layout.ts and app/layout-constants.ts.
Dashboard's different mobile navigation does not override the chat target.
Use100dvh and bounded independent scrolling, matching thread container/viewport
structure; remove the old stacked mobile sidebar that pushed login below the fold.

Native first-party drawer with one sidebar subtree: explicit opener, inert main,
Tab trap, Escape/close/focus return. No duplicated ThemeControls or controllers.
Layout-only; model/chat/history/file speech/meeting capabilities and APIs retained.
Navigation contains only supported destinations. New assertions use prescribed
three viewports and1CSS-pixel geometric tolerance; no server/latency gate changed.

Deliberately update the prior browser's250px rail assertion to237px, and its mobile
menu interaction when testing controls now inside a closed drawer. Keep the old
functional checks, add actual keyboard/inert/above-fold/no-growth tests first.
These are source-backed layout changes, not test deletion or a fidelity waiver.
Full reference comparison, all-theme spacing, axe and motion fidelity remain U5.

Regression harness supplement: the old emulated-microphone harness hardcoded8766
and ignored the supplied8769 override, failing before capture; its catch then
masked the original error with a status-locator timeout. Preserve the failed run,
add the same optional SANCTUM_BASE_URL override as other harnesses (8766 default
unchanged), report the original failure and non-waiting status collection. No
capture/ASR assertion,12-second fixture duration or170-second ASR bound changed.
