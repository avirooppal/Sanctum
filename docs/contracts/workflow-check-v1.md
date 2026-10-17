# Workflow consistency and secret-scan contract v1

The canonical workflow is docs/WORKFLOW.md. evals/journeys/manifest.json is its
machine registry:version,12 unique J1-J12 entries,exact journey:Jx test IDs,
status,title,ordered step IDs,ADR0071 budgets,blockers and blocked capabilities.
The gap table must inventory every step exactly once. Acceptance functions in
evals/journeys/test_*.py require one @journey("Jx") annotation each. Unknown,
duplicate,missing or unannotated acceptance tests fail the source gate.

The registry status must equal WORKFLOW and RELEASE_CHECKLIST status rows.
Website and bundled docs contain a generated workflow-status section with the
same version,IDs/statuses/titles. tools/workflow_check.py --write-public-status
updates these projections;the ordinary check is read-only and fails drift.
No generator promotes status from test output. VERIFIED requires real evidence,
passing action budgets and the required ledger/chaos outcomes,not a denial test.

tools/secret_scan.py scans Git tracked files and every file in evals/results,
including untracked evidence. It detects OpenRouter key-shaped values,redacts
them from diagnostics and emits file/line only,never the matching value.
Prefix-only prose is permitted;credential-shaped suffixes of16+ characters are
rejected. Future broker errors must use the same redaction helper. Tests create
synthetic credentials only in temporary directories and never log them.

Integrate both checks with tools/check.py so hosted source jobs execute them.
Journey runtime acceptance remains a separate real-gateway suite:contract CI
does not establish model/hardware/ledger results. Pending journeys may pass
negative capability checks while retaining PENDING status. A runner must not
skip a feature silently or mark it VERIFIED on that basis.
