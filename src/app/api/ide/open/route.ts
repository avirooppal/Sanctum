import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { matchCommandRule } from "@core/infra/security/command_matcher.ts";
import { resolveFsTarget } from "../../fs/_shared";
import { detectInstalledIdes } from "../detect/route";

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
