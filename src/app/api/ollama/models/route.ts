import { NextResponse } from "next/server";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export async function GET() {
  const endpoints = [DEFAULT_OLLAMA_ENDPOINT, "http://localhost:11434"];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${ep}/api/tags`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          online: true,
          endpoint: ep,
          models: data.models || [],
        });
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({
    online: false,
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    models: [],
  });
}
