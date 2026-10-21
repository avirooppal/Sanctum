export type NavModule =
  | "hub"
  | "chat"
  | "arena"
  | "research"
  | "rag"
  | "telemetry"
  | "settings";

export type QuantizationLevel =
  | "Q4_0"
  | "Q4_K_M"
  | "Q5_K_M"
  | "Q6_K"
  | "Q8_0"
  | "FP16"
  | "BF16";

export type ModelCategory =
  | "all"
  | "general"
  | "reasoning"
  | "coding"
  | "vision"
  | "embedding";

export interface LocalModel {
  id: string;
  name: string;
  author: string;
  description: string;
  parameters: string; // e.g. "7B", "14B", "70B"
  category: "general" | "reasoning" | "coding" | "vision" | "embedding";
  quantization: QuantizationLevel;
  availableQuantizations: QuantizationLevel[];
  contextWindow: number; // e.g. 8192, 32768, 131072
  ramRequiredGB: number;
  vramRequiredGB: number;
  fileSizeGB: number;
  downloaded: boolean;
  downloadProgress: number; // 0 - 100
  isLoaded: boolean;
  architecture: "llama" | "qwen" | "mistral" | "deepseek" | "gemma";
  // Hardware and tuning config
  config: {
    gpuLayers: number;
    maxGpuLayers: number;
    contextSize: number;
    threads: number;
    temperature: number;
    topP: number;
    repeatPenalty: number;
    flashAttention: boolean;
    mlock: boolean;
    numa: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metrics?: {
    tps: number;
    ttftMs: number;
    totalTokens: number;
    vramUsedGB: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  systemPrompt: string;
  temperature: number;
  topP: number;
}

export interface ArenaPaneState {
  modelId: string;
  temperature: number;
  gpuOffloadRatio: number; // 0 to 1
  isGenerating: boolean;
  currentResponse: string;
  metrics: {
    tps: number;
    ttftMs: number;
    totalTokens: number;
    vramUsedGB: number;
  };
}

export type ResearchStage =
  | "plan"
  | "search"
  | "extract"
  | "synthesize"
  | "verify";

export interface ResearchStep {
  id: string;
  stage: ResearchStage;
  title: string;
  detail: string;
  timestamp: string;
  durationMs: number;
  status: "pending" | "running" | "completed" | "failed";
  logs: string[];
}

export interface ResearchCitation {
  id: string;
  title: string;
  url: string;
  domain: string;
  relevanceScore: number; // 0 - 100
  snippet: string;
  verified: boolean;
}

export interface ResearchDossier {
  id: string;
  title: string;
  topic: string;
  depth: "standard" | "exhaustive" | "academic";
  status: "idle" | "planning" | "searching" | "analyzing" | "generating" | "completed";
  progress: number;
  steps: ResearchStep[];
  generatedDocument: string;
  citations: ResearchCitation[];
  createdAt: string;
  tokensConsumed: number;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingDimensions: number;
  similarityScore?: number;
}

export interface IngestedDocument {
  id: string;
  collectionId: string;
  name: string;
  sizeBytes: number;
  type: "pdf" | "docx" | "txt" | "md" | "csv" | "json" | "code";
  status: "indexed" | "indexing" | "failed";
  chunkCount: number;
  indexedAt: string;
  chunks: DocumentChunk[];
}

export interface DocumentCollection {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  totalChunks: number;
  embeddingModel: string;
  vectorDimensions: number;
  createdAt: string;
}

export interface HardwareTelemetry {
  cpuUsage: number; // 0 - 100
  cpuModel: string;
  ramUsedGB: number;
  ramTotalGB: number;
  vramUsedGB: number;
  vramTotalGB: number;
  gpuName: string;
  gpuTempC: number;
  gpuClockMHz: number;
  gpuFanSpeedPercent: number;
  computeBackend: string; // "CUDA 12.4 (cuBLAS)", "Metal (MPS)", "ROCm 6.0", "Vulkan 1.3"
  activeTps: number;
  totalLoadedModels: number;
  uptimeHours: number;
}
