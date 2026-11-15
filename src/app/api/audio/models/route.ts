import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { STT_MODEL_CATALOG, DEFAULT_WHISPERX_ENDPOINT } from "@/lib/constants";
import { defaultSettingsStore } from "../../../../../core/infra/storage/settings_store.ts";

function getSttCacheRoot(): string {
  return path.join(os.homedir(), ".cache", "sanctum", "stt");
}

function isSttModelInstalled(modelId: string, hfRepo: string): boolean {
  const sanctumMarker = path.join(getSttCacheRoot(), modelId, ".sanctum_stt_ready.json");
  if (fs.existsSync(sanctumMarker)) return true;

  const hfDirName = `models--${hfRepo.replace("/", "--")}`;
  const hfDir = path.join(os.homedir(), ".cache", "huggingface", "hub", hfDirName, "snapshots");
  if (fs.existsSync(hfDir)) {
    try {
      return fs.readdirSync(hfDir).length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

export async function GET() {
  let activeModel = "whisper-base";
  let sttMode = "recommended";
  let sttEndpoint = DEFAULT_WHISPERX_ENDPOINT;

  try {
    activeModel = (defaultSettingsStore.get("assistants.sttModel") as string) || "whisper-base";
    sttMode = (defaultSettingsStore.get("assistants.sttMode") as string) || "recommended";
    sttEndpoint = (defaultSettingsStore.get("assistants.sttEndpoint") as string) || DEFAULT_WHISPERX_ENDPOINT;
  } catch {}

  const models = STT_MODEL_CATALOG.map((spec) => ({
    ...spec,
    installed: isSttModelInstalled(spec.id, spec.hfRepo),
    active: activeModel === spec.id,
  }));

  return NextResponse.json({
    models,
    activeModel,
    sttMode,
    sttEndpoint,
  });
}

const ALLOWED_STT_IDS = new Set([
  "qwen3-asr-0.6b",
  "nemotron-3.5-transcribe",
  "whisper-base",
  "whisper-small",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = typeof body?.modelId === "string" ? body.modelId.trim() : "";

    if (!ALLOWED_STT_IDS.has(modelId)) {
      return NextResponse.json(
        { error: `Unsupported STT model: ${modelId}` },
        { status: 400 }
      );
    }

    defaultSettingsStore.set("assistants.sttModel", modelId);
    const currentMode = defaultSettingsStore.get("assistants.sttMode");
    if (currentMode === "webspeech" || currentMode === "disabled") {
      defaultSettingsStore.set("assistants.sttMode", "recommended");
    }

    const endpoint =
      (defaultSettingsStore.get("assistants.sttEndpoint") as string) || DEFAULT_WHISPERX_ENDPOINT;

    // Best-effort hot-swap if local STT server is running
    let serverSwitched = false;
    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/models/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
        signal: AbortSignal.timeout(4000),
      });
      serverSwitched = res.ok;
    } catch {
      // Server may be offline; setting is persisted for next start / transcription
    }

    return NextResponse.json({
      success: true,
      activeModel: modelId,
      serverSwitched,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to select STT model" },
      { status: 500 }
    );
  }
}
