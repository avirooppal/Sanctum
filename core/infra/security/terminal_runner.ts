import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSanctumDataDir, recordAuditLog } from "./audit_logger.ts";
import { resolveScopedPath, type AccessScope } from "./path_resolver.ts";
import { matchCommandRule, type CommandRule } from "./command_matcher.ts";

export type ShellType = "powershell" | "cmd" | "wsl";

export interface RunCommandOptions {
  command: string;
  cwd?: string;
  workspaceRoot?: string;
  scope?: AccessScope;
  allowedFolders?: string[];
  overrideHardBlocked?: boolean;
  shell?: ShellType;
  timeoutMs?: number;
  maxOutputChars?: number;
  env?: Record<string, string>;
  customRules?: CommandRule[];
  signal?: AbortSignal;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
  spillPath?: string;
  command: string;
  cwd: string;
}

export interface BackgroundProcessInfo {
  taskId: string;
  command: string;
  cwd: string;
  shell: ShellType;
  startTime: number;
  status: "running" | "completed" | "failed" | "terminated";
  exitCode: number | null;
  outputBuffer: string[];
  spillPath: string;
  process?: ChildProcess;
}

// Global in-memory registry of background terminal processes
const backgroundRegistry = new Map<string, BackgroundProcessInfo>();

function getSpillDirectory(): string {
  const spillDir = path.join(getSanctumDataDir(), "spills");
  if (!fs.existsSync(spillDir)) {
    try {
      fs.mkdirSync(spillDir, { recursive: true });
    } catch {}
  }
  return spillDir;
}

function resolveShellCommand(command: string, shell: ShellType = "powershell"): { file: string; args: string[] } {
  switch (shell) {
    case "cmd":
      return { file: "cmd.exe", args: ["/d", "/s", "/c", command] };
    case "wsl":
      return { file: "wsl.exe", args: ["-e", "bash", "-c", command] };
    case "powershell":
    default:
      return {
        file: "powershell.exe",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          command,
        ],
      };
  }
}

/**
 * Validates and resolves the execution directory against access scopes.
 */
function resolveExecutionDirectory(options: RunCommandOptions): string {
  const wsRoot = options.workspaceRoot || process.cwd();
  const rawCwd = options.cwd || wsRoot;

  try {
    const res = resolveScopedPath({
      rawPath: rawCwd,
      workspaceRoot: wsRoot,
      allowRoot: true,
      mode: "read",
      scope: options.scope || "workspace_only",
      allowedFolders: options.allowedFolders || [],
      overrideHardBlocked: options.overrideHardBlocked || false,
      toolName: "run_command",
      actionName: "cwd_check",
    });
    return res.resolvedPath;
  } catch {
    return path.resolve(wsRoot);
  }
}

/**
 * Runs a command synchronously with bounded timeout, output truncation, and audit logging.
 */
export async function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  const command = (options.command || "").trim();
  if (!command) {
    throw new Error("Command argument cannot be empty.");
  }

  // Check command permission rule
  const match = matchCommandRule(command, options.customRules);
  if (match.action === "deny") {
    recordAuditLog({
      tool: "run_command",
      command,
      action: "execute",
      scope: options.scope || "workspace_only",
      decision: "denied",
      reason: match.reason,
    });
    throw new Error(`Command blocked by security policy: ${match.reason}`);
  }

  const effectiveCwd = resolveExecutionDirectory(options);
  const shell = options.shell || "powershell";
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxChars = options.maxOutputChars ?? 20000;

  const { file, args } = resolveShellCommand(command, shell);
  const startTime = Date.now();

  return new Promise<RunCommandResult>((resolve, reject) => {
    let stdoutData = "";
    let stderrData = "";
    let isSettled = false;
    let timer: NodeJS.Timeout | null = null;

    const child = spawn(file, args, {
      cwd: effectiveCwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
    });

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        cleanup();
        try {
          child.kill("SIGKILL");
        } catch {}
        reject(new Error("Command aborted by signal."));
      });
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!isSettled) {
          cleanup();
          try {
            child.kill("SIGKILL");
          } catch {}
          const timeoutErr = new Error(`Command timed out after ${timeoutMs}ms.`);
          reject(timeoutErr);
        }
      }, timeoutMs);
    }

    const cleanup = () => {
      isSettled = true;
      if (timer) clearTimeout(timer);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutData += chunk.toString("utf-8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrData += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      cleanup();
      recordAuditLog({
        tool: "run_command",
        command,
        path: effectiveCwd,
        action: "execute",
        scope: options.scope || "workspace_only",
        decision: "denied",
        reason: `Spawn error: ${err.message}`,
      });
      reject(err);
    });

    child.on("close", (code) => {
      cleanup();
      const durationMs = Date.now() - startTime;
      const totalChars = stdoutData.length + stderrData.length;
      let truncated = false;
      let spillPath: string | undefined;

      if (totalChars > maxChars) {
        truncated = true;
        const spillDir = getSpillDirectory();
        const taskId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        spillPath = path.join(spillDir, `${taskId}.log`);
        try {
          fs.writeFileSync(
            spillPath,
            `=== COMMAND: ${command}\n=== CWD: ${effectiveCwd}\n=== DURATION: ${durationMs}ms\n\n--- STDOUT ---\n${stdoutData}\n\n--- STDERR ---\n${stderrData}\n`,
            "utf-8"
          );
        } catch {}

        stdoutData = stdoutData.slice(0, maxChars) + `\n\n[Output truncated: full log saved to ${spillPath}]`;
      }

      recordAuditLog({
        tool: "run_command",
        command,
        path: effectiveCwd,
        action: `exit_code: ${code}`,
        scope: options.scope || "workspace_only",
        decision: code === 0 ? "allowed" : "allowed",
        reason: `Executed in ${durationMs}ms with shell ${shell}`,
      });

      resolve({
        stdout: stdoutData,
        stderr: stderrData,
        exitCode: code ?? 0,
        durationMs,
        truncated,
        spillPath,
        command,
        cwd: effectiveCwd,
      });
    });
  });
}

