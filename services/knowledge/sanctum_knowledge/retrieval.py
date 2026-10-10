"""Retrieval glue; no parser, inference kernel, or vector storage reimplementation."""

import hashlib
from .contracts import Parser, Embedder, VectorStore, Reranker
from .parsing import chunks
from .store import Catalog


def rrf(rankings, constant=60):
    scores = {}
    for ranking in rankings:
        for rank, key in enumerate(dict.fromkeys(ranking), 1):
            scores[key] = scores.get(key, 0) + 1 / (constant + rank)
    return sorted(scores, key=lambda key: (-scores[key], key))


def supported_quote(quote, hits):
    return bool(quote.strip()) and any(quote in hit["text"] for hit in hits)


def context_text(hit):
    return hit.get("parent_text") or hit["text"]


class Knowledge:
    def __init__(
        self,
        catalog: Catalog,
        parser: Parser,
        embedder: Embedder,
        vectors: VectorStore,
        reranker: Reranker,
    ):
        self.catalog, self.parser, self.embedder = catalog, parser, embedder
        self.vectors, self.reranker = vectors, reranker

    def authorize_ingest(self, user, workspace, readers, data_class):
        self.catalog.require(user, workspace, owner=True)
        for reader in readers:
            self.catalog.require(reader, workspace)
        if data_class not in {"public", "internal", "confidential", "restricted"}:
            raise ValueError("invalid data class")

    def ingest(self, user, workspace, name, content, readers, data_class):
        self.authorize_ingest(user, workspace, readers, data_class)
        parsed = chunks(self.parser.parse(content, name))
        if not parsed:
            raise ValueError("document has no text")
        # Compute before publishing the new catalog version; failed inference
        # cannot remove the old document. Only live catalog IDs are searchable.
        embeddings = self.embedder.embed([context_text(c) for c in parsed])
        if len(embeddings) != len(parsed):
            raise ValueError("embedding count mismatch")
        document = self.catalog.put(
            user, workspace, name, hashlib.sha256(content).hexdigest(), readers, data_class, parsed
        )
        live = self.catalog.expand(user, workspace, self.catalog.allowed_chunks(user, workspace))
        live = [c for c in live if c["document_id"] == document["id"]]
        if len(live) != len(embeddings):
            raise ValueError("chunk/embedding mismatch")
        self.vectors.upsert([(c["chunk_id"], vector) for c, vector in zip(live, embeddings)])
        return document

    def search(self, user, workspace, query, k=5, mode="hybrid"):
        allowed = self.catalog.allowed_chunks(user, workspace)
        if not isinstance(query, str) or not query.strip() or len(query) > 4000 or not 1 <= k <= 20:
            raise ValueError("invalid query or limit")
        if mode not in {"hybrid", "vector"}:
            raise ValueError("invalid retrieval mode")
        if not allowed:
            return []
        vector = self.embedder.embed([query])[0]
        dense = self.vectors.search(vector, allowed, 100 if mode == "hybrid" else k)
        if mode == "vector":
            return self.catalog.expand(user, workspace, dense[:k])
        lexical = self.catalog.lexical(user, workspace, query, 100)
        hits = self.catalog.expand(user, workspace, rrf([dense, lexical])[:20])
        ranked = self.reranker.rank(query, [context_text(h) for h in hits])
        indices = [index for index, _ in ranked]
        if sorted(indices) != list(range(len(hits))):
            raise ValueError("reranker must return a permutation")
        selected = [hits[index]["chunk_id"] for index, _ in ranked[:k]]
        return self.catalog.expand(user, workspace, selected)
