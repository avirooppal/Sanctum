# Workflow UI alignment v1

Setup performs no fake provisioning,hardware detection or auth bypass. First
screen accepts a required owner key and Check local runtime. It fetches real
capabilities/models/health;review shows configured model/profile plus Unknown
hardware tier when unavailable. Open workspace is enabled only after valid
metadata and scoped denial checks. Cancel/Back discard the pending operation.
No fake key,no hardcoded model options,no inert folder/download field.

Privacy message without evidence: "Startup checks: unknown. Ledger unavailable."
With all eight expected kernel checks denied,healthy status,cloud disabled and
the known isolation backend: "Startup denial checks passed. Ledger unavailable."
No zero-byte,zero-egress-history or air-gap claim. Failed polls clear the badge.

GatewayError keeps HTTP status and a validated numeric Retry-After field;its
message uses WORKFLOW's taxonomy. Unknown errors become E_UNKNOWN,network
failures E_OFFLINE,abort E_CANCELLED. Never expose provider bodies or stack traces.
The old API-client test's503 regex becomes a stronger status/message/no-replay
assertion;no security assertion or numeric threshold is weakened.

Full Purge remains absent without full_purge. The legacy HTTP endpoint still needs a separate non-mutating safety fix;
this contract does not claim that it is repaired. Developer
gallery and unsupported layout actions have no production route. Registry facts
show actual values or Unknown. Real browser tests exercise wrong-key,setup,
runtime review,status and egress. Existing real smoke covers first answers
and chat controls;full pending-control/chaos coverage is not established.

## Dashboard/profile alignment (ADR0076)

Dashboard clears previous health/dispatch on refresh failure. It never defaults
to Healthy,denial passed,active isolation,450MiB RAM or zero queue counts.
Metadata loads sequentially with one AbortController;unmount cancels and5s
polls cannot overlap. Safe taxonomy handles failures,not raw provider messages.
Profile writes use the existing metadata lane and64KiB handler bound. CRUD
changes are owner-authenticated and have no automatic retries. UI shows save
progress,disables concurrent save/delete and labels definitions as not applied
to chat automatically. Full J9/J11 remain partial without their other steps.
