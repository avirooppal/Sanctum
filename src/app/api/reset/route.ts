import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { defaultSettingsStore } from "../../../../core/infra/storage/settings_store.ts";

function getSanctumDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), ".sanctum");
  return path.join(appData, "Sanctum");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deleteModels = Boolean(body?.deleteModels);
    const deleteWorkspace = body?.deleteWorkspace !== false;

    defaultSettingsStore.resetAll();

    const dataDir = getSanctumDataDir();
    if (fs.existsSync(dataDir)) {
      const jsonFiles = [
        "settings.json",
        "threads.json",
        "profiles.json",
        "memory.json",
        "mcp_servers.json",
        "download_ledger.json",
        "window_state.json",
        "tool_workspace.txt",
        "tool_workspace_id.txt",
      ];
      for (const f of jsonFiles) {
        const target = path.join(dataDir, f);
        try {
          if (fs.existsSync(target)) fs.unlinkSync(target);
        } catch {}
      }

      const subDirs = ["logs", "tool-trash"];
      if (deleteWorkspace) subDirs.push("workspace");
      if (deleteModels) subDirs.push("models");

      for (const dirName of subDirs) {
        const targetDir = path.join(dataDir, dirName);
        try {
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        } catch {}
      }

      // Recreate clean baseline directories and empty JSON state files
      fs.mkdirSync(path.join(dataDir, "workspace"), { recursive: true });
      fs.mkdirSync(path.join(dataDir, "models"), { recursive: true });
      fs.writeFileSync(path.join(dataDir, "threads.json"), "[]", "utf-8");
      fs.writeFileSync(path.join(dataDir, "profiles.json"), "[]", "utf-8");
      fs.writeFileSync(path.join(dataDir, "settings.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(dataDir, "download_ledger.json"), "[]", "utf-8");
    }

    return NextResponse.json({
      status: "reset_complete",
      deletedModels: deleteModels,
      deletedWorkspace: deleteWorkspace,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
