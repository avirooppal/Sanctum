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

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const modelId = String(body?.modelId || "paddleocr-vl-1.6");
    if (modelId !== "paddleocr-vl-1.6") {
      return NextResponse.json({ error: "Cannot delete built-in OCR engine." }, { status: 400 });
    }
    const targetDir = path.join(getOcrDir(), modelId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Use the Sanctum Windows desktop app or `huggingface-cli download PaddlePaddle/PaddleOCR-VL-1.6` to download weights." },
    { status: 501 }
  );
}
