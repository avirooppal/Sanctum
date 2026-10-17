# ADR 0074: Runtime-backed onboarding and scoped privacy claims

J2/J9/J11/J12 supersede fixed T1 hardware,timer-based provisioning,fake fallback
owner keys,unconditional egress success and unbacked model-role cards. Replace
setup with owner authentication and actual metadata/self-test review. Hardware
tier/fit stay Unknown until a real detected recommendation is supplied. No
model-selection decision is required;use the configured first text model.
No download/folder registration control exists until its actual backend does.

Status displays only complete current denial-check evidence. It never infers
zero historical outbound bytes or a working Privacy Ledger. Null,partial,
failed and stale health reports show Unknown/unavailable;engine readiness is
not inferred from a generic health200. Show unknown licenses/context/fit instead
of fabricated defaults. Keep current polling intervals;prevent overlapping
polls and cancel them on unmount. No timeout or SLO changes.

Full Purge is unsafe:the HTTP route deletes conversation tables,then attempts
Knowledge directory removal while ignoring errors and live workers. This is
more precise than the earlier audit's storage-function-only observation. Hide
the action until the full_purge capability is honestly backed. Backend safety correction remains a separate required slice:valid legacy
requests must eventually return501 without touching state;auth/confirmation
boundaries remain. This UI slice does not repair the HTTP route. No data/schema
migration or destructive repair is performed. Keep internal storage tests.

Hide developer gallery entry and unsupported console/quad commands rather than
present inert options. Replace canned model cards with actual registry rows.
Errors use the canonical safe taxonomy,never raw exception/provider content;
503/429 retain Retry-After and never replay automatically. UI first-run and
status assertions are updated to require actual evidence,not fixed T1/PASS.

The old browser_e2e_suite creates its own canned API server and even substitutes
a mock token. Its25 names do not prove real journeys;several names assert more
than their code does. Preserve the suite as fixture coverage,record its true fixture scope and retain all25 cases. Updating obsolete
expectations is still required before current fixture evidence can be claimed. New real-gateway journey subflow
tests remain separate and must report their actual scope/action measurements.
Do not promote full journey/ledger/chaos status from those subflows.

No backend availability change is shipped in this UI slice. No phase/release tag or retroactive benchmark
claim follows. REVIEW_QUEUE records this scope/compatibility decision.

Hosted correction:retain Support matrix heading and explicit platform rows so
existing adversarial website/checklist drift tests remain effective. The first
push failed this unchanged test;preserve failure and rerun after final docs.

The restored matrix exposed an existing regex defect:Windows validation scanned
across row boundaries and attributed a falsely verified macOS row to Windows.
Bound each forbidden-status match to its own table row;retain both original
negative mutations and add an order/later-row regression. This corrects scope,
not a weaker verification threshold. Failure retained as platform-row-bleed.
