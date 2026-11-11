import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import {
  runCommand,
  startBackgroundProcess,
  readBackgroundProcessOutput,
  stopBackgroundProcess,
  listBackgroundProcesses,
  type ShellType,
} from "@core/infra/security/terminal_runner.ts";
import type { AccessScope } from "@core/infra/security/path_resolver.ts";

function getTerminalSettings(): {
  shell: ShellType;
  timeoutMs: number;
  maxOutputChars: number;
  scope: AccessScope;
  allowedFolders: string[];
  overrideHardBlocked: boolean;
  customRules: any[];
} {
  const dataDir = getSanctumDataDir();
  const settingsFile = path.join(dataDir, "settings.json");

  let shell: ShellType = "powershell";
  let timeoutMs = 30000;
  let maxOutputChars = 20000;
  let scope: AccessScope = "workspace_only";
  let allowedFolders: string[] = [];
  let overrideHardBlocked = false;
  let customRules: any[] = [];

  try {
    if (fs.existsSync(settingsFile)) {
      const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      if (parsed["terminal.shell"]) shell = parsed["terminal.shell"];
      if (parsed["terminal.timeoutMs"]) timeoutMs = Number(parsed["terminal.timeoutMs"]) || 30000;
      if (parsed["terminal.maxOutputChars"]) maxOutputChars = Number(parsed["terminal.maxOutputChars"]) || 20000;
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
      if (parsed["terminal.rules"]) {
        try {
          customRules = Array.isArray(parsed["terminal.rules"])
            ? parsed["terminal.rules"]
            : JSON.parse(parsed["terminal.rules"]);
        } catch {}
      }
    }
  } catch {}

  return { shell, timeoutMs, maxOutputChars, scope, allowedFolders, overrideHardBlocked, customRules };
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "run_command");
    const settings = getTerminalSettings();
    const workspaceRoot = getWorkspaceRoot();

    if (action === "run_command") {
      const command = String(body.command || "");
      const cwd = body.cwd ? String(body.cwd) : workspaceRoot;
      const shell = (body.shell as ShellType) || settings.shell;
      const timeoutMs = body.timeoutMs ? Number(body.timeoutMs) : settings.timeoutMs;
      const maxOutputChars = body.maxOutputChars ? Number(body.maxOutputChars) : settings.maxOutputChars;

      const result = await runCommand({
        command,
        cwd,
        workspaceRoot,
        shell,
        timeoutMs,
        maxOutputChars,
        scope: settings.scope,
        allowedFolders: settings.allowedFolders,
        overrideHardBlocked: settings.overrideHardBlocked,
        customRules: settings.customRules,
      });

      return NextResponse.json(result);
    }

    if (action === "start_background") {
      const command = String(body.command || "");
      const cwd = body.cwd ? String(body.cwd) : workspaceRoot;
      const shell = (body.shell as ShellType) || settings.shell;

      const result = startBackgroundProcess({
        command,
        cwd,
        workspaceRoot,
        shell,
        scope: settings.scope,
        allowedFolders: settings.allowedFolders,
        overrideHardBlocked: settings.overrideHardBlocked,
        customRules: settings.customRules,
      });

      return NextResponse.json(result);
    }

    if (action === "read_background_output") {
      const taskId = String(body.taskId || "");
      const limit = Number(body.limit) || 100;
      const result = readBackgroundProcessOutput(taskId, limit);
      return NextResponse.json(result);
    }

    if (action === "stop_background") {
      const taskId = String(body.taskId || "");
      const result = stopBackgroundProcess(taskId);
      return NextResponse.json(result);
    }

    if (action === "list_background") {
      const tasks = listBackgroundProcesses();
      return NextResponse.json({ tasks });
    }

    return NextResponse.json({ error: "Unsupported terminal action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Terminal execution failed." }, { status: 400 });
  }
}
