import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  resolveScopedPath,
  type AccessScope,
  type OperationMode,
} from "@core/infra/security/path_resolver.ts";
import { createCheckpoint } from "@core/infra/checkpoints/checkpoint_manager.ts";
import {
  computeStructuredDiff,
  applyAcceptedHunks,
  type DiffHunk,
} from "@core/infra/diff/diff_engine.ts";
import { executePostEditHook } from "@core/infra/hooks/post_edit_hook.ts";

function getSanctumDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getFileSettings(): {
  scope: AccessScope;
  allowedFolders: string[];
  overrideHardBlocked: boolean;
  enableCheckpoints: boolean;
  postEditHook: string;
  runPostEditHook: boolean;
} {
  const dataDir = getSanctumDataDir();
  const settingsFile = path.join(dataDir, "settings.json");
  let scope: AccessScope = "workspace_only";
  let allowedFolders: string[] = [];
  let overrideHardBlocked = false;
  let enableCheckpoints = true;
  let postEditHook = "";
  let runPostEditHook = false;

  try {
    if (fs.existsSync(settingsFile)) {
      const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      if (parsed["access.scope"]) scope = parsed["access.scope"];
      if (parsed["agent.enableCheckpoints"] !== undefined) enableCheckpoints = Boolean(parsed["agent.enableCheckpoints"]);
      if (parsed["agent.postEditHook"]) postEditHook = String(parsed["agent.postEditHook"]);
      if (parsed["agent.runPostEditHook"] !== undefined) runPostEditHook = Boolean(parsed["agent.runPostEditHook"]);
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
      if (parsed["access.overrideHardBlocked"] !== undefined) {
        overrideHardBlocked = Boolean(parsed["access.overrideHardBlocked"]);
      }
    }
  } catch {}

  return { scope, allowedFolders, overrideHardBlocked, enableCheckpoints, postEditHook, runPostEditHook };
}

function getWorkspaceState(): { root: string; id: string } {
  const dataDir = getSanctumDataDir();
  const wsMetaFile = path.join(dataDir, "workspace.json");
  const defaultRoot = path.join(dataDir, "workspace");
  fs.mkdirSync(defaultRoot, { recursive: true });
  try {
    if (fs.existsSync(wsMetaFile)) {
      const parsed = JSON.parse(fs.readFileSync(wsMetaFile, "utf-8"));
      if (parsed && typeof parsed.root === "string" && fs.existsSync(parsed.root)) {
        const root = path.resolve(parsed.root);
        return { root, id: Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16) };
      }
    }
  } catch {
    // fallback
  }
  const root = path.resolve(defaultRoot);
  return { root, id: Buffer.from(root.toLowerCase()).toString("hex").slice(0, 16) };
}

