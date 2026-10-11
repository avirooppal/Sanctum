# ADR0052: package audit and local primitives

2026-10-11; applies to ui-hermes-port. Source pin is ADR0051.

The upstream dashboard pins @nous-research/ui0.18.2. Public npm metadata and
the downloaded tarball package.json declare MIT. The package has no separate
LICENSE/COPYING file, and its stylesheet automatically registers brand fonts.
Those fonts do not gain redistribution rights from the JavaScript declaration.
Its dependency tree is not Sanctum's reviewed lockfile.

Decision: do not install or copy this package wholesale. Adapt only needed MIT
monorepo tokens/components, preserve the root exact notice, list each copied file
and source hash, and keep ADR0025 local Tailwind compilation. New dependencies
need individual permissive-license and audit checks before admission. This is a
legal/privacy boundary, not a declaration that fidelity has passed. No package
code or assets have been copied by this decision.

Evidence: .sanctum/upstream/nous-research-ui-0.18.2.tgz;
.sanctum/upstream/ui-package/package/package.json and src/ui/fonts.css;
https://registry.npmjs.org/@nous-research/ui/0.18.2.
