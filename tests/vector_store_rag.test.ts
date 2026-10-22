import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { InMemoryVectorStore } from "../src/lib/vectorStore.ts";

describe("VectorStore & RAG Ingestion Characterization", () => {
  test("generates 1024-dimensional normalized embeddings", () => {
    const store = new InMemoryVectorStore();
    const vec1 = store.generateEmbedding("hello world local inference");
    assert.equal(vec1.length, 1024);

    // Verify vector is normalized (magnitude ~ 1.0)
    const norm = Math.sqrt(Array.from(vec1).reduce((sum, val) => sum + val * val, 0));
    assert.ok(Math.abs(norm - 1.0) < 1e-3, "Vector should be unit normalized");
  });

  test("cosine similarity produces higher scores for semantically identical terms", () => {
    const store = new InMemoryVectorStore();
    const vecA = store.generateEmbedding("quantum computing qubits superposition");
    const vecB = store.generateEmbedding("quantum computing physics qubits");
    const vecC = store.generateEmbedding("baking chocolate chip cookies recipe");

    const simAB = InMemoryVectorStore.cosineSimilarity(vecA, vecB);
    const simAC = InMemoryVectorStore.cosineSimilarity(vecA, vecC);

    assert.ok(simAB > simAC, "Related texts must have higher similarity than unrelated");
  });

  test("indexes chunks and retrieves top-k matching documents", () => {
    const store = new InMemoryVectorStore();
    store.addRawChunk({
      id: "chunk-1",
      docId: "doc-1",
      docName: "quantum.pdf",
      chunkIndex: 0,
      content: "Quantum error correction codes protect information across physical qubits.",
      tokenCount: 10,
      vector: store.generateEmbedding("Quantum error correction codes protect information across physical qubits."),
    });

    store.addRawChunk({
      id: "chunk-2",
      docId: "doc-2",
      docName: "cooking.txt",
      chunkIndex: 0,
      content: "Mix the flour, butter, and brown sugar thoroughly before baking.",
      tokenCount: 11,
      vector: store.generateEmbedding("Mix the flour, butter, and brown sugar thoroughly before baking."),
    });

    const results = store.search("quantum qubit error correction", 1, 0.0);
    assert.equal(results.length, 1);
    assert.equal(results[0].docName, "quantum.pdf");
    assert.ok(results[0].similarity! > 0.3);
  });

  test("chunkText splits text cleanly and creates indexed chunks", () => {
    const store = new InMemoryVectorStore();
    const sampleText = "Sentence one about memory.\n\nSentence two about GPU bandwidth.\n\nSentence three about VRAM.";
    const chunks = store.chunkText(sampleText, 50, 10);
    assert.ok(chunks.length >= 1);
    assert.ok(chunks[0].content.length > 0);
  });
});

