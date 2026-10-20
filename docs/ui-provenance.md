# UI reuse provenance — ADR0085/0087

A3 current boundary: six modules with named M3 consumers remain. Five audio/meeting
helpers with only M8 use were removed with11 dedicated tests. See
UI_MODULE_RETENTION.md and a3-dead-code-removal.json for paths/hashes. The review
below describes the earlier eleven-module salvage, now narrowed by ADR0087.

No Jan source, marks or assets have been introduced. Pinned study and license/NOTICE
verification are PENDING M1. The Hermes shell, palettes, fonts, artwork, reference
runtime, mock bridge and fidelity artifacts are retired; see docs/legacy-ui-removal.json
for exact Git blob SHA256 values and the archive commit. Historical ADRs are not
active website dependencies.

Eleven first-party modules survive unchanged: API/WebSocket transport and
cancellation; health observation; truthful privacy/error reporting; workspace
bootstrap; PCM, microphone, worklet, meeting and speech helpers; SafeMarkdown.
The manifest lists each exact path and pre-removal hash. Review found no imports
from the removed reference/UI packages. SafeMarkdown escapes HTML, restricts link
schemes and omits remote images. It still needs future desktop styling and link
egress integration. Audio helpers remain development candidates for packs, not a
claim of lifecycle or optional-pack isolation. Existing speech transport needs the
future central broker review before being exposed by the desktop.

React and React DOM remain MIT, exact source license verified at tag v19.1.1 and
retained in THIRD_PARTY_NOTICES.md. License evidence is
`evals/results/pivot-removal-react-license.json`. Remaining dependency registry
records retain their original reviewed versions/integrities; no new dependency or
license exception is admitted. No tokens/themes were salvaged from upstream designs.

The library is rechecked with TypeScript, unit tests, production library build,
license/secret gates and a real Chromium Markdown injection check. The runtime
retirement test additionally checks real 404 responses, health and API authentication.
This does not verify a desktop experience, pack lifecycle, tool host or egress broker.

## B1 Jan source study

ADR0089 and docs/design/JAN_STUDY.md pin e7cbcf6d232f331313fd646b9131793ab2c5dc5c. Adapted source/asset inventory: empty. Only exact license evidence was copied to docs/licenses; fresh Sanctum implementation is recommended. Any future adaptation needs a new ADR/provenance row before copying.
