/**
 * AI Response Formatting & Reasoning Token Parser (Core AI Layer)
 * Extracts chain-of-thought `<think>` blocks and reasoning tokens cleanly.
 */

export interface ParsedThinkingResponse {
  thinking: string;
  answer: string;
}

/**
 * Splits raw model stream output into reasoning trace and user-facing answer.
 */
export function splitThinking(content: string): ParsedThinkingResponse {
  if (!content) {
    return { thinking: "", answer: "" };
  }

  const match = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  return {
    thinking: match ? match[1].trim() : "",
    answer: content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim(),
  };
}
