# Policy examples (requirements, not a running policy engine)

- All workspaces: cloud connector list empty by default; no hidden remote fallback.
- Restricted data: local engines only, even with a connector enabled later.
- Retrieval: authenticated workspace and document ACL predicates applied before search.
- Tools: manifest scope plus policy authorization plus approval for side effects.
- Web/email/tool results: untrusted; never acquire privileges or durable memory access.

The Phase 0 envelope schema permits only an empty connector list. Cedar/OPA selection
and executable policy rules are pending; these examples grant no access.
