# Purge safety correction v1 (OpenAPI0.2.1)

Authenticated POST /v1/purge is disabled. Invalid JSON/confirmation remains400,
body beyond1024 bytes413;valid confirmation501 with code capability_unavailable.
No storage lock,SQL write,filesystem deletion or worker cancellation occurs.
Owner auth still precedes dispatch. full_purge is never advertised. Existing
internal conversation-storage deletion tests remain;not secure erase proof.

This deliberately breaks the previous false200 success behavior. Clients must
handle501 and hide the action unless full_purge is advertised. No data migration
is needed. Re-enabling requires a new versioned transactional/cancellation
contract and populated cross-store/crash tests. No claims of secure erasure.

Capabilities adds purge_safety=disabled-v1. Safety probes MUST check this before
issuing a valid confirmation;never run destructive confirmation against a
legacy runtime lacking the marker. The marker is not a purge capability.
