# ADR 0008: Pin the working frontend build graph

Date: 2026-10-08
Status: accepted

Vite 7.1.7 with automatically resolved Rollup 4.64.2 stalled while transforming the
small UI on both Windows and Linux, consuming over 1 GiB. Pinning Rollup 4.52.2
completed the same build in 1.60 seconds. Keep the override and lockfile; upgrade
only with a successful build and browser smoke test. Tailwind 3.4.17/PostCSS is
the verified CSS build path. React/TypeScript remain unchanged.
