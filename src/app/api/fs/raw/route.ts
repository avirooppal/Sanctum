import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getMimeTypeForExtension, resolveFsTarget } from "../_shared";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path");
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path parameter." }, { status: 400 });
    }

    const { target } = resolveFsTarget(rawPath, false, "read", "read");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return NextResponse.json({ error: `File not found: ${rawPath}` }, { status: 404 });
    }

    const ext = path.extname(target).toLowerCase();
    const contentType = getMimeTypeForExtension(ext);
    const fileLength = fs.statSync(target).size;
    const rangeHeader = req.headers.get("range");

    const baseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };
    if ([".html", ".htm", ".svg", ".xml"].includes(ext)) {
      baseHeaders["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; sandbox";
    }

    if (rangeHeader && rangeHeader.toLowerCase().startsWith("bytes=")) {
      const [startStr, endStr] = rangeHeader.slice(6).split("-");
      const start = parseInt(startStr, 10);
      let end = endStr ? parseInt(endStr, 10) : fileLength - 1;
      if (Number.isNaN(start) || start < 0 || start >= fileLength || end < start) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...baseHeaders, "Content-Range": `bytes */${fileLength}` },
        });
      }
      if (end >= fileLength) end = fileLength - 1;
      const length = end - start + 1;

      const fd = fs.openSync(target, "r");
      const chunk = Buffer.alloc(length);
      fs.readSync(fd, chunk, 0, length, start);
      fs.closeSync(fd);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileLength}`,
          "Content-Length": String(length),
        },
      });
    }

    const fullBuf = fs.readFileSync(target);
    return new NextResponse(fullBuf, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(fileLength),
      },
    });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to stream file" }, { status });
  }
}
