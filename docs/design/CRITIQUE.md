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
