import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  validateBrowserNavigationUrl,
  requiresExplicitBrowserActionApproval,
  wrapUntrustedWebContent,
  BROWSER_PROMPT_INJECTION_SYSTEM_RULE,
  type DomainPermission,
} from "@core/infra/security/browser_policy.ts";
import { getSanctumDataDir } from "@core/infra/security/audit_logger.ts";
import { resolveFsTarget } from "../../fs/_shared.ts";

const domainPermissions: Record<string, DomainPermission> = {};
const allowedLocalhostPorts = new Set<number>();

let sessionStatus: "idle" | "running" | "paused" | "takeover" = "idle";
let currentUrl = "about:blank";
let currentTitle = "New Browser Tab";
let latestScreenshot = "";
let visibleText = "";
let elements: any[] = [];
let forms: any[] = [];
let steps: any[] = [];

function detectSystemBrowser() {
  const progX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const prog = process.env["ProgramFiles"] || "C:\\Program Files";
  const edgePaths = [
    path.join(progX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(prog, "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) return { channel: "msedge", executablePath: p };
  }
  const chromePaths = [
    path.join(prog, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(progX86, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return { channel: "chrome", executablePath: p };
  }
  return { channel: "chromium", executablePath: null };
}

function buildStatusSnapshot() {
  const dataDir = getSanctumDataDir();
  const packDir = path.join(dataDir, "packs", "browser-agent");
  const profileDir = path.join(dataDir, "browser-profile");
  const markerFile = path.join(packDir, "installed.json");
  const installed = fs.existsSync(markerFile);

  return {
    pack: {
      id: "sanctum.agents.browser-use",
      name: "Browser Agent Pack (browser-use)",
      version: "1.0.0",
      upstream: "https://github.com/browser-use/browser-use",
      license: "MIT",
      installed,
      venvDir: path.join(packDir, "venv"),
      profileDir,
      detectedBrowser: detectSystemBrowser(),
      diskSizeBytes: installed ? 4096 : 0,
      telemetryDisabled: true,
      anonymizedTelemetry: false,
      cloudSync: false,
      telemetryEventsSent: 0,
    },
    session: {
      status: sessionStatus,
      url: currentUrl,
      title: currentTitle,
      screenshot: latestScreenshot,
      elements,
      forms,
      steps,
    },
    policy: {
      domainPermissions: { ...domainPermissions },
      allowedLocalhostPorts: Array.from(allowedLocalhostPorts),
      useVisionDefault: "auto",
      systemRule: BROWSER_PROMPT_INJECTION_SYSTEM_RULE,
    },
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (slug === "status") {
    return NextResponse.json(buildStatusSnapshot());
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await req.json().catch(() => ({}));
  const approval = req.headers.get("x-sanctum-approval");

  if (slug === "pack") {
    if (!approval) {
      return NextResponse.json({ error: "User approval token required." }, { status: 403 });
    }
    const dataDir = getSanctumDataDir();
    const packDir = path.join(dataDir, "packs", "browser-agent");
    const profileDir = path.join(dataDir, "browser-profile");
    const action = body.action || "install";

    if (action === "install") {
      fs.mkdirSync(path.join(packDir, "venv"), { recursive: true });
      fs.mkdirSync(profileDir, { recursive: true });
      fs.writeFileSync(
        path.join(packDir, "installed.json"),
        JSON.stringify({
          packId: "sanctum.agents.browser-use",
          version: "1.0.0",
          installedAt: new Date().toISOString(),
          anonymizedTelemetry: false,
          cloudSync: false,
        }),
        "utf8"
      );
    } else if (action === "uninstall") {
      fs.rmSync(packDir, { recursive: true, force: true });
      fs.rmSync(profileDir, { recursive: true, force: true });
    } else if (action === "clear_profile") {
      fs.rmSync(profileDir, { recursive: true, force: true });
      fs.mkdirSync(profileDir, { recursive: true });
    }
    return NextResponse.json(buildStatusSnapshot());
  }

  if (slug === "domain") {
    if (!approval) {
      return NextResponse.json({ error: "User approval token required." }, { status: 403 });
    }
    if (body.domain && body.permission) {
      const dom = String(body.domain).toLowerCase().trim();
      if (body.permission === "remove") {
        delete domainPermissions[dom];
      } else {
        domainPermissions[dom] = body.permission as DomainPermission;
      }
    }
    if (Array.isArray(body.allowedLocalhostPorts)) {
      allowedLocalhostPorts.clear();
      for (const p of body.allowedLocalhostPorts) {
        const n = Number(p);
        if (n > 0 && n <= 65535 && n !== 1337 && n !== 11434) {
          allowedLocalhostPorts.add(n);
        }
      }
    }
    return NextResponse.json(buildStatusSnapshot());
  }

  if (slug === "control") {
    const cmd = String(body.command || "").toLowerCase();
    if (cmd === "pause" || cmd === "takeover" || cmd === "resume") {
      sessionStatus = cmd === "resume" ? "running" : (cmd as "paused" | "takeover");
    } else if (cmd === "stop") {
      sessionStatus = "idle";
    }
    steps.push({
      step: steps.length + 1,
      thought: `User triggered browser control: ${cmd}`,
      action: `control:${cmd}`,
      url: currentUrl,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(buildStatusSnapshot());
  }

  if (slug === "action") {
    const tool = String(body.tool || body.action || "").toLowerCase();
    const simDns = req.headers.get("x-sanctum-test-dns-resolve");

    if (tool === "browser_open" || tool === "open") {
      const check = await validateBrowserNavigationUrl(String(body.url || ""), {
        hostPort: 1337,
        enginePort: 11434,
        allowedLocalhostPorts: Array.from(allowedLocalhostPorts),
        domainPermissions,
        customResolver: simDns ? async () => [simDns] : undefined,
      });
      if (!check.allowed) {
        return NextResponse.json(
          {
            error: check.reason,
            code: check.code,
            domain: check.domain,
            requiresDomainApproval: check.requiresDomainApproval,
          },
          { status: 403 }
        );
      }
      if (check.domain && domainPermissions[check.domain] === "allow_once") {
        delete domainPermissions[check.domain];
      }
      currentUrl = check.normalizedUrl || String(body.url);
      sessionStatus = "running";
      return NextResponse.json({
        status: "ok",
        url: currentUrl,
        title: currentTitle,
        screenshot: latestScreenshot,
        elements,
        untrustedContent: wrapUntrustedWebContent(currentUrl, visibleText),
        systemRule: BROWSER_PROMPT_INJECTION_SYSTEM_RULE,
      });
    }

    if (tool === "browser_submit" || tool === "submit_form") {
      const gate = requiresExplicitBrowserActionApproval({ action: "submit_form", method: "POST" });
      if (gate.required && !approval) {
        return NextResponse.json({ error: gate.reason, code: "APPROVAL_REQUIRED", requiresApproval: true }, { status: 403 });
      }
      return NextResponse.json({
        status: "submitted",
        url: currentUrl,
        untrustedContent: wrapUntrustedWebContent(currentUrl, visibleText),
        systemRule: BROWSER_PROMPT_INJECTION_SYSTEM_RULE,
      });
    }

    if (tool === "browser_download" || tool === "download") {
      if (!approval) {
        return NextResponse.json({ error: "Approval required", code: "APPROVAL_REQUIRED" }, { status: 403 });
      }
      try {
        const dest = resolveFsTarget(
          path.join("downloads", path.basename(String(body.filename || "download.bin"))),
          false,
          "write",
          "browser_download"
        );
        return NextResponse.json({ status: "downloaded", path: `downloads/${path.basename(dest.target)}` });
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Invalid download path" }, { status: 403 });
      }
    }

    return NextResponse.json({
      status: "ok",
      url: currentUrl,
      title: currentTitle,
      screenshot: latestScreenshot,
      elements,
      steps,
      untrustedContent: wrapUntrustedWebContent(currentUrl, visibleText),
      systemRule: BROWSER_PROMPT_INJECTION_SYSTEM_RULE,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
