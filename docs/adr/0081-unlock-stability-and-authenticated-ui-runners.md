# ADR0081: S1 stability and authenticated UI verification

Date2026-10-18. Iteration3 gives the live report a chip affordance and a reserved
time row. Before measurement,set maximum card-height and vertical-position
change on a health success/failure transition to1 CSSpx (same viewport/content).
This is a new UI stability assertion,not a change to streaming CLS or any old
SLO. Keep44px minimum targets,AA floors,200ms ceiling and prior asset budgets.
The chip summary uses64px minimum height to accommodate two12px lines. Native
details remains keyboard-operable;only the original local chevron transforms.

Custom accent application also sets focus to that contrast-guarded accent.
Pure registered palette values and defaults remain immutable. Errors retain
proper field association. Do not remove unknown status or its explanation to
make the card appear cleaner. No new network behavior or observer bound.

Standalone shell/theme browser runners must now authenticate against the real
gateway before workspace assertions. Retain old237px geometry,mobile focus,
mode,storage and text-floor assertions;move key-entry checks to the locked
state. Restore preferences after real theme selection. No test is skipped and
no typography/opacity threshold is lowered. Any exposed inherited11px metadata
must be fixed to12px rather than weakening the original floor.

Runner migration exposed an existing client bug:savePreferences passes a header
object as the JSON body and serialized preferences as a conversation header.
Strengthen the API contract assertion,then send the actual preference object
as the body with no conversation header. No server contract/DB migration is
needed for the intended existing format. Retain any already-malformed owner
preferences;show a recovery notice when defaults are used,do not silently
overwrite or invent lost choices. Real round-trip tests restore the exact prior
owner value after verification.

The same review found a pretend deletion Undo callback that only refreshed
history. Confirmed deletion has no restore endpoint. Remove that callback and
its false delayed-removal promise;retain the generic optional Undo primitive
for genuinely reversible actions. This hides an unsupported action,not a new
backend feature. Keep the existing5s notification duration but make its timer
independent of parent renders;remove layout-width countdown animation. Record
the intentional12px metadata floor change on authenticated/public surfaces.

For genuine browser200% zoom verification,a first-party dev-only unpacked Chrome
helper may call tabs.setZoom(2) in a fresh isolated profile on the exact loopback
origin. No content script,broad tabs permission,remote assets or network calls;
never install it in the owner's browser or ship it with Sanctum. Confirm getZoom
and actual viewport metrics;do not equate CSS zoom or a resized screenshot with
native zoom. Sources:Chrome tabs API and Playwright extensions documentation,
read2026-10-18. No source snippet or dependency is copied/admitted.

https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
https://playwright.dev/docs/chrome-extensions

All-theme/axe/full before-state/INP/streaming/S3-S7 and human-comfort requirements
remain open until actually executed. No fidelity threshold or release tag is
changed by this decision.
