# Resident recovery v1

Only resident model guardians may replace unexpectedly exited workers. Reap the
whole old group before replacement; at most three replacements per rolling minute,
with 100/500/2000ms interruptible backoff. Gateway shutdown cancels replacement.
Inherited confinement and parent-death/process-group ownership remain mandatory.

New requests hold their ordinary engine permit while waiting up to 120 seconds for
readiness. Health GETs have a 250ms deadline; a request cancellation terminates its
waiting helper/worker. Send the generation POST exactly once after readiness;
never replay failed work. Existing calls sharing a crashed process can fail;
independent model processes remain available. Exhausted restart budget fails closed.
