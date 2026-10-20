#!/usr/bin/env bash
# ADR0085: do not emit legacy browser bundles as desktop installers.
set -euo pipefail
echo "Desktop packaging PENDING M11 (ADR0085); legacy web bundle retired." >&2
exit 1
