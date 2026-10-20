# ADR0090: Explicit file-level MPL dependency policy

Date: 2026-10-20. Status: PROVISIONAL owner review; conditional admission proposed.

B2's locked source graph contains MPL-2.0-only crates: cssparser0.37.0,
cssparser-macros0.7.1, dtoa-short0.3.5, option-ext0.2.0 and selectors0.38.0.
All three candidates transitively include option-ext; Tauri also includes the CSS
crates. `cargo tree` and b2-source-license-inventory.json record paths, source
archive checksums and license evidence. The existing product gate rejected
unregistered adler2 before reaching license policy; that failure is preserved.
No experimental dependency is admitted to the product by that failed run.

Recommendation: permit reviewed MPL-2.0 files with exact source availability and
notices. Keep Sanctum-authored files under their current license. MPL files and
modifications to them remain covered; do not copy MPL snippets into unrelated
product files and then label them MIT.

This explicitly amends the earlier blanket exclusion only for entries that:

1. Identify exact package version, archive SHA256, originating repository and
   file-level license evidence. Ambiguous or missing evidence fails admission.
2. Preserve the MPL text and applicable copyright/license notices in the
   distributed notices bundle.
3. Include the exact covered source archive (plus any patches and build
   instructions) in the offline distribution, with a readable manifest telling
   recipients where to find it. Do not rely solely on a mutable upstream URL.
4. Record modifications, if any, and keep covered files under MPL-2.0.
5. Have an explicit reviewed registry entry and automated packaging/hash check.
   A generic SPDX-string allowlist is insufficient.

Source: [Mozilla MPL2.0 sections3.1–3.4](https://www.mozilla.org/en-US/MPL/2.0/)
and [Mozilla FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
This policy does not admit GPL/AGPL-only application dependencies or unreviewed
binary blobs. Alternative permissive licenses may be selected only when the
actual source supplies that choice. Product gate implementation and admission of
the selected shell's exact graph remain required before M2 can claim license PASS.

## System WebViews and SDK loader

OS-provided WebViews are distinct from bundled crates. Inventory their versions,
licenses, required installation and process memory; do not pretend they have no
size/resource cost. No runtime download is authorized by this policy.

The Windows experiment links WebView2Loader.dll from webview2-com-sys0.39.1.
It matches byte-for-byte the x64 loader in Microsoft's official NuGet package
Microsoft.Web.WebView2/1.0.3800.47:
SHA256 `86545b66cdb0603bc26b626fb9ad610cb6e71f28d468f5ea66df23b03dda96d5`.
The primary package's LICENSE.txt grants BSD-style three-condition redistribution;
its full NOTICE.txt is preserved too. This is evidence for that loader version,
not a claim that all WebView2 runtime components are MIT/BSD.
Source package: `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.3800.47/microsoft.web.webview2.1.0.3800.47.nupkg`,
SHA256 `56c9f26bdd07916a2d1949fb58a5c7e434dfa1173577dca879206050c4e718db`.

No release artifact is produced here. B2 measurements do not certify egress
containment of WebView processes or compliance of future installers.
