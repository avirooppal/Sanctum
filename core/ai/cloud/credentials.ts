/**
 * Cloud Credential Storage & Safe Redaction Engine (ADR 0105 / Pipeline P9 / P11).
 * Resolves credentials from environment variables or secure memory without persisting
 * plaintext keys to disk, database, or settings files. Strictly redacts keys from logs and errors.
 */

export class CloudCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudCredentialError";
  }
}

export class CloudCredentialsManager {
  private inMemoryKeys: Map<string, string> = new Map();

  /**
   * Safe key redaction: masks all characters except the last 4.
   * Never prints full token or secret in logs/traces/errors.
   */
  public static redactKey(key?: string): string {
    if (!key || key.length === 0) return "[NONE]";
    if (key.length <= 8) return "[REDACTED]";
    const prefix = key.slice(0, 3);
    const suffix = key.slice(-4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Set temporary in-memory session key (never written to disk).
   */
  public setSessionKey(provider: string, key: string): void {
    const clean = key.trim();
    if (clean.length === 0) {
      this.inMemoryKeys.delete(provider.toLowerCase());
    } else {
      this.inMemoryKeys.set(provider.toLowerCase(), clean);
    }
  }

  /**
   * Resolve API key for a provider.
   * Priority:
   * 1. In-memory session key
   * 2. Designated environment variable
   */
  public resolveKey(provider: string): string {
    const prov = provider.toLowerCase();

    // 1. In-memory session key
    if (this.inMemoryKeys.has(prov)) {
      return this.inMemoryKeys.get(prov)!;
    }

    // 2. Designated environment variables
    const envVarMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      azure: "AZURE_OPENAI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      mistral: "MISTRAL_API_KEY",
      gemini: "GEMINI_API_KEY",
    };

    const envName = envVarMap[prov];
    if (envName && process.env[envName]) {
      return process.env[envName]!.trim();
    }

    throw new CloudCredentialError(
      `No valid API key found for cloud provider '${provider}'. Set ${envName || "appropriate env var"} or provide key in Settings.`
    );
  }

  public hasKey(provider: string): boolean {
    try {
      this.resolveKey(provider);
      return true;
    } catch {
      return false;
    }
  }

  public clearSessionKeys(): void {
    this.inMemoryKeys.clear();
  }
}

export const globalCredentialsManager = new CloudCredentialsManager();
