# Direction acceptance contract v1

Status: specified, not measured. Authority: ADR0078. No release gate is waived.

Evaluate the actual React components, not a separately styled marketing mock.
The gallery is development/test only; fixture content is clearly labeled and
never a product conversation or a claim of a working unavailable backend.

| Criterion | Pass condition | Evidence to record |
|---|---|---|
| Legibility | Body14-16px at100%; minimum12px; Paper65-75ch, line height1.6-1.7 | Computed styles, long-answer screenshot |
| Contrast | Normal text4.5:1; essential UI/focus3:1; all actual semantic pairs, every theme/mode | Pair names, foreground/backdrop, measured ratio; build fails below floor |
| Focus and keyboard | Every available action reachable; logical order; Escape/focus return; focus visible | Per-screen keyboard trace; no keyboard trap |
| Reflow | No lost content/control at200% zoom and390px; wide code/tables scroll inside container | scrollWidth/clientWidth and screenshots |
| Touch | Mobile actionable targets >=44x44 CSSpx, including dense mode | Bounding boxes; no invisible overlapping hit areas |
| Calm | One primary action per state; no decorative motion while reading; no sound | Two annotated critiques per direction |
| Scan efficiency | Role, error, pending state and source identifiable without color alone | Code/citation/error/busy comparisons |
| Consistency | Shared primitives and semantics across chat/settings/Knowledge/dialogs | Gallery inventory and journey results |
| Density/font scaling | Compact/comfortable/spacious and90/100/125% preserve controls and content | Matrix results; override density when target/floor requires it |
| Mode parity | Light and dark keep the same information, affordances and hierarchy | Paired screenshots, semantic-token comparison |
| Motion |120-200ms transform/opacity only; reduced-motion nonessential animation off | Computed styles and input during transitions |
| Performance | ADR0078 incremental budgets;lab p95<=200ms;stream CLS<=0.01 | Exact builds, hardware, raw samples; not field INP |
| Privacy | Zero foreign HTTP/WS requests; no remote assets; existing CSP/XSS gates intact | Same-origin browser journeys per theme |
| Reference preservation | Unchanged default id/palette and existing Hermes fidelity gates pass | Existing tests and measured fidelity JSON |
| Comfort | Five-person two-session study, including a two-hour session | USER_TEST.md; UNVERIFIED until real participants |

Coverage matrix: Paper/Night Study/Studio x light/dark x three densities x
90/100/125% x1440x900/820x1180/390x844 x six states: empty, streaming, long
answer with code and citations, error, engine-busy, composer/focus interaction.
That is972 combinations per pass. Separate component-state coverage includes
default/hover/focus/disabled/loading/empty/error for every applicable component.
Never invent meaningless disabled states for noninteractive prose.

Capture pass1, inspect, record specific defects, fix, then capture pass2. Do not
rename the same image into a second iteration. Store manifests/hashes and
contact sheets; retain failed captures as evidence. No third-party screenshots
or assets enter version control. A smaller partial run must report missing
matrix cells and cannot stand in for full coverage.

No weighted aesthetic score overrides a failed security/accessibility gate.
For human comparison, rate legibility, calm, scanning, consistency and comfort
1-5 with written reasons; these are subjective observations, not benchmark
numbers until collected. Only after all machine gates and two critique passes
does the ADR record a recommendation. Owner approval controls any default change.
