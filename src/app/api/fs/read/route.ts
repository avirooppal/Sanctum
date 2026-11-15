import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { computeRevisionHash, resolveFsTarget } from "../_shared";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path");
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path parameter.", exists: false }, { status: 400 });
    }
    const maxBytes = Math.max(1024, Math.min(5242880, Number(url.searchParams.get("maxBytes")) || 2097152));
    const { target, relPath } = resolveFsTarget(rawPath, false, "read", "read");

    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return NextResponse.json({ error: `File not found: ${rawPath}`, exists: false }, { status: 404 });
    }

    const st = fs.statSync(target);
    const fileSize = st.size;
    const probeLen = Math.min(fileSize, 8192);
    const fd = fs.openSync(target, "r");
    const probe = Buffer.alloc(probeLen);
    fs.readSync(fd, probe, 0, probeLen, 0);

    let isBinary = false;
    for (let i = 0; i < probeLen; i++) {
      if (probe[i] === 0) {
        isBinary = true;
        break;
      }
    }

    if (isBinary) {
      fs.closeSync(fd);
      const hexLen = Math.min(probeLen, 512);
      const lines: string[] = [];
      for (let offset = 0; offset < hexLen; offset += 16) {
        let hexPart = offset.toString(16).toUpperCase().padStart(4, "0") + "  ";
        let asciiPart = "";
        for (let j = 0; j < 16; j++) {
          if (offset + j < hexLen) {
            const b = probe[offset + j];
            hexPart += b.toString(16).toUpperCase().padStart(2, "0") + " ";
            asciiPart += b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
          } else {
            hexPart += "   ";
          }
        }
        lines.push(`${hexPart} ${asciiPart}`);
      }
      return NextResponse.json({
        path: relPath,
        fullPath: target,
        exists: true,
        isBinary: true,
        truncated: fileSize > hexLen,
        size: fileSize,
        modifiedAt: st.mtime.toISOString(),
        revision: `${computeRevisionHash(probe)}-${fileSize}`,
        lineCount: 0,
        content: null,
        hexPreview: lines.join("\n"),
      });
    }

    const truncated = fileSize > maxBytes;
    const readLen = Math.min(fileSize, maxBytes);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, 0);
    fs.closeSync(fd);

    let text = buf.toString("utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    let lineCount = 1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") lineCount++;
    }

    return NextResponse.json({
      path: relPath,
      fullPath: target,
      exists: true,
      isBinary: false,
      truncated,
      size: fileSize,
      modifiedAt: st.mtime.toISOString(),
      revision: computeRevisionHash(buf),
      lineCount,
      content: text,
    });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to read file", exists: false }, { status });
  }
}
