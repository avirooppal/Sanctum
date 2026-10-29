export type NavModule =
  | "chat"
  | "arena"
  | "vault"
  | "agents"
  | "research"
  | "settings"
  | "hub"
  | "rag"
  | "telemetry";

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

export interface ToolActivity {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "queued" | "awaiting_approval" | "running" | "success" | "error" | "cancelled";
  output?: string;
  callId?: string;
  index?: number;
  summary?: string;
  durationMs?: number;
}

export interface ChatMessage {
  modelId?: string;
  toolActivities?: ToolActivity[];
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
  requestStatus?: RequestStatusEvent;
  bookmarked?: boolean;
  attachments?: { name: string; size: number; content: string }[];
  image?: { src: string; name: string; width: number; height: number };
}

export interface ChatProject {
  id: string;
  name: string;
  assistantId?: string;
  createdAt: string;
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
  projectId?: string;
  pinned?: boolean;
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
  requestStatus?: RequestStatusEvent;
  bookmarked?: boolean;
  attachments?: { name: string; size: number; content: string }[];
  image?: { src: string; name: string; width: number; height: number };
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
  computeBackend: string;
  activeTps: number;
  totalLoadedModels: number;
  uptimeHours: number;
}


export type AgentActionStatus =
  | "idle"
  | "planning"
  | "waiting_approval"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface AgentStep {
  id: string;
  title: string;
  description?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  status: "pending" | "waiting_approval" | "running" | "completed" | "failed";
  result?: string;
  executionTimeMs?: number;
  requiresApproval?: boolean;
}

export interface AgentRun {
  id: string;
  goal: string;
  modelId: string;
  status: AgentActionStatus;
  currentStepIndex: number;
  steps: AgentStep[];
  createdAt: string;
  updatedAt: string;
  logs: string[];
}

export const REQUEST_PHASES = [
  "sending",
  "queued",
  "loading_model",
  "reading_message",
  "searching_documents",
  "thinking",
  "using_tool",
  "waiting_approval",
  "writing_answer",
  "finishing",
  "done",
  "stopped",
  "cancelled",
  "stalled",
  "error",
] as const;

export type RequestPhase = (typeof REQUEST_PHASES)[number];

export interface RequestStatusProgress {
  current: number;
  total: number;
  unit?: "tokens" | "bytes" | "docs" | "steps" | "percent";
  percentage?: number;
}

export interface RequestStatusEvent {
  request_id: string;
  thread_id: string;
  message_id: string;
  phase: RequestPhase;
  timestamp: number;
  elapsed_ms: number;
  progress?: RequestStatusProgress;
  detail?: string;
  stats?: {
    tokens_generated?: number;
    tokens_per_second?: number;
    prompt_tokens?: number;
    context_total?: number;
    time_to_first_token_ms?: number;
    total_time_ms?: number;
  };
  tool_call?: {
    id: string;
    name: string;
    args_summary: string;
    risk_level: "low" | "medium" | "high";
    gated: boolean;
  };
  error?: {
    code: string;
    message: string;
    recovery_actions: ("retry" | "switch_model" | "free_memory" | "open_settings")[];
  };
}
