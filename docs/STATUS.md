# Current state

- Step: public website foundation,ADR0064; exact chat/dashboard port still pending.
- Last green commit: `42f72249ed80434a7163d4f07bdf9cba3c1caf0e`;run38149885761/all5 PASS observed.
- Current slice: source157/Rust62/web37 PASS;38 denial/startup probes;website3 viewports PASS.
- Gate table: website functional PASS;full fidelity/axe OPEN;EXE/Linux packages OPEN.
- Open blockers: native gateway/packages missing;full voice,vision,agents,LAN,crypto unfinished.
- Next3: pinned upstream renderer reference;chat/dashboard fidelity;verified packaging.
- Main/tags: UI branch unmerged;no tags. Extended10-stage smoke PASS;exact-SHA hosted CI pending.

## Public website slice

The owner expanded the request to all website surfaces with Sanctum information.
ADR0064 supersedes the earlier marketing exclusion;no backend gate is relaxed.
The pinned upstream website/ is documentation;the live homepage is a separate
visual reference. No unverified artwork/font is copied. Original CSS artwork
and already admitted OFL fonts replace those assets. Browser and eventual
desktop shells share built assets;that alone does not verify an installer.

Contract/tests first: website-tests-first.log records the expected missing-file
failure. `npm test/run typecheck/run build --prefix apps/web` passes35+2 tests
and builds;`npm audit --audit-level=low --prefix apps/web` reports0 advisories.
`python tools/check.py` passes157 tests,lint/type/license/API gates.
`bash tools/check_rust.sh` passes62 tests,fmt/clippy,92 crate licenses and38
kernel denial/startup probes. Supervision has zero survivors at
0.581504/0.559540/0.585605s;these are not a full storm/active-shutdown gate.
`node evals/browser_website.mjs <Playwright> evals/results/website-browser.json`
passes1440x900,820x1180,390x844;zero foreign requests,sockets,page errors,
horizontal overflow or browser storage. FAQs,anchors,keyboard skip,reduced
motion and real app navigation pass. Screenshots inspected;fidelity remains
unverified. Website-only tests do not satisfy all-screen UI acceptance.

Baseline and first post-change9-stage real smoke PASS,release_complete=false.
Raw logs:evals/results/hermes-setup-*.log and website-*.log/json/png.
The extended10-stage smoke PASS is captured in website-smoke-final.log and
website-final-smoke-*.json/log;release_complete=false. Exact-SHA hosted CI pending.
Evidence copy error: broad copying included historical smoke outputs;those new
copies were removed and only observed run logs retained. No historical source
evidence was deleted (website-evidence-copy-correction.txt).

Reference provisioning: initial Docker pull failed because the WSL configuration
invoked an unavailable Windows credential helper. Isolated empty Docker config
retry succeeded;both logs preserved. Official Node image pinned by digest
sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8.
Upstream dependency installation is dev-only,ignore-scripts,throwaway HOME,
only the reference checkout mounted;product dependency tree is unchanged.

## Preserved history

Previous status is archived verbatim at
[history slice](status-archive/2026-10-11-history-before-website.md),SHA256
`12b35b81b7f2dd902ca8db64fc277329082672cb0d674c7adeaf49bb4a501477`.
Its older archive links and measurements remain intact.
