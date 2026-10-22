/**
 * Sanctum Typed Error Registry (Contracts Layer)
 * Core produces typed codes and parameters; human-readable strings reside in the UI table.
 */

export const ErrorCodes = {
  // Engine & Inference Errors
  ENGINE_OFFLINE: "ENGINE_OFFLINE",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  INFERENCE_TIMEOUT: "INFERENCE_TIMEOUT",
  STREAM_ABORTED: "STREAM_ABORTED",
  OUT_OF_VRAM: "OUT_OF_VRAM",
  CONTEXT_OVERFLOW: "CONTEXT_OVERFLOW",

  // Audio / Speech Errors
  WHISPERX_OFFLINE: "WHISPERX_OFFLINE",
  AUDIO_CAPTURE_DENIED: "AUDIO_CAPTURE_DENIED",
  TRANSCRIPTION_FAILED: "TRANSCRIPTION_FAILED",

  // Document Vault / RAG Errors
  FILE_READ_FAILED: "FILE_READ_FAILED",
  CHUNK_INDEX_ERROR: "CHUNK_INDEX_ERROR",
  COLLECTION_NOT_FOUND: "COLLECTION_NOT_FOUND",

  // Network / Protocol Errors
  ENDPOINT_UNREACHABLE: "ENDPOINT_UNREACHABLE",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface AppError {
  code: ErrorCode;
  message?: string;
  details?: Record<string, unknown>;
}
