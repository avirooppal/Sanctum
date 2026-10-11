# UI source inventory v1

Developer-only source review; never import or execute the reference application
from this scanner. Input is an explicit local checkout plus a full pinned Git SHA.
Reject a mismatched HEAD. Enumerate tracked files under web/, apps/desktop/ and
apps/shared/; exclude node_modules and build outputs even if tracked. Include
exact byte SHA256, source path, category, declared package dependencies, and
line-numbered network/IPC/route/theme/font/icon candidates. Preserve all matching
lines, not only unique URLs. JSON output is deterministic, UTF-8 and versioned.

Static candidates require review: comments are not network requests; generated
URLs and dynamically constructed routes may require tracing imports. Inventory
does not certify license permissions, completeness of runtime call discovery,
egress enforcement or visual fidelity. Assets default to excluded pending review.
Product copying requires a separate provenance entry and exact license notice.

Acceptance: deterministic enumeration, byte hashes, dependency collection,
network/IPC candidates with line numbers, default-excluded assets, no execution,
and refusal when HEAD differs from the pin. Run against the actual pinned tree.