function searchFilesRecursive(
  dir: string,
  rootDir: string,
  query: string,
  results: { file: string; line: number; text: string }[]
) {
  if (results.length >= 100) return;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  let regex: RegExp | null = null;
  try {
    regex = new RegExp(query, "i");
  } catch {
    regex = null;
  }
  const lowerQuery = query.toLowerCase();

  for (const entry of entries) {
    if (results.length >= 100) break;
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      searchFilesRecursive(full, rootDir, query, results);
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(full);
        if (stat.size > 524288) continue;
        const text = fs.readFileSync(full, "utf-8");
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matched = regex ? regex.test(line) : line.toLowerCase().includes(lowerQuery);
          if (matched) {
            results.push({
              file: path.relative(rootDir, full).replace(/\\/g, "/"),
              line: i + 1,
              text: line.slice(0, 240),
            });
            if (results.length >= 100) break;
          }
        }
      } catch {
        // skip unreadable
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ws = getWorkspaceState();
    if (body?.workspaceId && body.workspaceId !== ws.id) {
      return NextResponse.json({ error: "Workspace changed. Send the request again." }, { status: 400 });
    }
    if (body?.name !== "workspace_files") {
      return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
    }
    const args = body?.arguments;
    if (!args || typeof args !== "object") {
      return NextResponse.json({ error: "Invalid arguments." }, { status: 400 });
    }

    const action = String(args.action || "");
    const relative = String(args.path ?? ".");

    if (action === "undo") {
      const trashRoot = path.join(getSanctumDataDir(), "tool-trash");
      if (!fs.existsSync(trashRoot)) {
        return NextResponse.json({ error: "No trashed items to restore." }, { status: 400 });
      }
      const folders = fs
        .readdirSync(trashRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => ({
          name: d.name,
          full: path.join(trashRoot, d.name),
          mtime: fs.statSync(path.join(trashRoot, d.name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const folder of folders) {
        const metaFile = path.join(folder.full, "restore.json");
        if (fs.existsSync(metaFile)) {
          const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
          if (meta.saved && meta.original && fs.existsSync(meta.saved)) {
            fs.mkdirSync(path.dirname(meta.original), { recursive: true });
            fs.renameSync(meta.saved, meta.original);
            fs.rmSync(folder.full, { recursive: true, force: true });
            return NextResponse.json({
              restored: path.relative(ws.root, meta.original).replace(/\\/g, "/"),
            });
          }
        }
      }
      return NextResponse.json({ error: "No recoverable item found in tool-trash." }, { status: 400 });
    }

    const isWrite = ["create", "edit", "patch", "mkdir", "move", "delete"].includes(action);
    const mode: OperationMode = isWrite ? "write" : "read";
    const allowRoot = action === "list" || action === "search";

    const settings = getFileSettings();
    const resolution = resolveScopedPath({
      rawPath: relative,
      workspaceRoot: ws.root,
      allowRoot,
      mode,
      scope: settings.scope,
      allowedFolders: settings.allowedFolders,
      overrideHardBlocked: settings.overrideHardBlocked,
      toolName: "workspace_files",
      actionName: action,
    });
    const target = resolution.resolvedPath;

    // Snapshot checkpoint before modifying files
    if (isWrite && settings.enableCheckpoints) {
      try {
        createCheckpoint({
          workspaceId: ws.id,
          workspaceRoot: ws.root,
          affectedFilePaths: [target],
          summary: `Auto-checkpoint before ${action} on ${relative}`,
        });
      } catch {}
    }

    if (action === "list") {
      const entries = fs.readdirSync(target, { withFileTypes: true }).slice(0, 200).map((e) => ({
        name: e.name,
        directory: e.isDirectory(),
        link: e.isSymbolicLink(),
      }));
      return NextResponse.json({ entries, limit: 200 });
    }

    if (action === "search") {
      const query = String(args.query || "").trim();
      if (!query) throw new Error("Missing search query.");
      const matches: { file: string; line: number; text: string }[] = [];
      searchFilesRecursive(target, ws.root, query, matches);
      return NextResponse.json({ query, count: matches.length, matches });
    }

    if (action === "read") {
      const stat = fs.statSync(target);
      if (stat.size > 1048576) throw new Error("Read limit is 1 MiB.");
      const content = fs.readFileSync(target, "utf-8");
      return NextResponse.json({ content });
    }

    if (action === "read_range") {
      const stat = fs.statSync(target);
      if (stat.size > 2097152) throw new Error("Read limit is 2 MiB.");
      const lines = fs.readFileSync(target, "utf-8").split(/\r?\n/);
      const start = Math.max(1, Number(args.start_line) || 1);
      const end = Math.min(lines.length, Math.max(start, Number(args.end_line) || start + 100));
      const slice = lines.slice(start - 1, end).join("\n");
      return NextResponse.json({
        path: relative,
        start_line: start,
        end_line: end,
        total_lines: lines.length,
        content: slice,
      });
    }

    if (action === "create") {
      const content = String(args.content ?? "");
      if (Buffer.byteLength(content, "utf-8") > 1048576) throw new Error("Write limit is 1 MiB.");

      if (args.preview_diff) {
        const diff = computeStructuredDiff(relative, "", content);
        return NextResponse.json({ preview: true, diff });
      }

      if (fs.existsSync(target)) throw new Error("File already exists.");
      fs.writeFileSync(target, content, { encoding: "utf-8", flag: "wx" });

      const hookRes = await executePostEditHook({
        workspaceRoot: ws.root,
        filePath: relative,
        hookCommand: settings.postEditHook,
        enabled: settings.runPostEditHook,
      });

      return NextResponse.json({
        created: relative,
        postEditHook: hookRes.executed ? hookRes : undefined,
        diagnostics: hookRes.diagnostics,
      });
    }

    if (action === "edit" || action === "patch") {
      const stat = fs.statSync(target);
      if (stat.size > 1048576) throw new Error("Edit limit is 1 MiB.");
      const currentContent = fs.readFileSync(target, "utf-8");
      let updated: string;

      if (args.hunks && Array.isArray(args.hunks)) {
        updated = applyAcceptedHunks(currentContent, args.hunks as DiffHunk[]);
      } else {
        const before = String(args.old_text ?? "");
        const after = String(args.new_text ?? "");
        const at = currentContent.indexOf(before);
        if (!before.length || at < 0 || currentContent.indexOf(before, at + 1) >= 0) {
          throw new Error("old_text must match exactly once. Read the file first.");
        }
        updated = currentContent.slice(0, at) + after + currentContent.slice(at + before.length);
      }

      if (args.preview_diff) {
        const diff = computeStructuredDiff(relative, currentContent, updated);
        return NextResponse.json({ preview: true, diff });
      }

      if (Buffer.byteLength(updated, "utf-8") > 1048576) throw new Error("Edit limit is 1 MiB.");
      fs.writeFileSync(target, updated, "utf-8");

      const hookRes = await executePostEditHook({
        workspaceRoot: ws.root,
        filePath: relative,
        hookCommand: settings.postEditHook,
        enabled: settings.runPostEditHook,
      });

      return NextResponse.json({
        edited: relative,
        postEditHook: hookRes.executed ? hookRes : undefined,
        diagnostics: hookRes.diagnostics,
      });
    }

    if (action === "mkdir") {
      fs.mkdirSync(target, { recursive: true });
      return NextResponse.json({ created: relative });
    }

    if (action === "move") {
      const destination = String(args.destination || "");
      const destResolution = resolveScopedPath({
        rawPath: destination,
        workspaceRoot: ws.root,
        allowRoot: false,
        mode: "write",
        scope: settings.scope,
        allowedFolders: settings.allowedFolders,
        overrideHardBlocked: settings.overrideHardBlocked,
        toolName: "workspace_files",
        actionName: "move_destination",
      });
      const dest = destResolution.resolvedPath;
      if (fs.existsSync(dest)) throw new Error("Destination already exists.");
      fs.renameSync(target, dest);
      return NextResponse.json({ moved: relative, destination });
    }

    if (action === "delete") {
      const trash = path.join(
        getSanctumDataDir(),
        "tool-trash",
        crypto.randomUUID().replace(/-/g, "")
      );
      fs.mkdirSync(trash, { recursive: true });
      const saved = path.join(trash, path.basename(target));
      fs.renameSync(target, saved);
      fs.writeFileSync(
        path.join(trash, "restore.json"),
        JSON.stringify({ original: target, saved }),
        "utf-8"
      );
      return NextResponse.json({ deleted: relative, recoverableAt: saved });
    }

    return NextResponse.json({ error: "Unsupported file action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Tool execution failed" }, { status: 400 });
  }
}
