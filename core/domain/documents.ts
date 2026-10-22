/**
 * Pure Domain Entities & Logic: Ingested Documents (Core Domain)
 */

import type { IngestedDocument } from "../../contracts/types/index.ts";

export function determineDocumentType(filename: string): IngestedDocument["type"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  if (/\.(ts|tsx|js|jsx|py|rs|go|cpp|c|html|css|java|kt|rb)$/.test(lower)) return "code";
  return "txt";
}
