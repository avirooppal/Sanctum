# ADR0080: Bounded UI health observation

Date2026-10-18. S1 iteration2 replaces the detached static footnote with a live,
explainable startup-status chip. This is a read of the gateway's reported startup
result,not a new kernel self-test,continuous monitor or Privacy Ledger.

Use a separate native details disclosure with44px target and visible keyboard
focus. A response-read timestamp is labeled Health read,never Verified at.
Unknown,partial,malformed,failed or stale-after-failure responses must remove
the passed state. No auth key,cookie,content or document is sent in the public
health GET. Browser-local timestamp only;no server time or privacy-history claim.

New observer bounds,chosen before measurement:5s total per read;64KiB response
body;8s polling cadence matching the existing status bar;one in-flight request.
Abort the body/request on deadline,oversize or component unmount. Stop timer on
unmount. No redirect,credentials,automatic generation retry or fallback host.
These bounds apply only to the new metadata observer,not an existing SLO or
engine/request timeout. A7s unit-driver timeout permits the real5s deadline test;
no existing gate,timeout,skip or throughput threshold is changed.

Reuse existing startupChecksPassed,privacy wording semantics,tokens and native
details keyboard behavior. Tests use transport fakes only for unit fault cases;
real browser verification uses the actual gateway and clearly labeled network
failure simulation. No fake health or model state is shipped. User research,
all-theme WCAG,full state matrix and S3/S4 critique gates remain open.

Lift the unlock card surface with a local semantic color mix;do not change the
reference palette or authenticated rail geometry. Associate errors with their
field. S1 iteration3 still follows actual screenshots and critique;no default
or full-redesign claim is implied by this refinement. Incremental asset budgets
remain ADR0078's12KiB JS/8KiB CSS gzip;no dependencies or fonts added.
