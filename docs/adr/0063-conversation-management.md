# ADR 0063: Bounded owner conversation management

Add POST /v1/sessions with versioned list/rename/delete operations. Existing GET
/v1/conversations and turn responses remain unchanged. List returns at most100
rows plus has_more, with query<=120 Unicode characters and offset<=1000000.
Rename titles are trimmed,1–120 Unicode characters,without control characters.
Request body is bounded to4096 bytes; IDs retain the existing64-byte ASCII
alphanumeric/hyphen/underscore contract. No new dependencies or automatic retries.
These are new interface bounds,not relaxed existing limits. Route uses the chat
lane so metadata traffic does not consume reserved health capacity.

Forward-only migration0001 adds versioned title and deletion-marker tables with
CREATE TABLE IF NOT EXISTS. Verify old populated databases and repeated opens.
Deletes remove stored turns/title/conversation atomically; an ID/owner tombstone
prevents an in-flight completed response from resurrecting the deleted session.
Deletion is not forensic secure erasure of SQLite/WAL/backups. Encryption/backup
policies remain separate release requirements. A deleted ID cannot be reused.

The UI requires explicit confirmation for deletion, disables actions during its
active chat, sends mutations once, and reports failures. Search and load-more use
the real owner-filtered API. No fake sessions or speculative success state.
