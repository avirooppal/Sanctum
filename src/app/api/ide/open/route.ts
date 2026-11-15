import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { matchCommandRule } from "@core/infra/security/command_matcher.ts";
import { resolveFsTarget } from "../../fs/_shared";

function detectInstalledIdes() {
  const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const progFiles = process.env.ProgramFiles || "C:\\Program Files";

  const candidates = [
    {
      id: "vscode",
      name: "VS Code",
      command: "code",
      paths: [
        path.join(localApp, "Programs", "Microsoft VS Code", "Code.exe"),
        path.join(progFiles, "Microsoft VS Code", "Code.exe"),
      ],
    },
    {
      id: "cursor",
      name: "Cursor",
      command: "cursor",
      paths: [
        path.join(localApp, "Programs", "cursor", "Cursor.exe"),
        path.join(localApp, "cursor", "Cursor.exe"),
      ],
    },
    {
      id: "windsurf",
      name: "Windsurf",
      command: "windsurf",
      paths: [path.join(localApp, "Programs", "Windsurf", "Windsurf.exe")],
    },
  ];

  const ides: { id: string; name: string; command: string; executable: string }[] = [];
  for (const c of candidates) {
    const found = c.paths.find((p) => fs.existsSync(p));
    if (found) {
      ides.push({ id: c.id, name: c.name, command: c.command, executable: found });
    }
  }
  ides.push({
    id: "explorer",
    name: "Windows Explorer",
    command: "explorer",
    executable: path.join(process.env.SystemRoot || "C:\\Windows", "explorer.exe"),
  });
  return ides;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ideId = String(body?.ideId || "");
    const rawPath = String(body?.path || ".");
    const { target } = resolveFsTarget(rawPath, true, "read", "ide_open");

    const ides = detectInstalledIdes();
    const chosen = ides.find((i) => !ideId || i.id.toLowerCase() === ideId.toLowerCase());
    if (!chosen) {
      return NextResponse.json({ error: `Requested IDE is not installed: ${ideId}` }, { status: 404 });
    }

    const rule = matchCommandRule(`${chosen.command} "${target}"`);
    if (rule.action === "deny") {
      return NextResponse.json({ error: rule.reason }, { status: 403 });
    }

    if (req.headers.get("x-sanctum-dry-run") !== "1" && process.platform === "win32") {
      spawn(chosen.executable, [target], { detached: true, stdio: "ignore" }).unref();
    }

    return NextResponse.json({
      status: "launched",
      ide: chosen.id,
      name: chosen.name,
      target,
    });
  } catch (err: any) {
    const status = err?.name === "SecurityPathError" ? 403 : 400;
    return NextResponse.json({ error: err?.message || "Failed to launch IDE" }, { status });
  }
}
