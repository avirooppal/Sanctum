import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeWorkspaceToolCall } from "../core/ai/tools/workspace_chat.ts";

const ROOT = process.cwd();

function extractMethodBody(source: string, methodSignature: string): string {
  const idx = source.indexOf(methodSignature);
  assert.notEqual(idx, -1, `Method not found: ${methodSignature}`);
  const startBrace = source.indexOf("{", idx);
  assert.notEqual(startBrace, -1);
  let depth = 0;
  for (let i = startBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(startBrace, i + 1);
    }
  }
  throw new Error(`Unbalanced braces for ${methodSignature}`);
}

describe("Hotfix: Host-Side Approval Gates on /api/mcp, /api/mcp/call, and /api/memory", () => {
  test("DesktopHost HandleMcp POST requires ConsumeApprovalToken(..., 'mcp_config') and fails closed with 403", () => {
    const src = fs.readFileSync(path.join(ROOT, "tools", "native", "DesktopHost.cs"), "utf-8");
    const body = extractMethodBody(src, "private void HandleMcp(");
    assert.match(body, /ConsumeApprovalToken\(\s*req\.Headers\["X-Sanctum-Approval"\]\s*,\s*"mcp_config"\s*\)/);
    assert.match(body, /WriteJson\(\s*res\s*,\s*403\b/);
    assert.match(body, /RecordAuditLog\(\s*"mcp_config"/);
  });

  test("DesktopMcpEndpoints HandleMcpCall requires ConsumeApprovalToken(..., 'mcp_call') and fails closed with 403", () => {
    const src = fs.readFileSync(path.join(ROOT, "tools", "native", "DesktopMcpEndpoints.cs"), "utf-8");
    const body = extractMethodBody(src, "private void HandleMcpCall(");
    assert.match(body, /ConsumeApprovalToken\(\s*req\.Headers\["X-Sanctum-Approval"\]\s*,\s*"mcp_call"\s*\)/);
    assert.match(body, /WriteJson\(\s*res\s*,\s*403\b/);
    assert.match(body, /RecordAuditLog\(\s*"mcp_call"/);
  });

  test("DesktopHost HandleMemory POST & DELETE require ConsumeApprovalToken(..., 'memory_write') and fail closed with 403", () => {
    const src = fs.readFileSync(path.join(ROOT, "tools", "native", "DesktopHost.cs"), "utf-8");
    const body = extractMethodBody(src, "private void HandleMemory(");
    const matches = body.match(/ConsumeApprovalToken\(\s*req\.Headers\["X-Sanctum-Approval"\]\s*,\s*"memory_write"\s*\)/g) || [];
    assert.ok(matches.length >= 2, `Expected memory_write approval check on both POST and DELETE, found ${matches.length}`);
    assert.match(body, /WriteJson\(\s*res\s*,\s*403\b/);
    assert.match(body, /RecordAuditLog\(\s*"memory_write"/);
  });

  test("workspace_chat MCP execution sends X-Sanctum-Approval header obtained via getApprovalToken('mcp_call')", async () => {
    const origFetch = globalThis.fetch;
    let capturedHeader: string | null = null;
    globalThis.fetch = async (url, init) => {
      if (url === "/api/mcp/call") {
        const hdrs = new Headers(init?.headers);
        capturedHeader = hdrs.get("X-Sanctum-Approval");
        return Response.json({ ok: true, text: "event list" });
      }
      return Response.json({});
    };

    try {
      const mcpMap = new Map([
        [
          "mcp__gcal__list_events",
          {
            serverId: "gcal",
            serverName: "Google Calendar",
            toolName: "list_events",
            qualifiedName: "mcp__gcal__list_events",
            description: "List events",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      ]);
      const res = await executeWorkspaceToolCall(
        { name: "mcp__gcal__list_events", arguments: {} },
        { root: ".", id: "ws-1" },
        new AbortController().signal,
        () => {},
        {
          externalMcpTools: mcpMap,
          getApprovalToken: async (tool) => (tool === "mcp_call" ? "tok-single-use-123" : undefined),
        }
      );
      assert.equal(res.ok, true);
      assert.equal(capturedHeader, "tok-single-use-123");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
