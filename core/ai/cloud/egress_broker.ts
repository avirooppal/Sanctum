/**
 * Consent-Gated Cloud Egress Broker & Network Barrier (ADR 0105 / Pipeline P9 / P11).
 * Strictly controls network egress: blocks all WAN requests by default, enforces explicit
 * host-level user consent, and prevents unconsented cloud calls or document leaks.
 */

export class CloudEgressBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudEgressBlockedError";
  }
}

export interface EgressLedgerEntry {
  timestamp: number;
  url: string;
  host: string;
  action: "allowed" | "blocked";
  reason: string;
  threadId?: string;
}

export class CloudEgressBroker {
  private globalCloudEnabled: boolean = false;
  private consentedHosts: Set<string> = new Set();
  private auditLedger: EgressLedgerEntry[] = [];
  private readonly maxLedgerEntries = 500;

  constructor(initialCloudEnabled: boolean = false) {
    this.globalCloudEnabled = initialCloudEnabled;
  }

  public setGlobalCloudEnabled(enabled: boolean): void {
    this.globalCloudEnabled = enabled;
  }

  public isGlobalCloudEnabled(): boolean {
    return this.globalCloudEnabled;
  }

  public grantHostConsent(host: string): void {
    this.consentedHosts.add(host.toLowerCase());
  }

  public revokeHostConsent(host: string): void {
    this.consentedHosts.delete(host.toLowerCase());
  }

  public clearConsent(): void {
    this.consentedHosts.clear();
  }

  public isHostConsented(host: string): boolean {
    return this.consentedHosts.has(host.toLowerCase());
  }

  /**
   * Evaluates outbound URL against egress policy.
   * Throws CloudEgressBlockedError if request violates policy.
   */
  public assertEgressAllowed(urlStr: string, options?: { threadId?: string; isCloudThread?: boolean }): void {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      throw new CloudEgressBlockedError(`Malformed destination URL: ${urlStr}`);
    }

    const host = url.hostname.toLowerCase();
    const isLoopback =
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".localhost");

    // Localhost / Loopback is always allowed for local engine communication
    if (isLoopback) {
      return;
    }

    // Non-loopback request:
    // 1. Check if global cloud is enabled
    if (!this.globalCloudEnabled) {
      this.recordAudit({
        timestamp: Date.now(),
        url: urlStr,
        host,
        action: "blocked",
        reason: "Global cloud path is disabled in settings (zero-egress policy active)",
        threadId: options?.threadId,
      });
      throw new CloudEgressBlockedError(
        `Cloud egress blocked to '${host}': global cloud path is disabled. Enable in Settings > Providers.`
      );
    }

    // 2. Check if this thread has cloud enabled
    if (options && options.isCloudThread === false) {
      this.recordAudit({
        timestamp: Date.now(),
        url: urlStr,
        host,
        action: "blocked",
        reason: "Thread is configured as local-only; cloud egress prohibited",
        threadId: options?.threadId,
      });
      throw new CloudEgressBlockedError(
        `Cloud egress blocked to '${host}': thread is configured for local model only.`
      );
    }

    // 3. Check if user explicitly consented to this specific host
    if (!this.consentedHosts.has(host)) {
      this.recordAudit({
        timestamp: Date.now(),
        url: urlStr,
        host,
        action: "blocked",
        reason: `Host '${host}' has not received explicit user consent`,
        threadId: options?.threadId,
      });
      throw new CloudEgressBlockedError(
        `Cloud egress blocked: host '${host}' requires explicit user confirmation before connecting.`
      );
    }

    // Egress is valid and consented
    this.recordAudit({
      timestamp: Date.now(),
      url: urlStr,
      host,
      action: "allowed",
      reason: "Egress verified against consented cloud host",
      threadId: options?.threadId,
    });
  }

  private recordAudit(entry: EgressLedgerEntry): void {
    this.auditLedger.push(entry);
    if (this.auditLedger.length > this.maxLedgerEntries) {
      this.auditLedger.shift();
    }
  }

  public getAuditLedger(): readonly EgressLedgerEntry[] {
    return this.auditLedger;
  }

  public clearAuditLedger(): void {
    this.auditLedger = [];
  }
}

export const globalEgressBroker = new CloudEgressBroker(false);
