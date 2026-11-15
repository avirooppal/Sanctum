import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { resolveFsTarget } from "../_shared.ts";

export const dynamic = "force-dynamic";

function createSimpleZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  // Minimal store/deflate ZIP writer for dev parity
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf-8");
    const rawData = entry.data;
    const compressed = zlib.deflateRawSync(rawData);

    // CRC32
    let crc = 0xffffffff;
    for (let i = 0; i < rawData.length; i++) {
      crc ^= rawData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(rawData.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(rawData.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localHeaders.push(local, compressed);
    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPaths: string[] = Array.isArray(body?.paths)
      ? body.paths.map((p: unknown) => String(p || "").trim()).filter(Boolean)
      : [];
    if (rawPaths.length === 0) {
      return NextResponse.json({ error: "At least one file path is required in 'paths'." }, { status: 400 });
    }

    let archiveName = path.basename(String(body?.archiveName || "sanctum-deliverables.zip"));
    if (!archiveName.toLowerCase().endsWith(".zip")) archiveName += ".zip";

    const entries: Array<{ name: string; data: Buffer }> = [];
    const seen = new Set<string>();

    for (const rawPath of rawPaths) {
      const resolved = resolveFsTarget(rawPath, false, "read", "export_zip");
      if (!fs.existsSync(resolved.target) || !fs.statSync(resolved.target).isFile()) {
        return NextResponse.json({ error: `Deliverable file not found: ${rawPath}` }, { status: 404 });
      }
      const entryName = resolved.relPath.replace(/\\/g, "/").replace(/^\/+/, "") || path.basename(resolved.target);
      if (!seen.has(entryName.toLowerCase())) {
        seen.add(entryName.toLowerCase());
        entries.push({ name: entryName, data: fs.readFileSync(resolved.target) });
      }
    }

    const zipBytes = createSimpleZipBuffer(entries);
    let savedPath: string | null = null;
    if (body?.saveToWorkspace) {
      const dest = resolveFsTarget(archiveName, false, "write", "export_zip_save");
      fs.writeFileSync(dest.target, zipBytes);
      savedPath = dest.relPath;
    }

    return NextResponse.json({
      status: "ok",
      archiveName,
      fileCount: entries.length,
      sizeBytes: zipBytes.length,
      savedPath,
      zipBase64: zipBytes.toString("base64"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Export ZIP failed" }, { status: 403 });
  }
}
