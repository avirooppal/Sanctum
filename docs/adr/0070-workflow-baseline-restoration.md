# ADR 0070: Restore the real baseline before journey alignment

2026-10-17. Main6339d35 passes hosted source jobs, but fresh real smoke fails
because the workspace defaults changed to dark. File speech is imported but no
longer rendered, and cancellation status is computed but no longer displayed.
Existing browser assertions expose regressions absent from hosted source tests.

Restore authenticated file speech gated by the existing speech capability and
the chat cancellation feedback. Preserve the Stop generation accessible name.
Make speech smoke explicitly select Sanctum light before asserting its unchanged
exact color/237px geometry. Scope speech status assertions to the speech panel
because the workspace now has a status bar. No assertion, timeout, threshold or
backend gate is removed or relaxed.

This is baseline repair before journey implementation. Preserve the red smoke
and initial Rust timing failure; the unchanged full Rust rerun passed. Recover
the missing Windows Python environment in a separate ignored venv without
deleting the owner's Linux .venv. Workflow specification is the next feature
commit, before journey product changes. No release/phase tag.

Second preserved baseline failure: website now links its bundled /docs.html
but the old browser test permits only /. Explicitly permit that one existing
route and additionally require its real200 response and documentation title.
Retain same-origin blocking,zero sockets,all viewport/keyboard assertions and
all timings. This changes the expected navigation scope to match ADR0069 A11;
it does not waive any security check or accept arbitrary links.

Restored speech also exposes ASR model/TTS model fields. Scope the fidelity
test's ambiguous Model locator to its exact existing accessible name. Preserve
the model-selection assertion and all geometry/egress/keyboard assertions.

The follow-up source gate exposed ty selecting the unrelated checkout .venv
instead of the runner's verified Linux Python. Export VIRTUAL_ENV from the
existing VENV_PYTHON path. This aligns dependency/type discovery with the
interpreter already executing the gate;it removes no check and avoids deleting
or replacing owner environments. Preserve the failed discovery log and rerun.
