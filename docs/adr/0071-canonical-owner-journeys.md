# ADR 0071: Canonical owner workflow v1

2026-10-17, owner-directed. WORKFLOW.md v1.0.0 is the normative user-side
contract for J1–J12. It supersedes contradictory onboarding, copy, wireframes
and navigation in ADR0068/0069; it retains single-owner scope (ADR0027),
confinement, quality gates and capability-gated unfinished features.

## Budgets fixed before journey measurements

Count real pointer activations, navigation key presses (including Enter/Tab),
and text-entry operations separately. A shortcut chord counts as one navigation
key action. Text-entry operations count a completed field entry, not a fabricated
physical keystroke count from Playwright.fill. Record typed character counts
separately, excluding secrets. OS file/installer dialogs are included when
measurable; otherwise the whole affected journey remains PENDING. No timing
or click result from older smoke is retroactively treated as a journey result.

| Journey | Max clicks/taps | Max navigation keys/chords | Max text entries |
|---|---:|---:|---:|
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

Budgets cover one documented happy-path execution, including explicit consent
and confirmation. Failure/recovery variants report separate action counts and
must preserve existing cancellation/deadline/resource bounds. No existing
threshold is loosened. J2 has no mandatory model/profile question: detect the
choice, require consent and offer only an optional Knowledge folder.

## Truth and measurement

Each journey has a stable journey:Jx acceptance ID. A passing unit, legacy smoke
stage or negative capability test does not verify the entire journey. VERIFIED
requires its real runner, action/time measurements, outcomes and required ledger
events; absent policy/ledger remains a gap. A capability-denial check can pass
while its journey is PENDING. Low-level regression suites are supporting tests,
mapped to journeys; the bidirectional-ID check applies to registered journey
acceptance tests, not every unit test function in the repository.

Every step is inventoried in WORKFLOW_GAPS.md. A source reference without a
fresh execution result is explicitly source-only evidence. Unknown hardware,
fit, tokens, progress and privacy status render unknown, never a fabricated
success. Remove simulated provisioning and false privacy/purge promises.
Capability discovery fails closed; a registered screen needs its capabilities
and a passing journey subflow before it is exposed. A readable roadmap/status
document may describe unavailable work without exposing an action for it.

## Local and cloud boundary

J10 is a new owner-authorized optional scope, superseding omission of cloud
connectors in prior UI decisions. It remains absent until Phase5 policy/ledger
and the confined broker exist. No key-entry UI; only the broker reads
OPENROUTER_API_KEY. No cloud/local fallback in either direction. Restricted
documents, meetings, images and tool output stay local. Tests use a loopback
fake for the connector. The model name requested by the owner is a candidate,
not a verified registry entry or default.

J2 offline pack import is the zero-egress path. CLI --allow-network is explicit
developer artifact provisioning outside the confined runtime; it discloses IP
and artifact identity to its source, not user content. It must not be presented
as a zero-egress product download. Product download/resume stays hidden until
its consent, policy and ledger path exists. No live connector check at this stage.

Purge tests require a disposable, isolated state directory. The current storage
operation does not erase Knowledge or backups: hide the Full Purge promise until
its implementation and crash/cancellation tests cover the documented scope.
No forensic erasure claim for SQLite pages, backups or the underlying disk.
