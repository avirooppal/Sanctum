/**
 * Sanctum External MCP (Model Context Protocol) Client Manager
 * Zero-dependency JSON-RPC 2.0 client supporting stdio & Streamable HTTP/SSE MCP servers.
 * Turns Sanctum into an extensible agent harness for Google Calendar, Gmail, GitHub,
 * Notion, Slack, Postgres, and any custom local or remote MCP tool server.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type McpTransportType = "stdio" | "http" | "sse";

export interface McpServerConfig {
  id: string;
  name: string;
  type: McpTransportType;
  command?: string;
  args?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  description?: string;
  category?: string;
  presetId?: string;
}

export interface McpDiscoveredTool {
  serverId: string;
  serverName: string;
  toolName: string;
  qualifiedName: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface McpConnectorPreset {
  id: string;
  name: string;
  category: "Google Workspace" | "Productivity" | "Developer" | "Data & Web" | "Custom";
  description: string;
  type: McpTransportType;
  command?: string;
  args?: string;
  url?: string;
  envHints?: { key: string; label: string; placeholder: string; secret?: boolean }[];
  headerHints?: { key: string; label: string; placeholder: string; secret?: boolean }[];
  docsHint?: string;
}

export const MCP_CONNECTOR_PRESETS: McpConnectorPreset[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Google Workspace",
    description: "List, search, create, update, and delete Google Calendar events and check availability.",
    type: "stdio",
    command: "npx",
    args: "-y @cocal/google-calendar-mcp",
    envHints: [
      {
        key: "GOOGLE_OAUTH_CREDENTIALS",
        label: "Google OAuth Credentials JSON Path",
        placeholder: "C:\\Users\\you\\gcp-oauth.keys.json",
      },
    ],
    docsHint: "Requires a Google Cloud Desktop OAuth JSON file. First run opens browser OAuth consent.",
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "Google Workspace",
    description: "Search, read, draft, label, and send emails directly from Sanctum.",
    type: "stdio",
    command: "npx",
    args: "-y @gongrzhe/server-gmail-autoauth-mcp",
    docsHint: "Place gcp-oauth.keys.json in ~/.gmail-mcp/ and run once to authorize.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Google Workspace",
    description: "Search and read files and docs from your Google Drive.",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-gdrive",
    envHints: [
      {
        key: "GDRIVE_CREDENTIALS_PATH",
        label: "Drive Credentials Path",
        placeholder: "C:\\Users\\you\\.gdrive-server-credentials.json",
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    category: "Developer",
    description: "Manage repositories, issues, pull requests, branches, and code search.",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    envHints: [
      {
        key: "GITHUB_PERSONAL_ACCESS_TOKEN",
        label: "GitHub Personal Access Token",
        placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
        secret: true,
      },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    category: "Productivity",
    description: "Search, read, create, and update Notion pages and databases.",
    type: "stdio",
    command: "npx",
    args: "-y @notionhq/notion-mcp-server",
    envHints: [
      {
        key: "NOTION_TOKEN",
        label: "Notion Integration Token",
        placeholder: "ntn_xxxxxxxxxxxxxxxxxxxx",
        secret: true,
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    category: "Productivity",
    description: "List channels, read threads, search messages, and post updates to Slack.",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-slack",
    envHints: [
      { key: "SLACK_BOT_TOKEN", label: "Slack Bot Token", placeholder: "xoxb-...", secret: true },
      { key: "SLACK_TEAM_ID", label: "Slack Team ID", placeholder: "T01234567" },
    ],
  },
  {
    id: "filesystem",
    name: "Filesystem (MCP)",
    category: "Developer",
    description: "Expose a directory via the standard MCP Filesystem server.",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem <workspace>",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "Data & Web",
    description: "Inspect database schemas and execute read-only SQL queries.",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/mydb",
  },
  {
    id: "remote-http",
    name: "Remote MCP Server (HTTP / SSE)",
    category: "Custom",
    description: "Connect any hosted MCP URL (Zapier MCP, Composio, Linear, Cloudflare, custom API).",
    type: "http",
    url: "https://mcp.example.com/mcp",
    headerHints: [
      {
        key: "Authorization",
        label: "Authorization Header (optional)",
        placeholder: "Bearer your-api-token",
        secret: true,
      },
    ],
  },
];

export function sanitizeToolSegment(raw: string): string {
  return String(raw || "tool")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "tool";
}

export function buildQualifiedMcpToolName(serverId: string, toolName: string): string {
  return `mcp__${sanitizeToolSegment(serverId)}__${sanitizeToolSegment(toolName)}`;
}

export function splitArgsString(argsStr: string, workspaceRoot?: string): string[] {
  const replaced = (argsStr || "").replaceAll(
    "<workspace>",
    workspaceRoot || process.cwd()
  );
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < replaced.length; i++) {
    const ch = replaced[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        out.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

export function getMcpConfigFile(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "mcp_servers.json");
}

export function readMcpServersConfig(): McpServerConfig[] {
  try {
    const file = getMcpConfigFile();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeMcpServersConfig(servers: McpServerConfig[]): void {
  const file = getMcpConfigFile();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(servers, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

interface PendingRpc {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class StdioMcpConnection {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, PendingRpc>();
  private initialized = false;
  private stderrTail = "";
  private readonly server: McpServerConfig;
  private readonly workspaceRoot?: string;
  public readonly configFingerprint: string;

  constructor(server: McpServerConfig, workspaceRoot?: string) {
    this.server = server;
    this.workspaceRoot = workspaceRoot;
    this.configFingerprint = JSON.stringify({
      command: server.command,
      args: server.args,
      env: server.env,
      workspaceRoot,
    });
  }

  public isAlive(): boolean {
    return Boolean(this.proc && !this.proc.killed && this.proc.exitCode === null);
  }

  private rejectAll(reason: string): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  public async ensureConnected(timeoutMs = 20000): Promise<any> {
    if (this.initialized && this.isAlive()) return { ok: true };
    this.close();

    const command = (this.server.command || "").trim();
    if (!command) throw new Error(`MCP server "${this.server.name}" has no command configured`);

    const args = splitArgsString(this.server.args || "", this.workspaceRoot);
    const useShell =
      process.platform === "win32" &&
      /^(npx|npm|pnpm|yarn|uvx|uv|bunx|cmd)$/i.test(path.basename(command));

    const mergedEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...(this.server.env || {}),
    };

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: mergedEnv,
      shell: useShell,
      windowsHide: true,
    });
    this.proc = child;
    this.buffer = "";
    this.stderrTail = "";

    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (typeof msg.id === "number" && this.pending.has(msg.id)) {
            const entry = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            clearTimeout(entry.timer);
            if (msg.error) {
              entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              entry.resolve(msg.result);
            }
          }
        } catch {
          // Ignore non-JSON log lines emitted on stdout by noisy servers
        }
      }
    });

    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-1200);
    });

    child.on("error", (err) => {
      this.initialized = false;
      this.rejectAll(`Failed to launch "${command}": ${err.message}`);
    });

    child.on("close", (code) => {
      this.initialized = false;
      const detail = this.stderrTail.trim() ? ` — ${this.stderrTail.trim().slice(-300)}` : "";
      this.rejectAll(`MCP process "${this.server.name}" exited (code ${code})${detail}`);
    });

    const initResult = await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "Sanctum", version: "1.0.0" },
      },
      timeoutMs
    );

    this.notify("notifications/initialized", {});
    this.initialized = true;
    return initResult;
  }

  public notify(method: string, params: Record<string, any> = {}): void {
    if (!this.proc || !this.proc.stdin.writable) return;
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    try {
      this.proc.stdin.write(payload);
    } catch {}
  }

  public request(method: string, params: Record<string, any> = {}, timeoutMs = 25000): Promise<any> {
    if (!this.proc || !this.proc.stdin.writable) {
      return Promise.reject(new Error(`MCP server "${this.server.name}" is not running`));
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc!.stdin.write(payload);
      } catch (err: any) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  public close(): void {
    this.initialized = false;
    this.rejectAll("MCP connection closed");
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {}
      this.proc = null;
    }
  }
}

async function httpJsonRpc(
  server: McpServerConfig,
  method: string,
  params: Record<string, any>,
  sessionId?: string,
  timeoutMs = 20000
): Promise<{ result: any; sessionId?: string }> {
  const url = (server.url || "").trim();
  if (!url) throw new Error(`Remote MCP server "${server.name}" has no URL configured`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(server.headers || {}),
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const isNotification = method.startsWith("notifications/");
  const body = isNotification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: Date.now(), method, params };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const nextSessionId = res.headers.get("mcp-session-id") || sessionId;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}: ${errText.slice(0, 240)}`);
  }

  if (isNotification || res.status === 202 || res.status === 204) {
    return { result: {}, sessionId: nextSessionId };
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  if (contentType.includes("text/event-stream") || rawText.trimStart().startsWith("event:") || rawText.trimStart().startsWith("data:")) {
    const dataLines = rawText
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(dataLines[i]);
        if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
        if (msg.result !== undefined) return { result: msg.result, sessionId: nextSessionId };
      } catch (e) {
        if (i === 0) throw e;
      }
    }
    throw new Error("Remote MCP SSE stream returned no JSON-RPC result");
  }

  const parsed = JSON.parse(rawText || "{}");
  if (parsed.error) {
    throw new Error(parsed.error.message || JSON.stringify(parsed.error));
  }
  return { result: parsed.result, sessionId: nextSessionId };
}

class McpClientManager {
  private stdioPool = new Map<string, StdioMcpConnection>();
  private httpSessions = new Map<string, string>();
  private toolsCache = new Map<string, { fetchedAt: number; tools: McpDiscoveredTool[] }>();
  private static readonly CACHE_TTL_MS = 60_000;

  private getStdioConnection(server: McpServerConfig, workspaceRoot?: string): StdioMcpConnection {
    const existing = this.stdioPool.get(server.id);
    const desired = new StdioMcpConnection(server, workspaceRoot);
    if (existing && existing.configFingerprint === desired.configFingerprint && existing.isAlive()) {
      return existing;
    }
    if (existing) existing.close();
    this.stdioPool.set(server.id, desired);
    return desired;
  }

  public invalidateServer(serverId: string): void {
    const conn = this.stdioPool.get(serverId);
    if (conn) {
      conn.close();
      this.stdioPool.delete(serverId);
    }
    this.httpSessions.delete(serverId);
    this.toolsCache.delete(serverId);
  }

  public invalidateAll(): void {
    for (const [, conn] of this.stdioPool) conn.close();
    this.stdioPool.clear();
    this.httpSessions.clear();
    this.toolsCache.clear();
  }

  public async listToolsForServer(
    server: McpServerConfig,
    workspaceRoot?: string,
    forceRefresh = false
  ): Promise<McpDiscoveredTool[]> {
    if (!forceRefresh) {
      const cached = this.toolsCache.get(server.id);
      if (cached && Date.now() - cached.fetchedAt < McpClientManager.CACHE_TTL_MS) {
        return cached.tools;
      }
    }

    let rawTools: any[] = [];
    if (server.type === "stdio") {
      const conn = this.getStdioConnection(server, workspaceRoot);
      await conn.ensureConnected();
      const res = await conn.request("tools/list", {});
      rawTools = Array.isArray(res?.tools) ? res.tools : [];
    } else {
      const init = await httpJsonRpc(server, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "Sanctum", version: "1.0.0" },
      });
      if (init.sessionId) this.httpSessions.set(server.id, init.sessionId);
      await httpJsonRpc(server, "notifications/initialized", {}, init.sessionId).catch(() => {});
      const res = await httpJsonRpc(server, "tools/list", {}, init.sessionId);
      rawTools = Array.isArray(res.result?.tools) ? res.result.tools : [];
    }

    const discovered: McpDiscoveredTool[] = rawTools.map((t: any) => ({
      serverId: server.id,
      serverName: server.name,
      toolName: String(t.name || ""),
      qualifiedName: buildQualifiedMcpToolName(server.id, String(t.name || "")),
      description: String(t.description || `External MCP tool "${t.name}" from ${server.name}`),
      inputSchema:
        t.inputSchema && typeof t.inputSchema === "object"
          ? t.inputSchema
          : { type: "object", properties: {} },
    }));

    this.toolsCache.set(server.id, { fetchedAt: Date.now(), tools: discovered });
    return discovered;
  }

  public async listAllEnabledTools(
    workspaceRoot?: string,
    forceRefresh = false
  ): Promise<{ tools: McpDiscoveredTool[]; errors: { serverId: string; serverName: string; error: string }[] }> {
    const servers = readMcpServersConfig().filter((s) => s.enabled);
    const tools: McpDiscoveredTool[] = [];
    const errors: { serverId: string; serverName: string; error: string }[] = [];

    await Promise.all(
      servers.map(async (server) => {
        try {
          const found = await this.listToolsForServer(server, workspaceRoot, forceRefresh);
          tools.push(...found);
        } catch (err: any) {
          errors.push({
            serverId: server.id,
            serverName: server.name,
            error: err?.message || "Failed to connect to MCP server",
          });
        }
      })
    );

    return { tools, errors };
  }

  public async testServerConnection(
    server: McpServerConfig,
    workspaceRoot?: string
  ): Promise<{
    ok: boolean;
    latencyMs: number;
    tools: McpDiscoveredTool[];
    error?: string;
  }> {
    const t0 = Date.now();
    this.invalidateServer(server.id);
    try {
      const tools = await this.listToolsForServer(server, workspaceRoot, true);
      return { ok: true, latencyMs: Date.now() - t0, tools };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        tools: [],
        error: err?.message || "Connection failed",
      };
    }
  }

  public async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>,
    workspaceRoot?: string
  ): Promise<{ ok: boolean; text: string; raw: any; isError?: boolean }> {
    const servers = readMcpServersConfig();
    const server = servers.find((s) => s.id === serverId);
    if (!server) {
      throw new Error(`MCP server "${serverId}" not found in configuration`);
    }
    if (!server.enabled) {
      throw new Error(`MCP server "${server.name}" is disabled`);
    }

    let rawResult: any;
    if (server.type === "stdio") {
      const conn = this.getStdioConnection(server, workspaceRoot);
      await conn.ensureConnected();
      rawResult = await conn.request("tools/call", {
        name: toolName,
        arguments: args || {},
      });
    } else {
      let sid = this.httpSessions.get(server.id);
      if (!sid) {
        const init = await httpJsonRpc(server, "initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "Sanctum", version: "1.0.0" },
        });
        sid = init.sessionId;
        if (sid) this.httpSessions.set(server.id, sid);
        await httpJsonRpc(server, "notifications/initialized", {}, sid).catch(() => {});
      }
      const res = await httpJsonRpc(
        server,
        "tools/call",
        { name: toolName, arguments: args || {} },
        sid
      );
      rawResult = res.result;
    }

    const contentBlocks = Array.isArray(rawResult?.content) ? rawResult.content : [];
    const textParts = contentBlocks.map((block: any) => {
      if (block?.type === "text" && typeof block.text === "string") return block.text;
      return JSON.stringify(block);
    });
    const text = textParts.length > 0 ? textParts.join("\n") : JSON.stringify(rawResult ?? {});
    const isError = Boolean(rawResult?.isError);
    return { ok: !isError, text, raw: rawResult, isError };
  }
}

const globalForMcp = globalThis as unknown as { __sanctumMcpManager?: McpClientManager };
export const mcpClientManager =
  globalForMcp.__sanctumMcpManager ?? (globalForMcp.__sanctumMcpManager = new McpClientManager());
