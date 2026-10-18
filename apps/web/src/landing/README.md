# Public landing

Contract:[landing-v2](../../../../docs/contracts/landing-v2.md),ADR0083.
`/website.html` mounts Index.tsx;chat remains at `/`. React,TypeScript,Vite,
the existing local Tailwind compiler,framer-motion and lucide-react are pinned.
Instrument Serif regular/italic and notices are local,hash-admitted OFL files.
No Google Fonts/CDN requests,storage,signup or newsletter backend.

Scene renders original project SVG artwork. Reference clips are not shipped;
see docs/landing-media.md before admitting any media. The loop adapter uses
injected clocks for tests and cancels RAF/timers/listeners on cleanup. Real
reference-media playback remains unverified until rights and files exist.

From repository root:`npm test --prefix apps/web`,then typecheck,build and
`npm audit --prefix apps/web --audit-level=low`. Tests include the loop's fade,
restart,cleanup and autoplay rejection. Run `bash tools/run_source_gate.sh`
for exact package/font-license admission and platform-status consistency.
With the confined gateway on8769:
`node evals/browser_website.mjs PLAYWRIGHT_PACKAGE OUTPUT_JSON` checks all
links,three widths,reduced/normal motion,fonts,JS budgets and HTTP/WS egress.
The same test runs inside `bash tools/smoke_all.sh`.
