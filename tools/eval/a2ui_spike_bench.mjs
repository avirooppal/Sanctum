/**
 * Phase 3b-1 Throwaway Spike Benchmark:
 * Compares 3 A2UI production approaches on real local Ollama models (127.0.0.1:11434):
 *   (a) Delimited A2UI JSON blocks in text stream
 *   (b) render_ui tool with schema-validated arguments
 *   (c) Ollama structured output (format: <json_schema>)
 */
const OLLAMA = "http://127.0.0.1:11434";
const MODELS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["smollm2:135m", "qwen3:1.7b", "qwen3:4b"];

const ALLOWED_COMPONENTS = new Set([
  "Column", "Row", "Card", "Text", "Button", "TextField", "Checkbox", "Select",
  "Table", "FileCard", "DiffSummary", "TodoList", "CodeBlock", "Citations", "TerminalOutput"
]);

const PROMPTS = [
  "Show a 2-row comparison table of SQLite vs Postgres (columns: Feature, SQLite, Postgres) with a 1-sentence text summary.",
  "Render a small form with a TextField for 'Project Name' and a Submit Button.",
  "Show a TodoList with 2 tasks: 'Run tests' (done) and 'Build exe' (pending).",
  "Show a FileCard for 'README.md' with a 1-sentence summary."
];

const A2UI_SCHEMA = {
  type: "object",
  required: ["summaryText", "surfaceId", "components"],
  properties: {
    summaryText: { type: "string" },
    surfaceId: { type: "string" },
    components: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "type", "props"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: Array.from(ALLOWED_COMPONENTS) },
          props: { type: "object" }
        }
      }
    }
  }
};

function validateA2uiPayload(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "not_object" };
  if (typeof obj.surfaceId !== "string" || !obj.surfaceId.trim()) return { ok: false, reason: "missing_surfaceId" };
  if (!Array.isArray(obj.components) || obj.components.length === 0) return { ok: false, reason: "empty_components" };
  if (obj.components.length > 50) return { ok: false, reason: "too_many_components" };
  for (const c of obj.components) {
    if (!c || typeof c !== "object") return { ok: false, reason: "invalid_component" };
    if (typeof c.id !== "string" || !c.id) return { ok: false, reason: "missing_component_id" };
    if (!ALLOWED_COMPONENTS.has(c.type)) return { ok: false, reason: `unknown_component:${c.type}` };
    if (!c.props || typeof c.props !== "object") return { ok: false, reason: "missing_props" };
  }
  return { ok: true };
}

async function callOllama(body) {
  const t0 = performance.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, options: { ...(body.options || {}), num_predict: 256 } }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json();
  const ms = Math.round(performance.now() - t0);
  return { data, ms, ok: res.ok };
}

async function runApproachA(model, prompt) {
  const sys = `You output a 1-sentence text summary followed by a delimited A2UI JSON block:
<<<A2UI>>>
{"summaryText":"...","surfaceId":"s1","components":[{"id":"c1","type":"Table|TextField|Button|TodoList|FileCard|CodeBlock|DiffSummary|Column|Text","props":{}}]}
<<<END_A2UI>>>
Use ONLY these component types: ${Array.from(ALLOWED_COMPONENTS).join(", ")}.`;
  const { data, ms } = await callOllama({
    model,
    stream: false,
    think: false,
    options: { num_ctx: 4096, temperature: 0.1 },
    messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
  });
  const text = data?.message?.content || "";
  const m = text.match(/<<<A2UI>>>([\s\S]*?)<<<END_A2UI>>>/);
  if (!m) return { valid: false, ms, reason: "missing_delimiters" };
  try {
    const parsed = JSON.parse(m[1].trim());
    const v = validateA2uiPayload(parsed);
    return { valid: v.ok, ms, reason: v.reason || "ok" };
  } catch {
    return { valid: false, ms, reason: "json_parse_error" };
  }
}

async function runApproachB(model, prompt) {
  const { data, ms } = await callOllama({
    model,
    stream: false,
    think: false,
    options: { num_ctx: 4096, temperature: 0.1 },
    messages: [
      { role: "system", content: "Always call the render_ui tool to display the requested UI along with a 1-sentence summaryText." },
      { role: "user", content: prompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "render_ui",
          description: "Render a structured A2UI surface using allowed native Sanctum components.",
          parameters: A2UI_SCHEMA,
        },
      },
    ],
  });
  const calls = data?.message?.tool_calls || [];
  const call = calls.find((c) => c?.function?.name === "render_ui");
  if (!call) return { valid: false, ms, reason: "no_tool_call" };
  const args = typeof call.function.arguments === "string"
    ? (() => { try { return JSON.parse(call.function.arguments); } catch { return null; } })()
    : call.function.arguments;
  const v = validateA2uiPayload(args);
  return { valid: v.ok, ms, reason: v.reason || "ok" };
}

async function runApproachC(model, prompt) {
  const { data, ms } = await callOllama({
    model,
    stream: false,
    think: false,
    format: A2UI_SCHEMA,
    options: { num_ctx: 4096, temperature: 0.1 },
    messages: [
      { role: "system", content: `Return valid JSON matching the schema. Allowed component types: ${Array.from(ALLOWED_COMPONENTS).join(", ")}.` },
      { role: "user", content: prompt },
    ],
  });
  const text = data?.message?.content || "";
  try {
    const parsed = JSON.parse(text.trim());
    const v = validateA2uiPayload(parsed);
    return { valid: v.ok, ms, reason: v.reason || "ok" };
  } catch {
    return { valid: false, ms, reason: "json_parse_error" };
  }
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const results = [];
for (const model of MODELS) {
  for (const [label, fn] of [
    ["A_delimited", runApproachA],
    ["B_render_ui_tool", runApproachB],
    ["C_structured_output", runApproachC],
  ]) {
    let validCount = 0;
    const latencies = [];
    const failures = {};
    for (const p of PROMPTS) {
      try {
        const r = await fn(model, p);
        latencies.push(r.ms);
        if (r.valid) validCount++;
        else failures[r.reason] = (failures[r.reason] || 0) + 1;
      } catch (e) {
        failures["exception"] = (failures["exception"] || 0) + 1;
      }
    }
    const row = {
      model,
      approach: label,
      valid: validCount,
      total: PROMPTS.length,
      validityPct: Math.round((validCount / PROMPTS.length) * 100),
      medianLatencyMs: median(latencies),
      failures,
    };
    results.push(row);
    console.error(`[bench] ${model} | ${label}: ${validCount}/${PROMPTS.length} (${row.validityPct}%) median=${row.medianLatencyMs}ms failures=${JSON.stringify(failures)}`);
  }
}

console.log(JSON.stringify(results, null, 2));
