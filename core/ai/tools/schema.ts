/**
 * Tool Schema & Call Parsing Engine (ADR 0105 / Pipeline P8).
 * Defines tool definitions, JSON schema validation, and model call parsing.
 */

export interface ToolPropertyDef {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolPropertyDef>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  permissionLevel: "always_ask" | "auto_allow" | "deny";
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

export function validateToolArguments(
  tool: ToolDefinition,
  args: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { valid: false, errors: ["Tool arguments must be a JSON object"] };
  }

  // Check required properties
  const required = tool.parameters.required || [];
  for (const req of required) {
    if (!(req in args) || args[req] === undefined || args[req] === null) {
      errors.push(`Missing required parameter: '${req}'`);
    }
  }

  // Check types and enums
  for (const [key, value] of Object.entries(args)) {
    const propDef = tool.parameters.properties[key];
    if (!propDef) {
      // Unknown parameter
      continue;
    }

    const valType = typeof value;
    if (propDef.type === "string" && valType !== "string") {
      errors.push(`Parameter '${key}' must be a string, got ${valType}`);
    } else if (propDef.type === "number" && valType !== "number") {
      errors.push(`Parameter '${key}' must be a number, got ${valType}`);
    } else if (propDef.type === "boolean" && valType !== "boolean") {
      errors.push(`Parameter '${key}' must be a boolean, got ${valType}`);
    }

    if (propDef.enum && !propDef.enum.includes(String(value))) {
      errors.push(`Parameter '${key}' value '${value}' is not in allowed enum [${propDef.enum.join(", ")}]`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseModelToolCall(raw: {
  id?: string;
  function?: { name?: string; arguments?: string | Record<string, any> };
  name?: string;
  arguments?: string | Record<string, any>;
}): ToolCallRequest {
  const id = raw.id || `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const name = raw.function?.name || raw.name;
  if (!name || typeof name !== "string") {
    throw new ToolValidationError("Malformed tool call: missing function name");
  }

  const rawArgs = raw.function?.arguments ?? raw.arguments ?? {};
  let parsedArgs: Record<string, any> = {};

  if (typeof rawArgs === "string") {
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch (e: any) {
      throw new ToolValidationError(`Malformed tool call arguments: JSON parse error (${e.message})`);
    }
  } else if (typeof rawArgs === "object" && rawArgs !== null) {
    parsedArgs = rawArgs;
  } else {
    throw new ToolValidationError("Malformed tool call arguments: must be string or object");
  }

  return { id, name, arguments: parsedArgs };
}

export function formatToolForEngine(tool: ToolDefinition): any {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    },
  };
}
