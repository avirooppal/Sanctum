# Pre-pivot archive

The previous public website, docs website and Hermes-style UI work is preserved
at tag [`pre-pivot-2026-10-20`](https://github.com/avirooppal/Sanctum/tree/pre-pivot-2026-10-20),
commit `1bee37bc777318b1913aac0a95eb9315e29cfa05`.

See [ADR0084](adr/0084-pivot-to-jan-style-app.md). The tag is not a release.
Retirement is recorded in ADR0085 and docs/legacy-ui-removal.json. Fresh baseline
evidence also exists at checkpoint 625e48e706d431d546474e2ee9c9f71d7baea127.
Existing untracked local files are not included in a Git tag.

Prior STATUS.md: `docs/status-archive/2026-10-20-pre-retirement-status.md`, SHA256 `c09c27519b4c44d4917b160f50bbe4c75783142026f15adae7141b9e640dbb4c`.

Prior WORKFLOW.md: `docs/status-archive/2026-10-20-pre-retirement-workflow.md`, SHA256 `062834532356d3f5dfd270770e9897576399a9aafe2b097f4ffdf2d647604c11`.

Prior WORKFLOW_GAPS.md: `docs/status-archive/2026-10-20-pre-retirement-workflow_gaps.md`, SHA256 `6aeb305f69e31195e28bff24855a6e98c020fbd6b2a2c14b916ef2103c0bfa84`.

Prior RELEASE_CHECKLIST: `docs/status-archive/2026-10-20-pre-retirement-release-checklist.md`, SHA256 `0e01ec297d489a0ae602214024aa36ea341d316f8520b476f940f54156370d4e`.

20 A4 full prior STATUS: `docs/status-archive/2026-10-20-before-a2-a5.md`, SHA256 `d15ab35c3c79b880614b01a8087cd81a44892133b7f2418d9c069a29bdc95f50`.

---

# UI Pivot Archive — 2026-10-21 (ADR 0096)

By explicit owner directive on 2026-10-21, all earlier custom UI/UX prompts, wireframes, bespoke layouts, and redesign attempts are archived and superseded by an exact 1:1 port of Jan's UI (`web-app` at pinned commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`).

### Superseded Artifacts Preserved:
1. **ADR 0089** (Fresh clean-room implementation boundary): Superseded by ADR 0096.
2. **ADR 0092** (Provisional Preact 10 selection): Superseded by adopting upstream React 19 / Tailwind / TanStack Router stack.
3. **Bespoke Wireframes**: `docs/design/wireframes/` (Critiques 1 & 2 preserved as design reference).
4. **Bespoke UI Reuse Library**: `apps/web/src/` (Custom PanelRegistry, bespoke Sidebar, ChatPanel, ModelHub, ThreadDrawer).
5. **UI Workspace Notes**: `docs/UI_WORKSPACE.md`.

