# Web meeting capture v1

The authenticated browser loads workspaces from `GET /v1/workspaces`; a user can
create a named workspace via POST. The user reviews a title and transcript before
explicitly selecting Save meeting. No microphone, draft, or chat text is saved
automatically. Saving uses the versioned Knowledge meetings contract, restricted
classification and no extra readers. Credentials and drafts remain in memory.

Show the returned summary, action descriptions, owner/due date and exact evidence
quotes as plain text. Label generated notes for review. Never render model output
as HTML or execute instructions in it. Show the document ID only after a successful
response. A failed save preserves the draft. Disable duplicate submissions while
pending. No automatic retry of writes: a lost response may already have saved data.

Workspace identifiers must be 32 hexadecimal characters before constructing URLs.
Title and transcript must be nonempty, at most 200 and 6000 Unicode code points.
Only same-origin endpoints are allowed. Errors must be visible. Browser cancellation
does not imply server work was cancelled. This slice does not add diarization or
semantic validation of generated notes.
