# ADR 0025: Dependency-free Tailwind core compilation

Accepted 2026-10-10. Fresh npm install exposed ten advisories in the existing build
tree. `braces` <=3.0.3 has no published patched release; Tailwind 3 brings it through
its scanner dependencies. Upgrade to pinned MIT Tailwind 4 core, which has no runtime
dependencies, and invoke its CSS compiler with a small local source-token collector.
Keep React/Tailwind; do not adopt the optional native scanner/PostCSS integration
without a separate permissive-license review. Update Vite/PostCSS/Rollup to verified
patched versions and review every resulting lockfile license/integrity.

The collector supports this application's literal utility class names, including
responsive and bracketed values. It does not construct arbitrary dynamic class names;
future such syntax must come with a compiler/browser regression. CSS imports are
restricted to the installed Tailwind package, no network loader. Generated CSS is a
build artifact. Native modern CSS replaces the old autoprefixer build stage.

Keep actual browser styling checks, controller tests, type checks, license scans and
npm audit. No advisory is suppressed and no security threshold is relaxed.

Sources: [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[Tailwind compiler](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/packages/tailwindcss/src/index.ts),
[MIT license](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/LICENSE).
