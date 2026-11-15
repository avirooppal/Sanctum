import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { IGNORED_DIR_NAMES, resolveFsTarget } from "../_shared";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path") || ".";
    const showIgnored = url.searchParams.get("showIgnored") !== "false";

    const { target, relPath, ws } = resolveFsTarget(rawPath, true, "read", "list");
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return NextResponse.json({ error: `Directory not found: ${rawPath}` }, { status: 404 });
    }

    const dirents = fs.readdirSync(target, { withFileTypes: true });
    dirents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const entries: any[] = [];
    for (const d of dirents) {
      if (entries.length >= 500) break;
      const isIgnored = IGNORED_DIR_NAMES.has(d.name) || d.name.startsWith(".");
      if (!showIgnored && isIgnored) continue;

      const full = path.join(target, d.name);
      let size = 0;
      let modifiedAt = new Date().toISOString();
      let isSymlink = d.isSymbolicLink();
      try {
        const st = fs.lstatSync(full);
        isSymlink = st.isSymbolicLink();
        if (!d.isDirectory()) size = st.size;
        modifiedAt = st.mtime.toISOString();
      } catch {}

      const itemRel = path.relative(ws.root, full).replace(/\\/g, "/");
      entries.push({
        name: d.name,
        path: itemRel,
        isDirectory: d.isDirectory(),
        isSymlink,
        ignored: isIgnored,
        size,
        extension: d.isDirectory() ? "" : path.extname(d.name).toLowerCase(),
        modifiedAt,
      });
    }

    return NextResponse.json({
      path: relPath,
      root: ws.root,
      workspaceId: ws.id,
      entries,
    });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to list directory" }, { status });
  }
}
