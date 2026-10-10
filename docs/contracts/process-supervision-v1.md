# Process supervision v1

The confined --engine-child entry is a guardian process, not a bare exec. It
repeats containment probes, binds its lifetime to the gateway using PDEATHSIG,
becomes a child subreaper, and launches one worker in a new process group. Worker
descendants inherit that group. The guardian remains outside it to reap descendants.
This trusted-engine contract forbids workers from escaping their process group;
hostile-code isolation remains a later sandbox feature.

Stop: SIGINT to the worker group, wait 100ms; SIGTERM, wait 400ms; SIGKILL and
reap. Natural worker exit also tears down descendants before guardian exit.
Gateway termination of a guardian uses SIGTERM and waits for acknowledged exit
before escalating. Worker exit status is preserved. Signals contain no user data.
Gateway SIGKILL must trigger the guardian's parent-death handler and group cleanup.
Each worker additionally receives SIGKILL if its guardian dies unexpectedly.

Tests must include an uncooperative grandchild, natural exit with a surviving
descendant, parent death, and the existing real confinement probes. No zombie,
orphan-free or engine recovery claim until those scenarios are measured. Process
supervision does not by itself implement cancellation-aware blocking I/O.
