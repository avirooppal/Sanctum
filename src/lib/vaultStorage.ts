import { globalVectorStore, type VectorChunk } from "../../core/ai/rag/vectorStore.ts";
import type { ChatSession, IngestedDocument } from "../../contracts/types/index.ts";

const DB_NAME = "sanctum-vault-db";
const DB_VERSION = 1;
const CHUNKS_STORE = "chunks";
const IMAGES_STORE = "images";

export interface StoredChunkRecord {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingModel: string;
  vector: number[];
}

export interface StoredImageRecord {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
}

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const cs = db.createObjectStore(CHUNKS_STORE, { keyPath: "id" });
          cs.createIndex("docId", "docId", { unique: false });
        }
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveChunksToVaultDb(
  chunks: VectorChunk[],
  embeddingModel: string
): Promise<void> {
  const db = await openVaultDb();
  if (!db || chunks.length === 0) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CHUNKS_STORE, "readwrite");
      const store = tx.objectStore(CHUNKS_STORE);
      for (const c of chunks) {
        const record: StoredChunkRecord = {
          id: c.id,
          docId: c.docId,
          docName: c.docName,
          chunkIndex: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          embeddingModel,
          vector: Array.from(c.vector),
        };
        store.put(record);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function deleteDocChunksFromVaultDb(docId: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CHUNKS_STORE, "readwrite");
      const store = tx.objectStore(CHUNKS_STORE);
      const idx = store.index("docId");
      const req = idx.getAllKeys(docId);
      req.onsuccess = () => {
        for (const k of req.result || []) {
          store.delete(k);
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function clearVaultDb(): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([CHUNKS_STORE, IMAGES_STORE], "readwrite");
      tx.objectStore(CHUNKS_STORE).clear();
      tx.objectStore(IMAGES_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function saveImageToVaultDb(record: StoredImageRecord): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IMAGES_STORE, "readwrite");
      tx.objectStore(IMAGES_STORE).put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function loadImageFromVaultDb(id: string): Promise<string | null> {
  const db = await openVaultDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IMAGES_STORE, "readonly");
      const req = tx.objectStore(IMAGES_STORE).get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredImageRecord | undefined;
        db.close();
        resolve(rec?.src || null);
      };
      req.onerror = () => { db.close(); resolve(null); };
    } catch {
      try { db.close(); } catch {}
      resolve(null);
    }
  });
}

/**
 * Rehydrate globalVectorStore lazily from IndexedDB without blocking the UI thread.
 * Only re-embeds if a chunk has no stored vector or its embeddingModel changed.
 */
export async function hydrateVectorStoreFromVaultDb(
  legacyDocuments?: IngestedDocument[]
): Promise<{ loaded: number; reembedded: number }> {
  const activeModel = globalVectorStore.getEmbeddingModel();
  let loaded = 0;
  let reembedded = 0;

  // One-time migration of any legacy chunks still sitting in localStorage documents
  if (legacyDocuments && legacyDocuments.length > 0) {
    const legacyChunks: VectorChunk[] = [];
    for (const doc of legacyDocuments) {
      if (doc.chunks && doc.chunks.length > 0) {
        for (const c of doc.chunks) {
          const vec = globalVectorStore.generateEmbedding(c.content);
          const vc: VectorChunk = {
            id: c.id,
            docId: c.docId,
            docName: doc.name,
            chunkIndex: c.chunkIndex,
            content: c.content,
            tokenCount: c.tokenCount,
            vector: vec,
          };
          globalVectorStore.addRawChunk(vc);
          legacyChunks.push(vc);
          reembedded++;
        }
      }
    }
    if (legacyChunks.length > 0) {
      await saveChunksToVaultDb(legacyChunks, activeModel);
    }
  }

  const db = await openVaultDb();
  if (!db) return { loaded, reembedded };

  const records: StoredChunkRecord[] = await new Promise((resolve) => {
    try {
      const tx = db.transaction(CHUNKS_STORE, "readonly");
      const req = tx.objectStore(CHUNKS_STORE).getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredChunkRecord[]) || []);
      };
      req.onerror = () => { db.close(); resolve([]); };
    } catch {
      try { db.close(); } catch {}
      resolve([]);
    }
  });

  const updatedRecords: VectorChunk[] = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const modelMatches = rec.embeddingModel === activeModel;
    const hasVector = Array.isArray(rec.vector) && rec.vector.length > 0;
    let vector: Float32Array;
    if (modelMatches && hasVector) {
      vector = new Float32Array(rec.vector);
      loaded++;
    } else {
      vector = globalVectorStore.generateEmbedding(rec.content);
      reembedded++;
      updatedRecords.push({
        id: rec.id,
        docId: rec.docId,
        docName: rec.docName,
        chunkIndex: rec.chunkIndex,
        content: rec.content,
        tokenCount: rec.tokenCount,
        vector,
      });
    }
    globalVectorStore.addRawChunk({
      id: rec.id,
      docId: rec.docId,
      docName: rec.docName,
      chunkIndex: rec.chunkIndex,
      content: rec.content,
      tokenCount: rec.tokenCount,
      vector,
    });
    if (i > 0 && i % 50 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (updatedRecords.length > 0) {
    await saveChunksToVaultDb(updatedRecords, activeModel);
  }
  return { loaded, reembedded };
}

/**
 * Strips heavy chunk payloads and inline base64 images before writing to localStorage.
 */
export function stripHeavyPayloadsForLocalStorage(
  documents: IngestedDocument[],
  chatSessions: ChatSession[]
): { documents: IngestedDocument[]; chatSessions: ChatSession[] } {
  const lightDocs = (documents || []).map((d) => ({
    ...d,
    chunks: [],
  }));
  const lightSessions = (chatSessions || []).map((s) => ({
    ...s,
    messages: (s.messages || []).map((m) =>
      m.image && m.image.src && m.image.src.startsWith("data:")
        ? {
            ...m,
            image: {
              ...m.image,
              src: `idb:${m.id}`,
            },
          }
        : m
    ),
  }));
  return { documents: lightDocs, chatSessions: lightSessions };
}
