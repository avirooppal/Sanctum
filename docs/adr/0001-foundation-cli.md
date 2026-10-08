# ADR 0001: Python diagnostic CLI; Rust control plane remains required

Date: 2026-10-08
Status: accepted

## Context
The supplied plan specifies Rust for gateway, scheduler and policy but leaves
the CLI language open. This development host has Python/uv and no Rust toolchain.

## Decision
Implement the read-only Phase 0 CLI in Python, managed by uv, with zero runtime
package dependencies. Use unittest, Ruff, ty and JSON Schema validation for gates.
Keep the exact section 13 layout. Preserve the attachment verbatim as plan.md.
Defer Rust crates until their first executable contract rather than empty crates.
License original scaffold code under MIT. Review installed development dependency
metadata and record exact versions/licenses in the model/dependency registry.
Replace the initially tried mypy/hatchling tooling because it pulls MPL-2.0
pathspec; use ty and setuptools instead. OS utilities are host prerequisites,
not bundled components; packaging must review their redistribution separately.

## Consequences and verification
No control-plane stack substitution. Source checkout is the distribution in this
slice; pass --profiles explicitly when running outside the repository. Wheels and
desktop installers need bundled profile resources in a later packaging slice.
