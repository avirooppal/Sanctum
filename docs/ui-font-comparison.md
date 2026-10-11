# Font comparison evidence

This is substitution research, not the required upstream application screenshot
or accessibility report. [ADR0055](adr/0055-ui-font-substitution-selection.md)
records decisions and limits. [Raw120-row result](../evals/results/ui-font-comparison.json)
includes every input hash and metric. Fonts remain developer-only at this point.
Screenshots are in evals/results/ui-font-specimens/; they do not bundle font files.

Run with provisioned Playwright and the pinned developer font inputs:

```text
node evals/ui_font_compare.mjs <playwright-package> <reference-package-src/fonts> <candidate-font-directory> <output-directory>
node --test evals/tests/ui-font-metrics.test.mjs
```

Observed:120 render comparisons, network attempts0; metric unit tests2 PASS.
The fixed sample is `Knowledge / Models 0123456789`. Each comparison renders
two equal600x64 canvases; no normalization or branded-region masks. Width and
pixel differences are diagnostic numbers; no pass threshold was defined here.
Upstream font binaries are excluded from redistribution and product assets.
