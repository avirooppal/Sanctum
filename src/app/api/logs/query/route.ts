import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import { readLogs, type LogSourceType } from "@core/infra/logs/log_reader.ts";
import type { AccessScope } from "@core/infra/security/path_resolver.ts";

function getWorkspaceRoot(): string {
  const dataDir = getSanctumDataDir();
  const wsMetaFile = path.join(dataDir, "workspace.json");
  const defaultRoot = path.join(dataDir, "workspace");
  try {
    if (fs.existsSync(wsMetaFile)) {
      const parsed = JSON.parse(fs.readFileSync(wsMetaFile, "utf-8"));
      if (parsed && typeof parsed.root === "string" && fs.existsSync(parsed.root)) {
        return path.resolve(parsed.root);
      }
    }
  } catch {}
  return path.resolve(defaultRoot);
}

function getAccessSettings(): { scope: AccessScope; allowedFolders: string[]; overrideHardBlocked: boolean } {
  const dataDir = getSanctumDataDir();
  const settingsFile = path.join(dataDir, "settings.json");
  let scope: AccessScope = "workspace_only";
  let allowedFolders: string[] = [];
  let overrideHardBlocked = false;

  try {
    if (fs.existsSync(settingsFile)) {
      const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      if (parsed["access.scope"]) scope = parsed["access.scope"];
      if (parsed["access.overrideHardBlocked"]) overrideHardBlocked = Boolean(parsed["access.overrideHardBlocked"]);
      if (parsed["access.allowedFolders"]) {
        try {
          allowedFolders = Array.isArray(parsed["access.allowedFolders"])
            ? parsed["access.allowedFolders"]
            : JSON.parse(parsed["access.allowedFolders"]);
        } catch {
          allowedFolders = String(parsed["access.allowedFolders"])
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }
  } catch {}

  return { scope, allowedFolders, overrideHardBlocked };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = (body.source as LogSourceType) || "sanctum";
    const logPath = body.path ? String(body.path) : undefined;
    const tail = Math.min(2000, Math.max(1, Number(body.tail) || 100));
    const regex = body.regex ? String(body.regex) : undefined;
    const timeStart = body.timeStart || body.time_start;
    const timeEnd = body.timeEnd || body.time_end;

    const wsRoot = getWorkspaceRoot();
    const access = getAccessSettings();

    const result = readLogs({
      source,
      path: logPath,
      tail,
      regex,
      timeStart,
      timeEnd,
      workspaceRoot: wsRoot,
      scope: access.scope,
      allowedFolders: access.allowedFolders,
      overrideHardBlocked: access.overrideHardBlocked,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to read logs" }, { status: 400 });
  }
}
