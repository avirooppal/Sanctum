import { StateCreator } from "zustand";
import { DocumentCollection, IngestedDocument } from "@/types";
import { globalVectorStore, VectorChunk } from "@/lib/vectorStore";

export interface RagSlice {
  collections: DocumentCollection[];
  activeCollectionId: string;
  documents: IngestedDocument[];
  selectedChunkDocumentId: string | null;
  ragSearchQuery: string;
  searchedChunks: VectorChunk[];

  setActiveCollectionId: (id: string) => void;
  createCollection: (name: string, description: string, embeddingModel: string) => void;
  uploadDocument: (
    collectionId: string,
    file: { name: string; size: number; type: IngestedDocument["type"]; rawContent: string }
  ) => void;
  deleteDocument: (docId: string) => void;
  setSelectedChunkDocumentId: (docId: string | null) => void;
  setRagSearchQuery: (q: string) => void;
}

export const createRagSlice: StateCreator<RagSlice, [], [], RagSlice> = (set) => ({
  collections: [
    {
      id: "col-default",
      name: "Default Knowledge Vault",
      description: "Local private document vault with on-device 1024d vector indexing.",
      documentCount: 0,
      totalChunks: 0,
      embeddingModel: "Cosine-1024 (On-Device)",
      vectorDimensions: 1024,
      createdAt: "Just now",
    },
  ],
  activeCollectionId: "col-default",
  documents: [],
  selectedChunkDocumentId: null,
  ragSearchQuery: "",
  searchedChunks: [],

  setActiveCollectionId: (id) => set({ activeCollectionId: id }),

  createCollection: (name, description, embeddingModel) => {
    const newCol: DocumentCollection = {
      id: `col-${Date.now()}`,
      name,
      description,
      documentCount: 0,
      totalChunks: 0,
      embeddingModel,
      vectorDimensions: 1024,
      createdAt: "Just now",
    };
    set((state) => ({
      collections: [...state.collections, newCol],
      activeCollectionId: newCol.id,
    }));
  },

  uploadDocument: (collectionId, file) => {
    const newDocId = `doc-${Date.now()}`;
    const vectorChunks = globalVectorStore.addDocument(newDocId, file.name, file.rawContent, 60, 15);

    const newDoc: IngestedDocument = {
      id: newDocId,
      collectionId,
      name: file.name,
      sizeBytes: file.size,
      type: file.type,
      status: "indexed",
      chunkCount: vectorChunks.length,
      indexedAt: "Just now",
      chunks: vectorChunks.map((c) => ({
        id: c.id,
        docId: c.docId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        embeddingDimensions: 1024,
      })),
    };

    set((state) => ({
      documents: [newDoc, ...state.documents],
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              documentCount: c.documentCount + 1,
              totalChunks: c.totalChunks + vectorChunks.length,
            }
          : c
      ),
      selectedChunkDocumentId: newDocId,
      searchedChunks: globalVectorStore.search(state.ragSearchQuery, 4),
    }));
  },

  deleteDocument: (docId) => {
    globalVectorStore.removeDocument(docId);
    set((state) => {
      const doc = state.documents.find((d) => d.id === docId);
      if (!doc) return state;
      return {
        documents: state.documents.filter((d) => d.id !== docId),
        collections: state.collections.map((c) =>
          c.id === doc.collectionId
            ? {
                ...c,
                documentCount: Math.max(0, c.documentCount - 1),
                totalChunks: Math.max(0, c.totalChunks - doc.chunkCount),
              }
            : c
        ),
        selectedChunkDocumentId:
          state.selectedChunkDocumentId === docId ? null : state.selectedChunkDocumentId,
        searchedChunks: globalVectorStore.search(state.ragSearchQuery, 4),
      };
    });
  },

  setSelectedChunkDocumentId: (docId) => set({ selectedChunkDocumentId: docId }),

  setRagSearchQuery: (q) => {
    const results = globalVectorStore.search(q, 4, 0.15);
    set({ ragSearchQuery: q, searchedChunks: results });
  },
});
