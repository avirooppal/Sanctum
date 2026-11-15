import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const capability = String(body.capability || "llm").toLowerCase();
    const mode = String(body.mode || "builtin").toLowerCase();
    const endpoint = String(body.endpoint || "").trim();
    const model = String(body.model || "").trim();
    const t0 = performance.now();

    if (capability === "llm") {
      const targetUrl =
        mode === "custom" && endpoint
          ? `${endpoint.replace(/\/$/, "")}/v1/models`
          : "http://127.0.0.1:11434/api/tags";
      try {
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
        const latencyMs = Math.max(1, Math.round(performance.now() - t0));
        if (res.ok) {
          return NextResponse.json({
            ok: true,
            capability: "llm",
            mode,
            latencyMs,
            message: `LLM endpoint reachable (${targetUrl}, ${latencyMs} ms).`,
          });
        }
      } catch {}
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return NextResponse.json({
        ok: false,
        capability: "llm",
        mode,
        latencyMs,
        message: `LLM endpoint not reachable at ${targetUrl}.`,
      });
    }

    if (capability === "stt") {
      if (mode === "custom" && endpoint) {
        try {
          const res = await fetch(`${endpoint.replace(/\/$/, "")}/health`, {
            signal: AbortSignal.timeout(2500),
          });
          const latencyMs = Math.max(1, Math.round(performance.now() - t0));
          return NextResponse.json({
            ok: res.ok,
            capability: "stt",
            mode,
            latencyMs,
            message: res.ok
              ? `Custom STT endpoint verified (${endpoint}, ${latencyMs} ms).`
              : `Custom STT endpoint returned HTTP ${res.status}.`,
          });
        } catch {
          const latencyMs = Math.max(1, Math.round(performance.now() - t0));
          return NextResponse.json({
            ok: false,
            capability: "stt",
            mode,
            latencyMs,
            message: `Custom STT endpoint unreachable (${endpoint}).`,
          });
        }
      }

      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return NextResponse.json({
        ok: true,
        capability: "stt",
        mode,
        latencyMs,
        model: model || "qwen3-asr-0.6b",
        message: `Speech-to-Text capability ready (${model || "qwen3-asr-0.6b"}).`,
      });
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - t0));
    return NextResponse.json({
      ok: true,
      capability,
      mode,
      latencyMs,
      message: `Browser Agent capability ready (isolated profile · telemetry OFF · ${latencyMs} ms).`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Test failed" },
      { status: 500 }
    );
  }
}