/**
 * Starts a background process (long-running job).
 */
export function startBackgroundProcess(options: RunCommandOptions): { taskId: string; message: string } {
  const command = (options.command || "").trim();
  if (!command) {
    throw new Error("Command argument cannot be empty.");
  }

  const match = matchCommandRule(command, options.customRules);
  if (match.action === "deny") {
    throw new Error(`Command blocked by security policy: ${match.reason}`);
  }

  const effectiveCwd = resolveExecutionDirectory(options);
  const shell = options.shell || "powershell";
  const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const spillDir = getSpillDirectory();
  const spillPath = path.join(spillDir, `${taskId}.log`);

  const { file, args } = resolveShellCommand(command, shell);
  const child = spawn(file, args, {
    cwd: effectiveCwd,
    env: { ...process.env, ...options.env },
    windowsHide: true,
  });

  const info: BackgroundProcessInfo = {
    taskId,
    command,
    cwd: effectiveCwd,
    shell,
    startTime: Date.now(),
    status: "running",
    exitCode: null,
    outputBuffer: [],
    spillPath,
    process: child,
  };

  const appendOutput = (text: string) => {
    info.outputBuffer.push(text);
    if (info.outputBuffer.length > 500) {
      info.outputBuffer.shift();
    }
    try {
      fs.appendFileSync(spillPath, text, "utf-8");
    } catch {}
  };

  child.stdout?.on("data", (chunk: Buffer) => appendOutput(chunk.toString("utf-8")));
  child.stderr?.on("data", (chunk: Buffer) => appendOutput(chunk.toString("utf-8")));

  child.on("close", (code) => {
    info.status = code === 0 ? "completed" : "failed";
    info.exitCode = code;
    info.process = undefined;
    recordAuditLog({
      tool: "start_background",
      command,
      path: effectiveCwd,
      action: `bg_finished: ${code}`,
      scope: options.scope || "workspace_only",
      decision: "allowed",
    });
  });

  child.on("error", (err) => {
    info.status = "failed";
    info.process = undefined;
    appendOutput(`\n[Process error: ${err.message}]\n`);
  });

  backgroundRegistry.set(taskId, info);

  recordAuditLog({
    tool: "start_background",
    command,
    path: effectiveCwd,
    action: `bg_spawned: ${taskId}`,
    scope: options.scope || "workspace_only",
    decision: "allowed",
  });

  return { taskId, message: `Background task started with ID: ${taskId}` };
}

/**
 * Reads output and status of a background process.
 */
export function readBackgroundProcessOutput(taskId: string, limit: number = 100): {
  taskId: string;
  status: string;
  exitCode: number | null;
  output: string;
  spillPath: string;
} {
  const info = backgroundRegistry.get(taskId);
  if (!info) {
    throw new Error(`Background task not found: ${taskId}`);
  }

  const slice = info.outputBuffer.slice(-limit).join("");
  return {
    taskId: info.taskId,
    status: info.status,
    exitCode: info.exitCode,
    output: slice,
    spillPath: info.spillPath,
  };
}

/**
 * Stops/kills a background process.
 */
export function stopBackgroundProcess(taskId: string): { taskId: string; stopped: boolean } {
  const info = backgroundRegistry.get(taskId);
  if (!info) {
    throw new Error(`Background task not found: ${taskId}`);
  }

  if (info.process) {
    try {
      info.process.kill("SIGKILL");
    } catch {}
  }
  info.status = "terminated";
  info.process = undefined;

  recordAuditLog({
    tool: "stop_background",
    command: info.command,
    action: `bg_stopped: ${taskId}`,
    scope: "global",
    decision: "allowed",
  });

  return { taskId, stopped: true };
}

/**
 * Lists all active or recent background processes.
 */
export function listBackgroundProcesses(): Omit<BackgroundProcessInfo, "process" | "outputBuffer">[] {
  return Array.from(backgroundRegistry.values()).map((p) => ({
    taskId: p.taskId,
    command: p.command,
    cwd: p.cwd,
    shell: p.shell,
    startTime: p.startTime,
    status: p.status,
    exitCode: p.exitCode,
    spillPath: p.spillPath,
  }));
}
