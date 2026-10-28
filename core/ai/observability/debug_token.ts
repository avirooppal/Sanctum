/**
 * Debug Token Manager (ADR 0105 §4).
 * Generates and persists a per-process 32-char hex token in <dataDir>/debug_token.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let cachedToken: string | null = null;

export function getDebugTokenPath(): string {
  const appData = process.env.APPDATA || path.resolve(process.cwd(), ".sanctum");
  const dir = path.join(appData, "Sanctum");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, "debug_token");
}

export function getOrCreateDebugToken(): string {
  if (cachedToken) return cachedToken;

  const tokenPath = getDebugTokenPath();
  try {
    if (fs.existsSync(tokenPath)) {
      const existing = fs.readFileSync(tokenPath, "utf-8").trim();
      if (existing && existing.length === 32) {
        cachedToken = existing;
        return cachedToken;
      }
    }
  } catch {}

  const newToken = crypto.randomBytes(16).toString("hex");
  try {
    fs.writeFileSync(tokenPath, newToken, { encoding: "utf-8", mode: 0o600 });
  } catch {}

  cachedToken = newToken;
  return cachedToken;
}

export function resetDebugTokenForProcess(): string {
  cachedToken = null;
  return getOrCreateDebugToken();
}
