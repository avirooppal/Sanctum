import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import { resolveScopedPath, type AccessScope } from "@core/infra/security/path_resolver.ts";

export const IGNORED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "out",
  "__pycache__",
  ".venv",
  ".turbo",
  "target",
  "build_payload",
]);

export const BLOCKED_EXTERNAL_OPEN_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".msc",
  ".msi",
  ".msp",
  ".scr",
  ".com",
  ".pif",
  ".hta",
  ".reg",
  ".dll",
  ".cpl",
  ".lnk",
]);

export function getWorkspaceAndScope(): {
  root: string;
  id: string;
  scope: AccessScope;
  allowedFolders: string[];
  overrideHardBlocked: boolean;
} {
  const dataDir = getSanctumDataDir();
  const cfgPath = path.join(dataDir, "tool_workspace.txt");
  const idPath = path.join(dataDir, "tool_workspace_id.txt");
  const settingsPath = path.join(dataDir, "settings.json");

  let root = path.join(dataDir, "workspace");
  if (fs.existsSync(cfgPath)) {
    const saved = fs.readFileSync(cfgPath, "utf-8").trim();
    if (saved && fs.existsSync(saved)) root = path.resolve(saved);
  }
  fs.mkdirSync(root, { recursive: true });

  let id = Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16);
  if (fs.existsSync(idPath)) {
    id = fs.readFileSync(idPath, "utf-8").trim() || id;
  }

  let scope: AccessScope = "workspace_only";
  let allowedFolders: string[] = [];
  let overrideHardBlocked = false;
  if (fs.existsSync(settingsPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      if (s["access.scope"]) scope = s["access.scope"];
      if (Array.isArray(s["access.allowedFolders"])) allowedFolders = s["access.allowedFolders"];
      if (typeof s["access.overrideHardBlocked"] === "boolean") {
        overrideHardBlocked = s["access.overrideHardBlocked"];
      }
    } catch {}
  }

  return { root, id, scope, allowedFolders, overrideHardBlocked };
}

export function resolveFsTarget(
  rawPath: string,
  allowRoot: boolean,
  mode: "read" | "write",
  actionName: string
): { target: string; relPath: string; ws: ReturnType<typeof getWorkspaceAndScope> } {
  const ws = getWorkspaceAndScope();
  const res = resolveScopedPath({
    rawPath,
    workspaceRoot: ws.root,
    allowRoot,
    mode,
    scope: ws.scope,
    allowedFolders: ws.allowedFolders,
    overrideHardBlocked: ws.overrideHardBlocked,
    toolName: "workspace_files",
    actionName,
  });
  const rel = path.relative(ws.root, res.resolvedPath).replace(/\\/g, "/") || ".";
  return { target: res.resolvedPath, relPath: rel, ws };
}

export function computeRevisionHash(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

export function getMimeTypeForExtension(ext: string): string {
  switch ((ext || "").toLowerCase()) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".bmp":
      return "image/bmp";
    case ".pdf":
      return "application/pdf";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
      return "audio/ogg";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".json":
      return "application/json; charset=utf-8";
    case ".csv":
      return "text/csv; charset=utf-8";
    case ".md":
    case ".txt":
    case ".log":
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
    case ".py":
    case ".cs":
    case ".css":
    case ".yml":
    case ".yaml":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
