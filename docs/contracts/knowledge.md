# Knowledge contracts v1

Principal user comes from authenticated gateway, never request body. Workspace IDs
and document IDs are server-generated 32-character lowercase hex. Local single-user
mode authenticates local-owner; all storage APIs nevertheless require principal.

POST /v1/workspaces {name} -> {id,name}; GET -> caller memberships only.
POST /v1/workspaces/{id}/documents {name,content_base64,readers:[user],data_class}
-> {id,version,sha256}; caller must be owner. Upload limit 10 MiB, extensions .md/.pdf.
POST /v1/workspaces/{id}/search {query,k:1..20,mode:hybrid|vector}
-> {hits:[{chunk_id,document_id,text,parent_text,page,source,score}]}.
POST /v1/workspaces/{id}/ask {query} -> {answer,citations,abstained}.
Forbidden membership/documents produce no content; ACL applies BEFORE each dense
or lexical top-k and again during parent expansion. Revocation must take effect
without re-embedding. Readers must be workspace members. Workspace owner can read
all workspace documents. Deny by default for all other users.

Parser.parse(bytes,name) -> ordered Blocks(text,heading,page,source).
Embedder.embed(texts) -> finite fixed-size vectors.
VectorStore.upsert/delete/search(vector,eligible_chunk_ids,k) -> ranked chunk IDs.
Reranker.rank(query,texts) -> permutation of input indices with finite scores.
These are replaceable interfaces; product code must not load model names.

Worker JSONL: {user,operation,workspace,payload} -> {ok,result} or {ok:false,error}.
Only the authenticated gateway may supply this request over inherited pipes. The
worker has no listener. It must check its isolation at startup before loading any
engine/store. Each request/response <= 16 MiB. Inputs, parsed text and all model
responses remain untrusted. No retrieved instruction may authorize a tool or egress.
