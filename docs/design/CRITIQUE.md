# UI Visual & Interaction Critique Rubric: Sanctum Workspace

Every major screen and slice must be evaluated against this rubric across:
1. **Light & Dark modes**
2. **At least 3 themes** (e.g. Sanctum, GitHub, Catppuccin, Solarized)
3. **Compact, Comfortable, and Spacious densities**
4. **Three viewport dimensions**:
   - Desktop: `1440 x 900`
   - Tablet: `820 x 1180`
   - Mobile: `390 x 844`

---

## 1. Critique Criteria
1. **Alignment & Visual Grids**:
   - All components align to the 8px spatial grid (or 4px half-step).
   - No irregular 1px/3px misalignments or accidental margins.
2. **Spacing Rhythm & Hierarchy**:
   - Hierarchy is immediately clear: Top-level headings > Section headers > Body text > Captions.
   - Spacing between distinct groups (e.g., 24px) is strictly greater than spacing within elements of the same group (e.g., 8px).
3. **Contrast & Legibility (WCAG 2.2 AA)**:
   - Body text contrast >= 4.5:1 against backing surface.
   - Large text / icons contrast >= 3.0:1.
   - Disabled states must remain legible (never washed out into invisibility).
4. **Truncation & Text Overflow**:
   - Long session titles, model IDs, and document paths must truncate gracefully with ellipsis (`text-overflow: ellipsis`) or wrap without breaking parent layout boundaries.
   - Zero horizontal scroll on the main viewport at 390px.
5. **State Completeness**:
   - Every interactive control has visible Hover, Focus-visible, Active, and Disabled states.
   - Empty states teach and guide the user towards immediate next steps.
   - Error states present what happened, why, and what the user can do.
6. **Zero Egress & Integrity**:
   - Zero foreign assets or remote fonts loaded.
   - Zero unreviewed telemetry.

---

## 2. Visual Critique Log: 2 Iterations per Major Screen

### Major Screen 1: Desktop Workspace Shell & Chat (1440 x 900)
- **Iteration 1 (Initial Build)**:
  - *Configuration*: Theme: `Sanctum` (Light), Density: `Comfortable`, Viewport: `1440 x 900`.
  - *Critique Findings*:
    1. Alignment: Right-docked inspector caused minor 4px jump during layout reflow when toggled open.
    2. Hierarchy: Model selector dropdown competed visually with session header title.
    3. Truncation: Long session names in history rail lacked ellipsis, pushing action buttons out of view.
  - *Remediations Applied*:
    - Fixed rail width to strict 280px flex-basis with `overflow-hidden`.
    - Styled model picker as quiet outline control; elevated header breadcrumb font weight.
    - Applied `truncate text-ellipsis` to conversation title buttons with `max-w-[180px]`.
- **Iteration 2 (Post-Refinement)**:
  - *Configuration*: Theme: `Catppuccin` (Dark), Density: `Compact` (85%), Viewport: `1440 x 900`.
  - *Critique Findings*:
    1. Contrast: Body text contrast measured 8.4:1 (exceeds WCAG AA 4.5:1).
    2. Spacing: Compact density scaled padding to 6px; verified touch targets on desktop remain >= 32px keyboard-accessible.
    3. Motion: Tab transitions instantaneous under `prefers-reduced-motion`.
  - *Remediations Applied*:
    - Fine-tuned subtle 1px border contrast (`--ui-border`) against dark surface. Verified zero layout shift.

---

### Major Screen 2: Tablet Dual-Lane Workspace (820 x 1180)
- **Iteration 1 (Initial Build)**:
  - *Configuration*: Theme: `Solarized` (Light), Density: `Spacious` (115%), Viewport: `820 x 1180`.
  - *Critique Findings*:
    1. Layout: In 2-column mode, citation chips in Knowledge panel wrapped onto 3 lines, causing jagged vertical rhythm.
    2. Touch targets: Quick prompt suggestion chips were 36px tall, falling below the 44px mobile/tablet target guideline.
  - *Remediations Applied*:
    - Switched panel slot layout to stacked vertical order when panel width drops below 400px.
    - Increased prompt chip minimum height to `min-h-[44px]` with `py-3 px-4`.
