# ADR 0096 — Exact Upstream UI/UX Port, Superseding Fresh Implementation and Preact Decision

Date: 2026-10-21  
Branch: `jan-style`  
Status: PROVISIONAL — Owner Instruction Adopted  

---

## Context

On 2026-10-21, the repository owner issued the explicit instruction:
> "TASK — PORT JAN'S UI/UX INTO SANCTUM, COPIED EXACTLY; INVENT NOTHING.
> Owner instruction: copy the UI/UX of Jan (https://github.com/janhq/jan) exactly as it is. Do not design anything of your own, do not "improve", re-theme or re-layout. Copy the whole thing. This overrides every earlier UI prompt, wireframe, design-direction and redesign instruction (archive them under docs/ARCHIVE.md; do not delete evidence) and it supersedes ADR 0089 ("write fresh, copy no Jan code") and the provisional Preact choice in ADR 0092. Record one ADR for this owner decision."

---

## Decisions

1. **Exact UI/UX Port from Pinned Upstream**:
   - Pinned upstream source: `janhq/jan` at commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c` (Apache-2.0).
   - Upstream frontend application located under `web-app/`.
   - Supersedes [ADR 0089](0089-jan-study-and-fresh-implementation.md) (which previously directed fresh clean-room code).
   - Supersedes [ADR 0092](0092-b3-ui-stack-candidates.md) (which provisionally selected Preact 10). The upstream stack (React 19, Tailwind CSS v4, TanStack Router, Zustand, Radix UI) is adopted to ensure 100% visual and behavioral parity.

2. **License and Trademark Compliance**:
   - Upstream license is Apache-2.0 (`docs/licenses/jan-e7cbcf6-LICENSE.txt`, SHA256 `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`).
   - Copied files preserve copyright headers and Apache-2.0 declaration.
   - Trademark rule: Apache-2.0 grants no trademark rights. The name "Jan", logos, Hamster mascot, and brand marks are replaced with Sanctum's plain mark.
   - All copied files tracked in `docs/ui-provenance.md` and credited in `THIRD_PARTY_NOTICES.md`.

3. **Permitted Deviations (recorded in `docs/ui-deviations.md`)**:
   - Brand name and logo substitution.
   - Purge of all third-party network egress: telemetry (PostHog), update checks, auto-updater, crash reporting, remote fonts/avatars, remote catalogs.
   - Native/Tauri compatibility adapter mapping upstream calls to Sanctum's local gateway core.
   - First-launch consent dialog for model acquisition (no automatic background downloads).
   - Model hub/catalog requests gated through egress broker with consent and ledger logging.
   - Privacy/assurance: No unverified claims; assurance indicators require explicit owner sign-off.

4. **Archive of Obsolete Work**:
   - Custom wireframes, Preact experiments, and preliminary bespoke UI layouts are archived in `docs/ARCHIVE.md`.

5. **Reality Rules & Parity Table**:
   - All active controls must be backed by real gateway endpoints (`docs/UI_PARITY.md`).
   - Screens or controls without a passing backend test are kept `PENDING-BACKEND` and hidden from the user until backed.
   - Zero mock data, zero fabricated throughput figures.

---

## Consequences

- The desktop UI bundle size will reflect the full upstream dependency tree (~150–400 KB gzipped vs the earlier 20 KB skeleton). Performance budgets in [ADR 0094](0094-b7-measured-performance-budgets.md) will be updated with measured reality in `docs/PERFORMANCE.md` and `docs/REVIEW_QUEUE.md`.
- Full pixel-level and structural parity against upstream reference captures.
