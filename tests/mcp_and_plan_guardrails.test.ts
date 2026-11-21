import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MCP_CONNECTOR_PRESETS,
  buildQualifiedMcpToolName,
  splitArgsString,
  mcpClientManager,
  type McpServerConfig,
} from "../core/ai/mcp/client_manager.ts";
import { executeWorkspaceToolCall } from "../core/ai/tools/workspace_chat.ts";

describe("MCP Harness & Plan Mode Guardrails", () => {
  test("connector catalog includes Google Calendar, Gmail, GitHub, and Remote HTTP", () => {
    const ids = MCP_CONNECTOR_PRESETS.map((p) => p.id);
    assert.ok(ids.includes("google-calendar"));
    assert.ok(ids.includes("gmail"));
    assert.ok(ids.includes("github"));
    assert.ok(ids.includes("notion"));
    assert.ok(ids.includes("slack"));
    assert.ok(ids.includes("remote-http"));
  });

  test("qualified tool naming and arg splitting handle quotes and <workspace>", () => {
    assert.equal(
      buildQualifiedMcpToolName("google-calendar", "list-events"),
      "mcp__google-calendar__list-events"
    );
    const args = splitArgsString('-y @modelcontextprotocol/server-filesystem "<workspace>"', "C:\\Users\\demo\\proj");
    assert.deepEqual(args, ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\demo\\proj"]);
  });

  test("stdio MCP JSON-RPC client completes initialize + tools/list handshake", async () => {
    const mockScript = `
      const rl = require('readline').createInterface({ input: process.stdin });
      rl.on('line', (line) => {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mock-gcal', version: '1.0.0' } } }) + '\\n');
        } else if (msg.method === 'tools/list') {
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'list_events', description: 'List upcoming calendar events', inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } } }] } }) + '\\n');
        }
      });
    `;

    const server: McpServerConfig = {
      id: "mock-gcal",
      name: "Mock Google Calendar",
      type: "stdio",
      command: process.execPath,
      args: `-e "${mockScript.replace(/\s+/g, " ").replace(/"/g, '\\"')}"`,
      enabled: true,
    };

    const res = await mcpClientManager.testServerConnection(server);
    mcpClientManager.invalidateServer(server.id);

    assert.equal(res.ok, true, res.error || "Expected mock MCP server to connect");
    assert.equal(res.tools.length, 1);
    assert.equal(res.tools[0].toolName, "list_events");
    assert.equal(res.tools[0].qualifiedName, "mcp__mock-gcal__list_events");
  });

  test("Plan Mode blocks creating non-PLAN.md files before user approval", async () => {
    const res = await executeWorkspaceToolCall(
      { name: "create_file", arguments: { path: "dashboard.html", content: "<h1>Hi</h1>" } },
      { root: ".", id: "test-ws" },
      new AbortController().signal,
      () => {},
      { planMode: true }
    );
    assert.equal(res.ok, false);
    assert.equal(res.result?.planModeBlocked, true);
    assert.match(res.output, /Plan Mode is active/);
  });
});
