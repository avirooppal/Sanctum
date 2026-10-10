# Ingress v1

The public loopback socket is owned by the bounded ingress layer. The application
HTTP listener is reachable only inside the existing egress-denied namespace.
ADR 0029 defines bounds, deadlines and temporary framing/upgrade restrictions.
Incomplete/oversized/ambiguous headers fail closed. Repeated Content-Length,
Transfer-Encoding, non-origin request targets and unexpected HTTP versions are
rejected. No credential or body is logged. Existing owner auth remains in handlers.

Run gateway ingress unit tests and `evals/ingress_limits.py` for real socket checks.
Do not count socket closure as engine cancellation or claim full Step 0 acceptance.
