# Knowledge UI v1

Authenticated owner UI over knowledge.openapi.json v0.1.0. List/create personal
workspaces, upload Markdown or text-based PDF (existing 10 MiB parser limit), and
ask a query (existing 4000-character maximum). Uploads use owner-only readers and
restricted classification. No remote document URL, automatic retry or token/draft
storage. Closing the surface aborts its active requests and suppresses stale UI.

Show the backend's exact answer, abstained flag, citation source, optional page
and supporting quote as inert text. A citation is not an external link. No OCR,
document-browser listing or page-region overlay is claimed by this slice; the
current backend does not expose those capabilities. Errors remain visible.

Tests validate responses and same-origin encoding. The real browser gate creates
a workspace, uploads a local Markdown fixture, asks with a citation, and proves
an empty workspace abstains. It also checks mobile overflow and foreign HTTP/WS
requests for this surface. This is not the full all-screen U6 egress gate.
