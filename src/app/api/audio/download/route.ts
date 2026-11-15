import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ALLOWED_STT_MODELS = new Set([
  "qwen3-asr-0.6b",
  "nemotron-3.5-transcribe",
  "whisper-base",
  "whisper-small",
]);

function getDestDir(modelId: string): string {
  return path.join(os.homedir(), ".cache", "sanctum", "stt", modelId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = typeof (body?.modelId ?? body?.name) === "string"
      ? String(body.modelId ?? body.name).trim()
      : "";

    if (!ALLOWED_STT_MODELS.has(modelId)) {
      return NextResponse.json(
        { error: `Unknown or unsupported STT model: ${modelId}` },
        { status: 400 }
      );
    }

    const scriptPath = path.resolve(process.cwd(), "core", "ai", "speech", "stt_download.py");
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "STT downloader script not found" },
        { status: 500 }
      );
    }

    const destDir = getDestDir(modelId);
    const pythonBin = process.platform === "win32" ? "python" : "python3";

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (obj: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
          } catch {}
        };

        const child = spawn(pythonBin, ["-u", scriptPath, "--model", modelId, "--dest", destDir], {
          stdio: ["ignore", "pipe", "pipe"],
        });

        req.signal.addEventListener("abort", () => {
          try {
            child.kill();
          } catch {}
        });

        let buffer = "";
        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                controller.enqueue(encoder.encode(`${line.trim()}\n`));
              } catch {}
            }
          }
        });

        let stderrText = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderrText += chunk.toString("utf-8");
        });

        child.on("error", (err) => {
          send({ status: "error", error: `Failed to launch Python: ${err.message}` });
          try {
            controller.close();
          } catch {}
        });

        child.on("close", (code) => {
          if (buffer.trim()) {
            try {
              controller.enqueue(encoder.encode(`${buffer.trim()}\n`));
            } catch {}
          }
          if (code !== 0) {
            send({
              status: "error",
              error: stderrText.trim() || `Downloader exited with code ${code}`,
            });
          }
          try {
            controller.close();
          } catch {}
        });
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
    return NextResponse.json(
      { error: err?.message || "Failed to initiate STT model download" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId")?.trim() || "";
  if (!ALLOWED_STT_MODELS.has(modelId)) {
    return NextResponse.json({ error: "Invalid STT modelId" }, { status: 400 });
  }
  const destDir = getDestDir(modelId);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  return NextResponse.json({ success: true, modelId });
}
