# Provisioning v1

`sanctum pull ID [--allow-network | --from-file PATH] [--store PATH]`
reads profiles/artifacts.json. Default store .sanctum/artifacts. Network is disabled
unless explicitly requested. Existing files are rehashed; corruption fails closed.
Downloads/imports stream to a same-directory temporary file; size and SHA-256 must
match before atomic rename. Errors remove the temporary file, never a valid model.
Local provisioning.jsonl records artifact ID, source, bytes, hash and outcome.
It is a provisioning audit log, not the Phase 5 hash-chained Privacy Ledger.

`sanctum estimate ID [--ram-gib N]` reports storage bytes, conservative memory need
(artifact size * 1.25 + 1 GiB overhead), fit and speed=unverified. Engine archives
have no inference estimate. Exact model/context/KV memory and speed require evals.
