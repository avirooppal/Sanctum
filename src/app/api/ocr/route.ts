import { NextRequest, NextResponse } from "next/server";

const DEFAULT_OCR_ENDPOINT = "http://127.0.0.1:8010";

function resolveLoopbackOcrEndpoint(): string {
  const raw = (process.env.SANCTUM_OCR_ENDPOINT || DEFAULT_OCR_ENDPOINT).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return DEFAULT_OCR_ENDPOINT;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("Offline OCR policy blocks non-loopback OCR endpoints.");
  }
  return raw;
}

export async function GET() {
  try {
    const endpoint = resolveLoopbackOcrEndpoint();
    const res = await fetch(`${endpoint}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json({ available: false, endpoint }, { status: 200 });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ available: true, endpoint, ...data });
  } catch {
    return NextResponse.json({ available: false, endpoint: DEFAULT_OCR_ENDPOINT }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const endpoint = resolveLoopbackOcrEndpoint();
    const incoming = await req.formData();
    const file = incoming.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided for OCR." }, { status: 400 });
    }

    const forward = new FormData();
    const filename = file instanceof File && file.name ? file.name : "document.pdf";
    forward.append("file", file, filename);

    const outputFormat = String(incoming.get("output_format") || "markdown");
    const task = String(incoming.get("task") || "ocr");
    const unloadAfter = String(incoming.get("unload_after") || "false");
    forward.append("output_format", outputFormat);
    forward.append("task", task);
    forward.append("unload_after", unloadAfter);

    const res = await fetch(`${endpoint}/ocr`, {
      method: "POST",
      body: forward,
      signal: AbortSignal.timeout(180000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          ocrAvailable: true,
          error: data?.detail || data?.error || `Local OCR server returned HTTP ${res.status}`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      ocrAvailable: true,
      ...data,
    });
  } catch (err: any) {
    const isOffline =
      err?.name === "TimeoutError" ||
      err?.cause?.code === "ECONNREFUSED" ||
      /fetch failed|ECONNREFUSED/i.test(String(err?.message || ""));

    if (isOffline) {
      return NextResponse.json(
        {
          success: false,
          ocrAvailable: false,
          error: "Local PaddleOCR-VL-1.6 sidecar is not running on 127.0.0.1:8010.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: err?.message || "Local OCR failed." },
      { status: 500 }
    );
  }
}
