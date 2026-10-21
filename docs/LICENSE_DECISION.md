# License Decision: Jan (Apache-2.0) and Odysseus (AGPL-3.0-or-later) in Sanctum

**Date:** 2026-10-21  
**Status:** PROPOSED / DEFAULT IMPLEMENTED (Awaiting Owner Review in REVIEW_QUEUE)

---

## 1. Upstream Licenses Verified at Sources

### A. Jan Desktop
- **Repository:** `https://github.com/janhq/jan`
- **Pinned Commit:** `e7cbcf6d232f331313fd646b9131793ab2c5dc5c`
- **License:** Apache License 2.0 (`LICENSE` hash `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`)
- **NOTICE file:** None present in upstream tree.
- **Trademark Rule:** Apache-2.0 §6 explicitly grants no trademark rights. All Jan names, logos, hamster mascots, and marks are removed and replaced with Sanctum's name and plain geometric mark.
- **Attribution & Provenance:** Full Apache-2.0 license text preserved in `docs/licenses/jan-e7cbcf6-LICENSE.txt`, stated changes in `docs/ui-provenance.md`, and notices in `THIRD_PARTY_NOTICES.md`.

### B. Odysseus
- **Repository:** `https://github.com/odysseus-dev/odysseus`
- **Pinned Commit:** `8877273e195a90d51bc6a37f3a1b60dc3414c431`
- **License:** GNU Affero General Public License Version 3 or later (AGPL-3.0-or-later).
- **Permission File:** `docs/licenses/ODYSSEUS_PERMISSION.txt` contains owner note:
  > *"Yes you have permission , just no trace of odysseus and jan should be there in the code"*

---

## 2. Licensing Options

### Option 1: Written Permission / Proprietary Relicense
Rely exclusively on written permission from the Odysseus copyright holders to relicense under permissive or proprietary terms.  
*Risk:* Without a legally binding copyright assignment or explicit dual-license contract signed by all contributors to `odysseus-dev/odysseus`, distributing without AGPL source disclosures poses copyleft compliance exposure.

### Option 2 (Default Implemented): AGPL-3.0-or-later Distribution
Treat the combined distributed work as AGPL-3.0-or-later.  
- The complete corresponding source code is published and linked directly in the desktop installer, About dialog, and in-app Licenses screen.  
- Every upstream copyright notice and license header is preserved.  
- Both Jan (Apache-2.0, which is compatible with AGPLv3) and Odysseus terms are strictly fulfilled.  
- Trademarks and brand marks of both projects are stripped completely per owner constraint and trademark law.

### Option 3: Clean-Room Separation
Isolate Odysseus into an optional supervised external workspace pack that communicates only over loopback HTTP/IPC, or omit Odysseus code entirely if copyleft on the host executable is unacceptable to the owner.

---

## 3. Decision & Governance

1. **Default Selected:** Option 2 (AGPL-3.0-or-later for the combined distributed package with full corresponding source publication).
2. **Review Queue Entry:** Added to `docs/REVIEW_QUEUE.md` for formal owner sign-off.
3. **Execution Gate:** Until the owner explicitly confirms Option 1, 2, or 3, **zero Odysseus source code is merged into the host product tree**. All work proceeds on the Jan host shell, installer pipeline, and architectural integration contracts.