- **Iteration 2 (Post-Refinement)**:
  - *Configuration*: Theme: `GitHub` (Dark), Density: `Comfortable`, Viewport: `820 x 1180`.
  - *Critique Findings*:
    1. Grid: Strict 8px rhythm preserved across all composite cards and message bubbles.
    2. Hierarchy: Clear visual separation between active chat lane and collateral knowledge lane.
  - *Remediations Applied*:
    - Added subtle backdrop blur and elevated shadow to floating Jump-to-Bottom button.

---

### Major Screen 3: Mobile Workspace & Drawer (390 x 844)
- **Iteration 1 (Initial Build)**:
  - *Configuration*: Theme: `Sanctum` (Dark), Density: `Comfortable`, Viewport: `390 x 844`.
  - *Critique Findings*:
    1. Horizontal Overflow: Brand banner in mobile sidebar exceeded viewport by 4px (`scrollWidth 394px > 390px`).
    2. Toast Placement: Undo toast rendered edge-to-edge, touching bezel corners awkwardly.
  - *Remediations Applied*:
    - Replaced hardcoded banner margins with responsive `w-full box-border px-4`.
    - Added `left-3 right-3 max-w-[calc(100vw-24px)]` to `UndoToastContainer`.
- **Iteration 2 (Post-Refinement)**:
  - *Configuration*: Theme: `Catppuccin` (Light), Density: `Compact`, Viewport: `390 x 844`.
  - *Critique Findings*:
    1. Verification: `document.documentElement.scrollWidth <= innerWidth` evaluated strictly `true`.
    2. Focus & Dialog: Mobile drawer traps focus; Escape closes innermost modal cleanly.
    3. Contrast: Light mode surfaces maintain >= 4.7:1 text contrast.
  - *Remediations Applied*:
    - Verified complete state coverage (loading skeletons, disabled send button when prompt empty, error alert).

## 2026-10-17 cozy-direction scope — no visual pass claimed

ADR0078 adds acceptance criteria and research only. Existing narratives above
are historical and do not establish the new packs' results. No new theme pack,
new-theme screenshot,first/second critique pass,axe run,200% zoom check,lab
interaction measurement or two-hour user test has been performed. All remain
PENDING/UNVERIFIED. Current default/palette unchanged. First concrete audit
finding:TOKENS.md specifies11px metadata,below the new12px requirement;resolve
it explicitly for new directions without pretending the reference complies.

## S1 iteration1 — actual focused unlock

Date:2026-10-18. Before:ui-before;after:ui-after/round-1. Opened all8 new
screenshots (light/dark,three viewports,auth errors) at full resolution. Removed
locked shell,competing setup button,boxed divider,branding and absolute privacy
copy. One centered460px card;390px viewport uses358px card. Body and labels use
Archivo;key help and inline errors describe the actual runtime-file path.
Real valid/invalid owner authentication,setup/back focus,no locked shortcuts,
no browser-storage credentials and same-origin checks passed.

Measured button label contrast6.85586:1 light/7.16261:1 dark;48px height;card
horizontal center error<1px;0 root overflow at1440/820/390;0 foreign/page errors.
Full182 source,70 Rust,85 web/typecheck/build,audit0,38 probes,16 smoke stages
PASS. Source mapping initially failed because the new smoke was appended outside
the checked literal list;fixed the declaration without changing the checker.
Old speech-browser selected theme while locked;move after auth,retain geometry
assertions and restore actual preferences. Both failures retained as named logs.

Critique:card is clearer as a single task but the detached footer sits far from
it on tall screens;dark surface remains stark. A fixed privacy footnote is not
an observed-time status chip. Refine that with actual health,not a decorative
badge. Placeholder focus ring is strong;verify all text/input pairs,not just
the enabled button. Reduced-motion,zoom,axe,all-theme coverage and S1 iterations2/3
remain pending. No two-hour comfort,overall redesign or user-research claim.

