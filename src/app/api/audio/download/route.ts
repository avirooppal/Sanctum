import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const STT_REPOS: Record<string, string> = {
  "qwen3-asr-0.6b": "Qwen/Qwen3-ASR-0.6B",
  "nemotron-3.5-transcribe": "nvidia/nemotron-3.5-asr-streaming-0.6b",
  "whisper-base": "Systran/faster-whisper-base",
  "whisper-small": "Systran/faster-whisper-small",
};

interface HfTreeItem {
  type?: string;
  path?: string;
  size?: number;
}

function getDestDir(modelId: string): string {
  return path.join(os.homedir(), ".cache", "sanctum", "stt", modelId);
}

async function listHfFiles(repoId: string, signal: AbortSignal): Promise<{ relPath: string; size: number }[]> {
  const url = `https://huggingface.co/api/models/${repoId}/tree/main?recursive=1`;
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Sanctum-STT-Downloader/2.0" },
  });
  if (!res.ok) {
    throw new Error(`HuggingFace manifest request failed for ${repoId} (HTTP ${res.status})`);
  }
  const items = (await res.json()) as HfTreeItem[];
  return items
    .filter((i) => i.type === "file" && typeof i.path === "string" && i.path.length > 0)
    .map((i) => ({ relPath: i.path!, size: Number(i.size || 0) }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId =
      typeof (body?.modelId ?? body?.name) === "string"
        ? String(body.modelId ?? body.name).trim()
        : "";

    const repoId = STT_REPOS[modelId];
    if (!repoId) {
      return NextResponse.json(
        { error: `Unknown or unsupported STT model: ${modelId}` },
        { status: 400 }
      );
    }

    const destDir = getDestDir(modelId);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (obj: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
          } catch {}
        };

        try {
          await fsp.mkdir(destDir, { recursive: true });
          send({ status: `Preparing download for ${modelId} (${repoId})...` });

          const files = await listHfFiles(repoId, req.signal);
          if (files.length === 0) {
            throw new Error(`No downloadable files found in ${repoId}`);
          }

          const totalBytes = files.reduce((acc, f) => acc + f.size, 0) || files.length * 1024;
          let downloadedBytes = 0;
          let lastEmitMs = 0;

          for (const item of files) {
            req.signal.throwIfAborted();
            const safeSegments = item.relPath
              .split("/")
              .filter((seg) => seg && seg !== "." && seg !== "..");
            const targetPath = path.join(destDir, ...safeSegments);
            await fsp.mkdir(path.dirname(targetPath), { recursive: true });

            if (item.size > 0 && fs.existsSync(targetPath)) {
              const stat = await fsp.stat(targetPath);
              if (stat.size === item.size) {
                downloadedBytes += item.size;
                send({
                  status: `Verified ${item.relPath}`,
                  completed: Math.min(downloadedBytes, totalBytes),
                  total: totalBytes,
                });
                continue;
              }
            }

            const encodedPath = safeSegments.map((s) => encodeURIComponent(s)).join("/");
            const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${encodedPath}`;
            send({
              status: `Downloading ${item.relPath}...`,
              completed: Math.min(downloadedBytes, totalBytes),
              total: totalBytes,
            });

            const fileRes = await fetch(fileUrl, {
              signal: req.signal,
              redirect: "follow",
              headers: { "User-Agent": "Sanctum-STT-Downloader/2.0" },
            });
            if (!fileRes.ok || !fileRes.body) {
              throw new Error(`Failed downloading ${item.relPath} (HTTP ${fileRes.status})`);
            }

            const tmpPath = `${targetPath}.part`;
            const out = fs.createWriteStream(tmpPath);
            const reader = fileRes.body.getReader();

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value && value.byteLength > 0) {
                  if (!out.write(value)) {
                    await new Promise<void>((resolve, reject) => {
                      out.once("drain", resolve);
                      out.once("error", reject);
                    });
                  }
                  downloadedBytes += value.byteLength;
                  const now = Date.now();
                  if (now - lastEmitMs >= 150) {
                    lastEmitMs = now;
                    send({
                      status: `Downloading ${item.relPath}...`,
                      completed: Math.min(downloadedBytes, totalBytes),
                      total: totalBytes,
                    });
                  }
                }
              }
              await new Promise<void>((resolve, reject) => {
                out.end(() => resolve());
                out.on("error", reject);
              });
              await fsp.rename(tmpPath, targetPath);
            } catch (fileErr) {
              out.destroy();
              await fsp.rm(tmpPath, { force: true }).catch(() => {});
              throw fileErr;
            }
          }

          const markerPath = path.join(destDir, ".sanctum_stt_ready.json");
          await fsp.writeFile(
            markerPath,
            JSON.stringify(
              {
                id: modelId,
                repo: repoId,
                bytes: totalBytes,
                ready: true,
                downloadedAt: new Date().toISOString(),
              },
              null,
              2
            ),
            "utf-8"
          );

          send({ status: "success", completed: totalBytes, total: totalBytes });
        } catch (err: any) {
          if (req.signal.aborted) {
            send({ status: "error", error: "Download cancelled" });
          } else {
            send({
              status: "error",
              error: err?.message || "Failed to download STT model weights",
            });
          }
        } finally {
          try {
            controller.close();
          } catch {}
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
    return NextResponse.json(
      { error: err?.message || "Failed to initiate STT model download" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId")?.trim() || "";
  if (!STT_REPOS[modelId]) {
    return NextResponse.json({ error: "Invalid STT modelId" }, { status: 400 });
  }
  const destDir = getDestDir(modelId);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  return NextResponse.json({ success: true, modelId });
}
