# ADR0075: Disable unsafe whole-product purge

J11 requires reliable full-scope deletion. Existing route deletes SQL then
ignores Knowledge filesystem errors/live workers. Fail closed before any mutation.
Preserve owner authentication,confirmation and the existing1024-byte handler
bound. Classify purge in the existing metadata/chat lane rather than zero-body
control lane;no lane capacity,queue,deadline or global limit changes. Profiles
routing is a separate unverified gap. No database schema change.

OpenAPI0.2.1 documents intentional availability correction;UI remains hidden.
Test contract and populated state first,then real HTTP501 with unchanged
session snapshot. This is a safety fix,not completion of J11 purge.

Probe reuses ADR0072 test-client10s/1MiB bounds,no proxy/redirects;checks
additive purge_safety marker before valid confirmation. Real metadata must be
populated and unchanged. This is not ledger or secure-erasure acceptance.
