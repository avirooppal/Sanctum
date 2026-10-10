# Dispatch observation v1

GET /healthz/dispatch returns {"queued":[control,voice,chat,background],
"active":[control,voice,chat,background]}. Arrays contain exactly four nonnegative
integer counts under the dispatcher mutex. The observer itself occupies a control
slot. No identities, paths, tokens or payloads are returned. This additive local
diagnostic leaves the original /healthz response unchanged. Sample counts and
per-engine process ownership together; zero gateway activity is not proof a shared
model server has stopped computing. Acceptance remains ADR 0031.
