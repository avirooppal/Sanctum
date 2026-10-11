# Web font assets v1

Fonts are trusted build inputs, never fetched from the network by the product.
Each admitted binary has a web-font dependency entry in profiles/registry.json:
family/name, pinned source revision, OFL1.1, primary license/source URLs, asset_path
and SHA256, notice_path and SHA256. Preserve exact notice and unmodified font.
Paths resolve inside apps/web/public/fonts and public/licenses/fonts respectively;
reject escapes and symlinks to outside the workspace. Every shipped font must be
registered; missing or modified binary/notice fails the offline gate. Check the
primary notice identifies the SIL Open Font License1.1; this verifies admission
evidence integrity, not legal permission by itself (primary audit is ADR0053/55).

Unit tests: correct admitted files, binary/notice tamper, non-OFL/unknown asset,
path escape. Real gate runs offline on actual pinned fonts and normal CI. The
browser must load actual faces, with only same-origin requests; OS fallback is
not evidence that a bundled face loaded. No unverified brand fonts included.
