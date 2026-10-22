/**
 * Presentation String Table (Apps / UI Layer)
 * Human-readable localized strings; core modules return typed error codes and keys.
 */

import { ErrorCodes, type ErrorCode } from "../../../contracts/errors/codes.ts";

export const UIStrings = {
  appName: "Sanctum",
  tagline: "Sovereign Local AI Workspace",

  // Error Messages
  errors: {
    [ErrorCodes.ENGINE_OFFLINE]: "Local AI engine is offline. Start Ollama with `ollama serve`.",
    [ErrorCodes.MODEL_NOT_FOUND]: "The requested model could not be found in the local repository.",
    [ErrorCodes.INFERENCE_TIMEOUT]: "Inference request timed out.",
    [ErrorCodes.STREAM_ABORTED]: "Generation was cancelled.",
    [ErrorCodes.OUT_OF_VRAM]: "Not enough VRAM available to load this model at full context.",
    [ErrorCodes.CONTEXT_OVERFLOW]: "Conversation exceeded model context window limit.",
    [ErrorCodes.WHISPERX_OFFLINE]: "WhisperX server is offline on port 8000. Web Speech API fallback active.",
    [ErrorCodes.AUDIO_CAPTURE_DENIED]: "Microphone access was denied in browser permissions.",
    [ErrorCodes.TRANSCRIPTION_FAILED]: "Failed to transcribe audio.",
    [ErrorCodes.FILE_READ_FAILED]: "Could not read the attached file.",
    [ErrorCodes.CHUNK_INDEX_ERROR]: "Failed to index document chunks into vector vault.",
    [ErrorCodes.COLLECTION_NOT_FOUND]: "Document collection not found.",
    [ErrorCodes.ENDPOINT_UNREACHABLE]: "Daemon endpoint is unreachable.",
    [ErrorCodes.INVALID_PAYLOAD]: "Invalid request payload.",
  } as Record<ErrorCode, string>,

  // Chat UI Strings
  chat: {
    composerPlaceholder: "Message Sanctum or drop files here…",
    recordingPlaceholder: "Speaking now...",
    waitingModel: "Waiting for a local model…",
    showReasoning: "Show reasoning",
    thinking: "Thinking…",
    myDocuments: "My documents",
  },
};

export function getErrorMessage(code: ErrorCode): string {
  return UIStrings.errors[code] || "An unexpected error occurred.";
}
