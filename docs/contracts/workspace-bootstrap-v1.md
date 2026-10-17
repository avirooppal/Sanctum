# Workspace bootstrap v1

An owner token starts one cancellable metadata bootstrap. Initial capabilities
are empty. Wait for local fonts,then perform GET /v1/capabilities,GET /v1/models,
GET /v1/preferences sequentially. Never fetch later metadata after cancellation
or a failed prerequisite. Publish authenticated panels only after validated
results arrive. Loading is indeterminate;no model provisioning is simulated.
No automatic replay,larger connection allowance or altered deadline is added.
The status bar owns the one live ContextBar;the composer does not duplicate it.
