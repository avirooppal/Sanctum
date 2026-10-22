/**
 * Typed Core API Client (Contracts Layer)
 * Single typed interface for all HTTP endpoints.
 */

export interface ModelsResponse {
  online: boolean;
  endpoint: string;
  models: any[];
}

export interface WhisperxStatusResponse {
  online: boolean;
  endpoint: string;
  whisperxVersion?: string;
  commandToStart?: string;
}

export interface TranscriptionResponse {
  success: boolean;
  provider?: string;
  endpoint?: string;
  text?: string;
  segments?: Array<{ text: string; start: number; end: number }>;
  language?: string;
  message?: string;
}

export class SanctumApiClient {
  /**
   * Fetch installed models from local daemon via Next.js proxy
   */
  public static async fetchModels(): Promise<ModelsResponse> {
    try {
      const res = await fetch("/api/ollama/models", { cache: "no-store" });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // offline
    }
    return { online: false, endpoint: "", models: [] };
  }

  /**
   * Pull / Download a model with streaming progress
   */
  public static async pullModel(
    name: string,
    onProgress: (percent: number, status: string) => void
  ): Promise<boolean> {
    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok || !res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.total && data.completed) {
              const pct = Math.round((data.completed / data.total) * 100);
              onProgress(pct, data.status || "Downloading");
            } else if (data.status) {
              onProgress(100, data.status);
            }
          } catch {
            // ignore chunk parse errors
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check WhisperX service status
   */
  public static async checkWhisperX(): Promise<WhisperxStatusResponse> {
    try {
      const res = await fetch("/api/audio/whisperx");
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // offline
    }
    return { online: false, endpoint: "http://127.0.0.1:8000" };
  }

  /**
   * Transcribe audio blob via WhisperX
   */
  public static async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse> {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice_input.webm");

      const res = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // failed
    }
    return { success: false, message: "Transcription request failed" };
  }
}
