import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_OLLAMA_ENDPOINT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Model name is required" }, { status: 400 });
    }

    // Attempt to pull from Ollama daemon
    const endpoints = [DEFAULT_OLLAMA_ENDPOINT, "http://localhost:11434"];
    let ollamaResponse: Response | null = null;
    let successfulEndpoint = "";

    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ep}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, stream: true }),
        });
        if (res.ok && res.body) {
          ollamaResponse = res;
          successfulEndpoint = ep;
          break;
        }
      } catch {
        // try next
      }
    }

    if (!ollamaResponse || !ollamaResponse.body) {
      return NextResponse.json(
        {
          error: "Could not connect to Ollama daemon on localhost:11434. Make sure Ollama is running.",
        },
        { status: 503 }
      );
    }

    // Forward the streaming response directly to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse!.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to initiate pull" }, { status: 500 });
  }
}
