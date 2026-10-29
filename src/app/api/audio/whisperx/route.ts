import { NextResponse } from "next/server";
import { DEFAULT_WHISPERX_ENDPOINT } from "@/lib/constants";
import { defaultSettingsStore } from "../../../../../core/infra/storage/settings_store.ts";

export async function GET() {
  let configuredEndpoint: string | null = null;
  let configuredModel = "base";
  try {
    configuredEndpoint = defaultSettingsStore.get("assistants.sttEndpoint");
    configuredModel = defaultSettingsStore.get("assistants.sttModel") || "base";
  } catch {}

  const endpoints = Array.from(
    new Set([
      configuredEndpoint ? `${configuredEndpoint.replace(/\/$/, "")}/health` : null,
      configuredEndpoint,
      `${DEFAULT_WHISPERX_ENDPOINT}/health`,
      DEFAULT_WHISPERX_ENDPOINT,
      "http://localhost:8000/health",
      "http://localhost:8000",
    ])
  ).filter(Boolean) as string[];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        return NextResponse.json({
          online: true,
          endpoint: ep,
          model: configuredModel,
          whisperxVersion: "whisperX (fast-whisper + phoneme alignment)",
        });
      }
    } catch {
      // offline
    }
  }

  return NextResponse.json({
    online: false,
    endpoint: configuredEndpoint || DEFAULT_WHISPERX_ENDPOINT,
    model: configuredModel,
    commandToStart: `python scripts/whisperx_server.py --port 8000 --model ${configuredModel}`,
  });
}
