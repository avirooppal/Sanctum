import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

/** Same-origin proxy keeps browser chat independent of Ollama's CORS configuration. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body.model !== "string" || !body.model.trim() || !Array.isArray(body.messages) ||
        !body.messages.every((m: any) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")) {
      return NextResponse.json({ error: "A model and valid messages are required." }, { status: 400 });
    }
    const upstream = await fetch(`${DEFAULT_OLLAMA_ENDPOINT}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/x-ndjson", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid JSON request." : "Local engine unavailable. Start Ollama and retry." }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
