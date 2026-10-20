# Development UI reuse library

ADR0085 retired all HTML entry points and the old shell. This package is not a
runnable product. It retains first-party protocol/Markdown utilities for
reviewed M3 reuse in the future desktop. Five M8-only audio helpers were removed under ADR0087. No UI capability is claimed by its build.

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit`.
The real-gateway check is `node ../../evals/retired_ui.mjs <playwright-package-path>
<output-json>` with SANCTUM_BASE_URL pointing at the provisioned runtime.
See ../../docs/ui-provenance.md for limitations and license provenance.
