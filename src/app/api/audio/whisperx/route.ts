import { NextResponse } from "next/server";
import { DEFAULT_WHISPERX_ENDPOINT } from "@/lib/constants";

export async function GET() {
  const endpoints = [
    DEFAULT_WHISPERX_ENDPOINT,
    `${DEFAULT_WHISPERX_ENDPOINT}/health`,
    "http://localhost:8000/health",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        return NextResponse.json({
          online: true,
          endpoint: ep,
          whisperxVersion: "whisperX (fast-whisper + phoneme alignment)",
        });
      }
    } catch {
      // offline
    }
  }

  return NextResponse.json({
    online: false,
    endpoint: DEFAULT_WHISPERX_ENDPOINT,
    commandToStart: "python scripts/whisperx_server.py --port 8000 --model base",
  });
}
