# ADR 0066: Gate Execution Strategy and Environment Hygiene

Accepted 2026-10-11.

## Context
During development sessions, environment drift (e.g. host PYTHONPATH inheritance pointing to Python 3.10 packages containing unreviewed dependencies like `cloudpickle`, or virtualenv creation attempts on `/mnt/c/`) repeatedly caused gate setup failures. In addition, synchronous execution of long multi-minute test suites risked timeouts and unnecessary process cancellations mid-run.

## Decision
1. **Isolated Source Gate (`tools/run_source_gate.sh`)**:
   - Explicitly unsets `PYTHONPATH` and `PYTHONUSERBASE`.
   - Directly binds to the verified Linux development virtual environment (`/home/aviroop/.local/share/sanctum-dev-venv/bin/python`) rather than re-creating virtualenvs inside `/mnt/c/`.
   - Tees all execution output to a named log and returns a clean, deterministic exit code and summary.
   - Companion PowerShell wrapper `tools/run_source_gate.ps1` dispatches directly into WSL Ubuntu 22.04.

2. **Differentiated Verification Cadence**:
   - Docs-only commits: Verify encoding, markdown formatting, links, and license registries locally. Full test suite execution is verified via hosted CI on the exact push SHA.
   - Code, test, configuration, and evaluation commits: Must run the full local regression gates (source gate, Rust gate, web gate, and relevant smoke stages) before committing, followed by exact-SHA hosted CI verification.
   - Long-running gates must run in the background logging to disk, checked asynchronously at sensible intervals, and must never be killed while actively progressing.

## Consequences & Gate Impact
- Relaxes no gate: All quality, security, and verification gates remain at 100% enforcement, and hosted CI tests the complete matrix on every push.
- Eliminates repeated environment rediscovery and prevents virtualenv bloat.
