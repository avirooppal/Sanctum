# ADR 0011: Polling-based local folder ingestion

- Status: accepted
- Date: 2026-10-09

## Context

Phase 2 requires watched-folder ingestion. The knowledge API already provides
authenticated owner-only upload with content hashes and version replacement. The
reference parser supports Markdown and text-based PDF; deletion semantics, watcher
permissions and supported file types were not specified.

## Decision

Ship an opt-in local polling client that only contacts the loopback gateway, scans one
configured root without following symlinks, and imports `.md` and `.pdf` files no
larger than 10 MiB. It identifies updates by SHA-256 and uses the existing upload
endpoint with the configured workspace token. The watcher does not propagate deletion;
owners remove indexed documents through the knowledge service. Polling interval is
configurable from 5 to 3600 seconds.

## Consequences

Polling is portable and has no additional dependency or daemon privilege. Changes may
arrive up to one interval late. Only one root and explicit formats are supported per
watcher config. Deletion propagation and filesystem notifications remain future work.
