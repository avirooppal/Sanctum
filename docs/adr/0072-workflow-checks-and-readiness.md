# ADR 0072: Workflow drift, credential scanning and readiness checks

The first alignment slice adds read-only consistency checks and one registered
readiness test for each canonical journey. These query a real owner gateway;
they do not perform complete journeys,assert UI visibility,measure action
budgets,simulate missing engines or establish ledger/chaos gates. Results say
readiness_only,retain PARTIAL/PENDING,journeys_verified=0. Strict acceptance
refuses success until every full journey is genuinely VERIFIED. No skip/xfail.
Full Playwright/engine/chaos journey acceptance and hosted runtime provisioning
remain OPEN;the hosted source matrix runs the consistency/secret contracts now.

New readiness-client bounds:10s socket timeout and1MiB maximum JSON response.
These are test-client guards,not server/SLO changes. It only contacts the
explicit127.0.0.1 origin,disables proxy inheritance and redirects,uses no cloud
credentials,and writes metadata/timings without user content. It refuses to
claim human clicks/navigation keys from API requests. Reuse the existing real
engine smoke separately;group its evidence by journeys without discarding tests.

Credential scan rejects the OpenRouter prefix followed by16+ token characters
in Git tracked files and all evals/results,including untracked/binary evidence.
Prefix-only explanatory prose is allowed. Redaction replaces the whole value;
diagnostics never include matched bytes. No environment-key discovery or live
provider check is performed. Future broker errors must use the same redactor.

The canonical workflow/manifest/release table and generated website/docs status
sections must match exactly. The generator updates projections only;tests never
promote statuses. Tests deliberately corrupt IDs,steps,statuses and annotations
to prove drift is rejected. Low-level regression tests remain supporting suites,
not falsely labelled end-to-end journeys. No existing gate is relaxed.
