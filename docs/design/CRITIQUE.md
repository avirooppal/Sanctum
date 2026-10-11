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
