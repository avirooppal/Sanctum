import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getOcrDir() {
  const base =
    process.env.APPDATA ||
    (process.platform === "win32" ? path.join(os.homedir(), "AppData", "Roaming") : path.join(os.homedir(), ".config"));
  return path.join(base, "Sanctum", "models", "ocr");
}

export async function GET() {
  const ocrDir = getOcrDir();
  const paddleReady = fs.existsSync(path.join(ocrDir, "paddleocr-vl-1.6", ".sanctum_ocr_ready.json"));
  let activeModel = "windows-native";
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(ocrDir, "active.json"), "utf-8"));
    if (typeof meta?.activeModelId === "string") activeModel = meta.activeModelId;
  } catch {}

  let sidecarOnline = false;
  try {
    const r = await fetch("http://127.0.0.1:8010/health", { signal: AbortSignal.timeout(1500) });
    sidecarOnline = r.ok;
  } catch {}

  return NextResponse.json({
    activeModel,
    models: [
      { id: "windows-native", installed: true, active: activeModel === "windows-native" },
      {
        id: "paddleocr-vl-1.6",
        installed: paddleReady,
        active: activeModel === "paddleocr-vl-1.6",
        sidecarOnline,
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = String(body?.modelId || "");
    if (modelId !== "windows-native" && modelId !== "paddleocr-vl-1.6") {
      return NextResponse.json({ error: "Unknown OCR engine ID." }, { status: 400 });
    }
    const ocrDir = getOcrDir();
    fs.mkdirSync(ocrDir, { recursive: true });
    fs.writeFileSync(path.join(ocrDir, "active.json"), JSON.stringify({ activeModelId: modelId }, null, 2), "utf-8");
    return NextResponse.json({ ok: true, activeModel: modelId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update OCR engine" }, { status: 500 });
  }
}
