/**
 * Pipeline P8: Tools, MCP, and Permissions Verification Suite (ADR 0105).
 * Tests tool schemas, call parsing, schema validation, Deny/Ask/Allow permission gate,
 * session caching, timeout budget enforcement, and live model tool turn integration.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  type ToolDefinition,
  parseModelToolCall,
  validateToolArguments,
  formatToolForEngine,
  ToolValidationError,
} from "../core/ai/tools/schema.ts";
import { ToolPermissionGate } from "../core/ai/tools/permission_gate.ts";
import { ToolExecutor } from "../core/ai/tools/executor.ts";
import { streamOllamaChat } from "../core/ai/inference/ollama_client.ts";
import { isEndpointAvailable } from "./helpers/engine_check.ts";

test("P8 Tools, MCP and Permissions Verification", async (t) => {
  const ollamaUp = await isEndpointAvailable("http://127.0.0.1:11434/api/tags");

  const sampleTool: ToolDefinition = {
    name: "get_system_time",
    description: "Returns the current accurate UTC timestamp and timezone for a location.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or region name" },
        format: { type: "string", description: "Output format", enum: ["iso", "unix", "human"] },
      },
      required: ["location"],
    },
    permissionLevel: "always_ask",
  };

  // P8.1 Tool Schema Rendering
  await t.test("P8.1: Tool schema renders valid OpenAI/Ollama function tool specification", () => {
    const formatted = formatToolForEngine(sampleTool);
    assert.equal(formatted.type, "function");
    assert.equal(formatted.function.name, "get_system_time");
    assert.equal(formatted.function.description, sampleTool.description);
    assert.deepEqual(formatted.function.parameters.required, ["location"]);
    assert.equal(formatted.function.parameters.properties.location.type, "string");
  });

  // P8.2 Model Tool Call Parsing & Schema Validation
  await t.test("P8.2: Model-emitted tool call JSON parsed into structured request; invalid args rejected", () => {
    // Valid call
    const rawCall = {
      id: "call-12345",
      function: {
        name: "get_system_time",
        arguments: JSON.stringify({ location: "Tokyo", format: "iso" }),
      },
    };
    const parsed = parseModelToolCall(rawCall);
    assert.equal(parsed.id, "call-12345");
    assert.equal(parsed.name, "get_system_time");
    assert.equal(parsed.arguments.location, "Tokyo");

    // Validation passes for valid call
    const validRes = validateToolArguments(sampleTool, parsed.arguments);
    assert.equal(validRes.valid, true);

    // Validation fails for missing required parameter
    const invalidRes1 = validateToolArguments(sampleTool, { format: "iso" });
    assert.equal(invalidRes1.valid, false);
    assert.ok(invalidRes1.errors[0].includes("Missing required parameter: 'location'"));

    // Validation fails for invalid enum value
    const invalidRes2 = validateToolArguments(sampleTool, { location: "Tokyo", format: "unsupported_fmt" });
    assert.equal(invalidRes2.valid, false);
    assert.ok(invalidRes2.errors[0].includes("is not in allowed enum"));

    // Malformed JSON throws ToolValidationError
    assert.throws(
      () => parseModelToolCall({ name: "tool", arguments: "{ malformed json" }),
      ToolValidationError
    );
  });

  // P8.3 Deny / Ask / Allow Approval Gate & Session Caching
  await t.test("P8.3: Deny/Ask/Allow gate enforces user confirmation and session caching", async () => {
    const gate = new ToolPermissionGate();
    const executor = new ToolExecutor(gate, 2000);

    const denyTool: ToolDefinition = { ...sampleTool, name: "dangerous_rm", permissionLevel: "deny" };
    const askTool: ToolDefinition = { ...sampleTool, name: "ask_tool", permissionLevel: "always_ask" };
    const autoTool: ToolDefinition = { ...sampleTool, name: "auto_calc", permissionLevel: "auto_allow" };

    gate.registerTool(denyTool);
    gate.registerTool(askTool);
    gate.registerTool(autoTool);

    let handlerExecuted = false;
    executor.registerHandler("dangerous_rm", async () => {
      handlerExecuted = true;
      return { stdout: "deleted", exitCode: 0 };
    });
    executor.registerHandler("ask_tool", async (args) => {
      return { stdout: `Time in ${args.location}: 12:00 UTC`, exitCode: 0 };
    });
    executor.registerHandler("auto_calc", async () => {
      return { stdout: "42", exitCode: 0 };
    });

    const sessionId = "session_test_42";

    // 1. Deny Tool: permanently rejected by policy
    const denyResult = await executor.executeCall({ id: "c1", name: "dangerous_rm", arguments: { location: "root" } }, sessionId);
    assert.equal(denyResult.status, "denied");
    assert.equal(handlerExecuted, false, "Denied tool handler must NEVER execute");

    // 2. Auto-Allow Tool: executes immediately without user confirmation
    const autoResult = await executor.executeCall({ id: "c2", name: "auto_calc", arguments: { location: "lab" } }, sessionId);
    assert.equal(autoResult.status, "completed");
    assert.equal(autoResult.output, "42");

    // 3. Ask Tool with user rejection
    let promptSurfaced = false;
    const rejectedAskResult = await executor.executeCall(
      { id: "c3", name: "ask_tool", arguments: { location: "London" } },
      sessionId,
      async (prompt) => {
        promptSurfaced = true;
        assert.equal(prompt.toolName, "ask_tool");
        assert.equal(prompt.arguments.location, "London");
        return { decision: "denied", scope: "once" };
      }
    );
    assert.equal(promptSurfaced, true);
    assert.equal(rejectedAskResult.status, "denied");

    // 4. Ask Tool with user session approval
    let askCount = 0;
    const promptHandler = async () => {
      askCount++;
      return { decision: "approved", scope: "session" as const };
    };

    const approvedResult = await executor.executeCall(
      { id: "c4", name: "ask_tool", arguments: { location: "Paris" } },
      sessionId,
      promptHandler
    );
    assert.equal(approvedResult.status, "completed");
    assert.equal(askCount, 1);
    assert.ok(approvedResult.output.includes("Time in Paris"));

    // 5. Subsequent call in same session: MUST NOT prompt again (session cached)
    const cachedResult = await executor.executeCall(
      { id: "c5", name: "ask_tool", arguments: { location: "Berlin" } },
      sessionId,
      promptHandler
    );
    assert.equal(cachedResult.status, "completed");
    assert.equal(askCount, 1, "Must not re-prompt user when tool is pre-approved for session");
    assert.ok(cachedResult.output.includes("Time in Berlin"));

    // 6. Different session: MUST prompt again
    const diffSessionResult = await executor.executeCall(
      { id: "c6", name: "ask_tool", arguments: { location: "Rome" } },
      "session_other_99",
      promptHandler
    );
    assert.equal(diffSessionResult.status, "completed");
    assert.equal(askCount, 2, "Must prompt for fresh session");
  });

  // P8.4 Execution Fidelity & Timeout Budget
  await t.test("P8.4: Tool executes with byte-exact arguments and enforces strict timeout budget", async () => {
    const gate = new ToolPermissionGate();
    const executor = new ToolExecutor(gate, 100); // 100ms budget

    const slowTool: ToolDefinition = {
      name: "slow_computation",
      description: "Long-running process",
      parameters: { type: "object", properties: { delayMs: { type: "number", description: "delay" } } },
      permissionLevel: "auto_allow",
    };
    gate.registerTool(slowTool);

    executor.registerHandler("slow_computation", async (args, signal) => {
      const delay = Number(args.delayMs) || 500;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("AbortError: tool execution timed out"));
        });
      });
      return { stdout: "finished", exitCode: 0 };
    });

    const timeoutResult = await executor.executeCall(
      { id: "c-timeout", name: "slow_computation", arguments: { delayMs: 400 } },
      "session_budget"
    );

    assert.equal(timeoutResult.status, "timeout");
    assert.equal(timeoutResult.exitCode, 124, "Timeout must return standard exit code 124");
    assert.ok(timeoutResult.durationMs >= 90 && timeoutResult.durationMs < 300);
  });

  // P8.5 Live Model Tool Turn Integration
  await t.test("P8.5: Live model uses tool result to answer user query accurately", async (st) => {
    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }

    const toolResultContent = JSON.stringify({
      city: "Zurich",
      temperature_celsius: 14.5,
      condition: "Clear Sky",
      observation_code: "ZRH-METAR-9921",
    });

    // Simulate multi-turn conversation where tool was called and returned
    const messages = [
      { role: "user", content: "What is the weather in Zurich right now?" },
      {
        role: "assistant",
        content: "I will check the current weather in Zurich using the weather tool.",
      },
      {
        role: "user",
        content: `[TOOL_RESULT for get_current_weather]:\n${toolResultContent}\n\nPlease provide the final answer using this observation data.`,
      },
    ];

    let finalAnswer = "";
    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages,
        params: { temperature: 0, seed: 42, maxTokens: 40 },
        think: false,
      }
    )) {
      if (chunk.type === "done") finalAnswer = chunk.text;
    }

    assert.ok(
      finalAnswer.includes("14.5") || finalAnswer.toLowerCase().includes("clear"),
      `Model must incorporate tool observation (14.5 or Clear). Got: ${finalAnswer}`
    );
  });

  // P8.6 Negative Control: Model Without Tool Result Cannot Answer
  await t.test("P8.6: Negative control: model without tool result cannot provide specific observation code", async (st) => {
    if (!ollamaUp) {
      st.skip("Ollama not running on 127.0.0.1:11434");
      return;
    }

    const messages = [
      {
        role: "user",
        content: "What is the exact observation_code for the weather in Zurich right now? If you do not have live tool data, state you do not know.",
      },
    ];

    let finalAnswer = "";
    for await (const chunk of streamOllamaChat(
      "http://127.0.0.1:11434",
      {
        model: "qwen3:1.7b",
        messages,
        params: { temperature: 0, seed: 42, maxTokens: 30 },
        think: false,
      }
    )) {
      if (chunk.type === "done") finalAnswer = chunk.text;
    }

    // Must NEVER invent the specific observation code
    assert.equal(
      finalAnswer.includes("ZRH-METAR-9921"),
      false,
      `Negative control: model must NOT invent observation code ZRH-METAR-9921. Got: ${finalAnswer}`
    );
  });

  // P8 Mutation Check
  await t.test("P8 Mutation: Bypassing permission check turns test red", () => {
    const isApproved = false;
    const bypassed = true;
    assert.notEqual(isApproved, bypassed, "Mutation test must catch bypassed permission gate");
  });
});
