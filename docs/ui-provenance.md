# UI provenance

Reference: NousResearch/hermes-agent at
`b30f95ac4a80d2f6dbe3aa01001b0524314f6d74` (ADR0051).

No upstream product code or asset has been copied yet. Static source inventory
is audit evidence only, not a vendored implementation. Append one entry per
adapted file before admission: upstream path, reference SHA, original byte SHA256,
modified yes/no, Sanctum path, applicable exact notice and asset license evidence.
Font candidates are pending actual binary selection and render comparison.

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
