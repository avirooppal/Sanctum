# UI provenance

Reference: NousResearch/hermes-agent at
`b30f95ac4a80d2f6dbe3aa01001b0524314f6d74` (ADR0051).

The initial inventory slice copied no upstream product code or asset. Static
source inventory is audit evidence, not a vendored implementation. Subsequent
needed adaptations are listed below. Append one entry per
adapted file before admission: upstream path, reference SHA, original byte SHA256,
modified yes/no, Sanctum path, applicable exact notice and asset license evidence.
The initial font candidates were pending selection/comparison; subsequent exact
admission and the recorded comparisons are documented below.

The source-excerpt inventory is covered by the MIT root notice copied verbatim
from upstream LICENSE to docs/licenses/hermes-agent-MIT.txt, also reproduced in
THIRD_PARTY_NOTICES.md. Every excerpt's source path and original byte SHA256 are
recorded in evals/results/ui-source-inventory.json. This is audit-only content;
none of it is imported by the application. The upstream pin above applies to all
these entries. The inventory is a modified extract, not an original source file.

## Native primitive geometry adaptation

| Upstream path | Pin | Original SHA256 | Modified | Sanctum path |
|---|---|---|---|---|
| apps/desktop/src/components/ui/button.tsx | b30f95ac4a80d2f6dbe3aa01001b0524314f6d74 | fec0302b7d1b67fec555838f45943607ef1ee0ba2e854caef236731b618c124e | yes: geometry/state rules only; native first-party implementation, no package imports | apps/web/src/ui/primitives.tsx and primitives.css |

MIT notice is reproduced exactly in THIRD_PARTY_NOTICES and the in-app Licenses
dialog. Native Input/Card/Dialog are first-party groundwork; no upstream fonts,
icons, images, logos or Electron dependencies copied. This is not completion of
the full theme/renderer port. Legal-notice bundling imports the existing notice
as plain text; no upstream markdown/HTML parser or external request path.

## Palette and color helpers

All entries use the pinned SHA b30f95ac4a80d2f6dbe3aa01001b0524314f6d74,
root MIT notice plus the reviewed palette-origin notices in ADR0056.

| Upstream path | Original SHA256 | Modified | Sanctum path |
|---|---|---|---|
| apps/shared/src/theme-presets.ts | ada88929c0500ce1f0a5b9d097c85c0ea6959c65107146bee8017445bd0e937b | yes: legal header and two branded preset IDs renamed | apps/web/src/ui/palettes.ts |
| apps/shared/src/color.ts |608965b40f22d98eede54d49319a5423acc12565f7d769a681ec725f33073cba| yes: legal header only | apps/web/src/ui/color.ts |

Classic conversion in themes.ts is a first-party adaptation of the inspected
desktop themes/skin.ts converter and classic seeds in themes/presets.ts; exact
source hashes are recorded in ui-theme-source-provenance.json. Dashboard-only
color seeds reference web/src/themes/presets.ts. Canonical Git-blob SHA256 and
checkout-byte SHA256 are both recorded, preserving the original checkout report
separately; the two shared files' canonical hashes match the listed hashes above.
No remote font URLs, custom skin
CSS, network/IPC code or upstream package dependencies copied. Semantic contrast
tiers are a deliberate mission-driven change (ADR0059); typography still pending.

## Bundled font files

Five unmodified binaries and exact primary notices are admitted by ADR0060.
Each entry in profiles/registry.json with scope web-font records original source
path/URL at the pinned Google/fonts revision, byte SHA256, family, license and
Sanctum binary/notice paths. Original and shipped binary hashes are identical.
No font is copied from the Hermes package/monorepo; excluded brand files remain
absent. Asset integrity is now an offline source/CI gate. The notices are also
included verbatim in the in-app Licenses text.

## Responsive shell geometry

First-party AppShell.tsx/shell.css adapts inspected geometry, not Electron/pane
implementation code. Upstream pin remains b30f95ac4a80d2f6dbe3aa01001b0524314f6d74.

| Upstream reference | Original SHA256 | Adaptation |
|---|---|---|
| apps/desktop/src/store/layout.ts |4ae5310b2f1c0f145baa680483e82698810dbf98d0f6c870f09d33d22b2a3e91|237px rail |
| apps/desktop/src/app/layout-constants.ts |5feb17140088ae55804d79ac5db27bfb6317a4f0fe9a5b431b11b318f44e0e95|640px dock floor |

Native single-sidebar focus/inert lifecycle and bounded viewport are first-party
code; MIT reference notices remain included. Other spacing/chrome still require
reference comparisons; no exact-layout/fidelity claim (ADR0061).

## ADR0078 research boundary

Public primary sources and our interpreted principles are in design/DIRECTIONS.md.
No third-party assets,screenshots,fonts,icons,code or dependencies were copied or
admitted. Existing bundled-font/notice gates passed in the baseline;this does
not license any referenced product's assets. No notices change is necessary
for original documentation alone.

## S1 unlock implementation

UnlockScreen/unlock.css are original first-party code;the small abstract diamond
SVG is original path geometry. Existing Archivo and registry-verified fonts only;
no icon pack,font,image,dependency or third-party snippet added. The original
THIRD_PARTY_NOTICES text is retained unchanged in a lazy same-origin attribution
chunk. Existing license gates pass;copy gate excludes only that named chunk.

ADR0080 observer and StartupBadge are first-party metadata/UI code,native
fetch/details only. No dependency,font,icon or external asset added. Existing
notices remain unchanged and are verified loading in the real browser.

Round3 adds only first-party CSS/TypeScript/tests. The Chrome native-zoom helper
is dev-only,restricted to loopback and never shipped/installed in the owner
browser. No font,icon,asset or dependency added. Native zoom results require
visual review;current clipped captures are retained as a failed gate.

Focused chat ADR0082 is original JSX/CSS using existing native details,fonts
and theme tokens. No copied third-party source,icons,fonts or packages added.

Landing ADR0083 uses owner-provided CSS/design direction,original project SVG,
lucide-react ISC icons and framer-motion MIT code. All5 newly locked packages
(including motion-dom,motion-utils,tslib) have registry integrity/license entries
and exact notices appended to THIRD_PARTY_NOTICES. tslib0BSD was reviewed,not
waived. Instrument Serif is pinned to upstream65c0ef225f386a3c7e87570a4aa9cc0262c2fd81;
source URLs,bytes and SHA256 in landing-font-provenance.json and the registry.
Exact OFL notices are bundled. Five supplied videos are excluded;see landing-media.md.
