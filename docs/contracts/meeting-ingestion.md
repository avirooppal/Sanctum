# Meeting ingestion authorization contract

The Knowledge adapter exposes `authorize_ingest(user, workspace, readers, data_class)`.
It must reject non-owners, unknown reader memberships and invalid classifications
before parsing, summarization or embedding. It returns no authorization token;
`ingest` repeats authorization before processing and the catalog repeats it at write
time, so the preliminary check cannot bypass a later revocation.

Meeting capture calls this method before handing transcript text to its summarizer.
A matching evidence quote establishes source presence only, not semantic support for
the summary, action description, owner or date. Those remain generated suggestions.
