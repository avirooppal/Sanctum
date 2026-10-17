# Redesign audit — initial baseline,2026-10-17

Starting commit1c0eb3b. Actual run:source182,Rust70,web81/typecheck/build,
npm audit0,38 denial probes,15 real implemented-feature smoke stages PASS.
Hosted39056409170 completed success/all5. This is not full-platform acceptance.

Before captures:evals/results/ui-before/manifest.json;129 screenshot records,
three themes (Sanctum,Catppuccin,Everforest),light/dark,1440x900,820x1180,390x844.
The eight contact sheets were visually opened;full-resolution unlock desktop,
mobile,empty chat and setup were also inspected. Thumbnail review is primarily
layout review,not a claim that every small label has been audited at full size.
Website/docs are fixed blue and do not implement these theme/mode choices.
No foreign HTTP/WS request or browser page error observed in that capture run.

The first harness failed attempting desktop navigation from a mobile viewport;
redesign-before-navigation-failed.log is retained. A later desktop dashboard
capture raced the route update;dashboard-route-race-failed.png is retained and
the capture now waits for the actual dashboard heading. Never count it as a
valid dashboard state. Inspect the final manifest/log before claiming a rerun.

| Screen/state | Observed defect | Required action |
|---|---|---|
| Locked,desktop | Full navigation/history heading and settings are visible before auth;large off-center form inside a centered main;two filled actions and boxed divider | Isolate a centered unlock card,one primary action;secondary review/help |
| Locked,mobile | Unnecessary menu and breadcrumb consume space;split headline;setup/form stack dominates viewport | No shell while locked;compact clear hierarchy;safe viewport/reflow |
| Copy/branding | Hermes Style badge;100%/zero cloud telemetry claim;Paste local.token jargon | Remove marketing attribution;plain evidence-scoped copy;key location help |
| Unlock controls | Two different button treatments;serif/uppercase labels;custom accent does not update foreground | Shared primary/button tokens,UI sans labels;measure actual button ink |
| Auth error | Real rejected-key error is far below the field in the app shell | Inline alert and retained recovery context;never echo key |
| Setup review | Dense operational text;unknown hardware honestly shown;button has little emphasis | Focused review,clear limitations and progressive disclosure;no fictional provisioning |
| Empty chat | Greeting sits far from composer;meeting/speech chrome competes;no actionable prompt chips | S3/S6 real suggestion actions,clear composer hierarchy;capability gating |
| Many conversations | Existing real history is crowded;rename/delete repeated in every row;sidebar footer displaced | S5 list hierarchy/context actions,keyboard and empty-state guidance |
| Settings | Mobile two-column form severely cramped;dense palette/buttons;labels tiny | S7 responsive form patterns,progressive disclosure,keyboard/contrast tests |
| Dashboard |237px reference rail leaves very narrow390px content;heading wraps into slivers | Separate responsive dashboard navigation;retain measured reference variant |
| Website | Fixed saturated blue/display headline dominates;console command assumes terminal;platform claims need checklist alignment | Rework later without advertising unverified installers;truthful status |
| Docs | Same fixed blue treatment;dense small text and navigation;not theme-aware | Reading measure/hierarchy and explicit reference deviation |
| Streaming/code/citations | Not captured in this initial matrix | PENDING:real generation plus real cited Knowledge answer;never inject model text |
| Long answer | Not captured in this initial matrix | PENDING:real saved/generation answer;scroll/copy/overflow review |
| Engine busy | No actual overload induced in this initial matrix | PENDING:bounded real saturation and observed503/Retry-After;no fake product error |

The owner's a-f issues are confirmed in source and inspected screenshots.
Issue g is mixed:sidebar claims are static,but the bottom StatusBar already polls
real health and marks startup checks passed/unknown with Ledger unavailable.
Preserve that useful evidence and remove duplicate static claims. It does not
prove complete egress history. A timestamped explanatory chip still needs tests.

This audit does not claim every requested state is captured or every screen
is accessible. Missing captures and three S1/S3/S4 critique passes remain open.
Human two-hour comfort is UNVERIFIED;use USER_TEST.md. First implementation
scope is copy and S1,with its own real before/after and regression evidence.

Final capture rerun completed129 records with0 foreign requests,0 page errors
and0 root horizontal-overflow flags. Corrected dashboard capture opened at full
resolution;it shows the actual status screen. Reading it revealed additional
static guarantees ("exclusively"/"never leave") to remove in the copy slice.
No busy/long/combined citation coverage is inferred from this result.
