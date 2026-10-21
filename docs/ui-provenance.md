# UI Provenance Ledger

This ledger tracks all files ported from upstream Jan (`janhq/jan`, Apache-2.0, commit `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`).

Upstream repository: `https://github.com/janhq/jan`  
Pinned commit: `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`  
License: Apache-2.0 (see `docs/licenses/jan-e7cbcf6-LICENSE.txt`, SHA256 `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`)  
Root notice: None present upstream  

## Provenance Records

| Upstream Path | Commit SHA | Original SHA256 | Modified | Sanctum Path | License | Notes |
|---|---|---|---|---|---|---|
| `web-app/src/index.css` | `e7cbcf6d` | `6c221cf6...` | Yes | `apps/web/src/index.css` | Apache-2.0 | Retained Tailwind v4 theme tokens and styles; stripped telemetry font imports |
| `web-app/src/components/ui/*` | `e7cbcf6d` | (per file) | Yes | `apps/web/src/components/ui/*` | Apache-2.0 | Radix UI primitives, shadcn components; branded marks replaced with plain mark |
| `web-app/src/locales/en.json` | `e7cbcf6d` | (per file) | Yes | `apps/web/src/locales/en.json` | Apache-2.0 | Cleaned string table; replaced brand name with Sanctum |

*(Table will be updated incrementally for every ported file)*
