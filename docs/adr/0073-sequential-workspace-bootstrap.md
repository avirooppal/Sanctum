# ADR 0073: Admit the workspace only after sequential metadata bootstrap

Fresh repeated real smoke failed in Knowledge startup. Captured responses show
/v1/capabilities503,/v1/models503 and a bundled font503 during the initial burst;
the client advertised default capabilities,then model failure removed the UI.
The control lane remains capped at4 (ADR0029). Do not widen any lane or timeout.

Start with no capabilities. Await bundled fonts,then request capabilities,
models and preferences sequentially with one cancellation context. Publish the
capability set only after all validated metadata arrives. Defer history,chat,
status and Knowledge widgets until then;abort stale bootstrap on token change.
There is no automatic request replay and no generation retry.

Retain the real context/usage display in the status bar (ADR0069 A6). Remove the
duplicate composer display and its second identical metadata request,as a
workflow simplification. The ContextBar module and all existing tests remain.
This changes neither usage data nor its Unknown behavior. Record failed runs
and rerun the original full smoke,including unchanged Knowledge assertions.