Actual git-archive baseline rebuild including all JS chunks:JS gzip+95 bytes,
CSS gzip+555 bytes,under ADR0078 incremental budgets. Fonts/icons/dependencies
added0. This is a build-size result,not INP,load-time or streaming-CLS evidence.

## S1 iteration2 — real report,not a static privacy promise

Date2026-10-18. All10 ui-after/round-2 screenshots opened at full resolution:
light/dark three widths,real key errors and browser health-network failure.
Remove detached footer;lift card with semantic surface mix;shorten introduction;
link errors to input;show health-read time inside a native disclosure.
Browser failure simulation aborts the actual same-origin health request,not a
fake JSON response. Chip changes passed->unknown->passed after restoration.
Notices loaded and the original attribution was observed after authentication.

Actual primary contrast6.85586/7.16261;body14.36321/14.47226;hint8.90049/10.53863;
input boundary6.93219/9.24907;focus5.22290/4.90443.48px primary;0 root overflow,
foreign requests or page errors. Reduced-motion transition computed0s. The real
5s observer-deadline unit passes with the predeclared7s driver. Full182 source,
70 Rust,89 web/types/build,audit0,38 probes,16 smoke stages PASS. Build delta
868 JS/623 CSS gzip bytes from the same rebuilt baseline;no new assets/deps.

Critique:two stacked triangle disclosures look similar;the health disclosure
needs a clearer chip affordance. Failed health removes its time row and shifts
the centered card slightly. Reserve a stable row and say no current read instead.
Reference focus stays blue while owner accent is green;align override focus
with the existing contrast guard. Next iteration must retest keyboard/status
and preserve the original palette when no override is present. No overall UX,
all-theme WCAG,axe,200% browser zoom,INP/CLS or two-hour-comfort claim.

## S1 iteration3 — chip affordance and honest recovery

Opened all10 round3 unlock screenshots and4 native-zoom captures. The distinct
outlined chip separates status from key help. Its timestamp row remains present
when health is unknown;the browser geometry assertion stays within1px. Green
focus now agrees with the owner accent while the unmodified reference palette
is retained. Existing failed-preference serialization was fixed test-first.
The inherited11px labels and fake deletion Undo were exposed by runner review.

S1 iteration3 (2026-10-18): stable two-line startup chip; guarded owner accent
also controls focus. Preferences now serialize the actual preference object,
not the Content-Type header object; API test and browser readback cover it.
Malformed historical preferences are preserved with an honest recovery notice.
Unsupported deletion Undo and local-only message deletion are hidden. Metadata
floor is12px;notification duration remains5s without a layout-width animation.
Evidence:evals/results/redesign-round3-*;182 source,70 Rust,89 web tests,
typecheck/build,audit0,38 kernel probes;18 implemented smoke stages. Authenticated
shell runner covers5 widths;theme runner covers96 samples and3 system checks.
Unlock primary48px,contrast6.85586/7.16261;focus6.23336/5.83256;no foreign requests
or page errors. Actual archived-baseline rebuild:JS+862/CSS+739 gzip bytes.
Full redesign and release are NOT verified. Native Chrome reports zoom2 and
711x402 CSS viewport, but screenshot inspection finds clipped content despite
root overflow=false: zoom accessibility gate FAILED, not a passing claim.
See ui-after/round-3/native-zoom/review.json. Capture/layout diagnosis,axe,
all-theme contrast,streaming/performance and S2-S7 remain open. No tag or merge.

Critique:the locked view is now a focused task with one primary action, but
setup still uses the old workflow and authenticated controls need their own
redesign. The native-zoom automated root-overflow metric is a false positive:
visible clipping invalidates the accessibility claim. Preserve those images
and strengthen the test before using it as a gate. No two-hour comfort or
participant evidence exists;the five-person comparison remains UNVERIFIED.
