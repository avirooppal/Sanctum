import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getWorkspaceAndScope } from "../../fs/_shared";

export function detectInstalledIdes() {
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

export async function GET() {
  const ws = getWorkspaceAndScope();
  const ides = detectInstalledIdes();
  return NextResponse.json({
    ides,
    preferred: ides[0]?.id || "explorer",
    workspace: ws.root,
  });
}
