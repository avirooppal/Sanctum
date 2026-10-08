# vision-docs

Planned: Python structural parsing, OCR and VLM adapters. Implementation: Phase 2/4.

Contract: no executable service yet. Foundation request envelope is in
`docs/contracts/diagnostics.openapi.json`; versioned service contracts must be added
before tests and implementation.

Config: cloud disabled; no listeners or service startup configured. Future adapters
read model/engine profiles rather than hardcoded model names.

Tests: no service tests exist yet; do not count this placeholder as coverage.
Run foundation gates from repository root with `uv run --offline python tools/check.py`.
