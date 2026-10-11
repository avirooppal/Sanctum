# Realtime tickets v1

Internal contract for the future authenticated ticket endpoint/transport.
`issue(secret256, origin, monotonic_now)` inserts SHA256 only, cap32, TTL30s;
refuses invalid origins or duplicate live secrets. `consume(secret, origin, now)`
removes before validation; succeeds only once, with exact bound Origin and now
strictly before expiry. Invalid/replayed/expired tickets disclose no stored detail.
Origin is a canonical loopback HTTP origin with explicit port, no path, userinfo,
fragment, query or whitespace. Exact gateway-origin validation belongs to issuance
and handshake; this module does not authorize HTTP requests or implement WebSocket.
