# ADR 0042: Preserve exact status archive bytes

Accepted 2026-10-10. The archived narrative range ends in a blank line. Removing it
would violate the requested verbatim archive and its recorded SHA256. For this one
historical archive, disable line-ending conversion, recognize CRLF as line endings, and only suppress Git's blank-at-EOF
whitespace check through a path-specific attribute. Preserve all other whitespace
checks and all executable code formatting/lint/type/test gates. This is inert
provenance text, not a skipped test or altered measurement. Confirm staged bytes
match the recorded archive SHA256 before committing.
