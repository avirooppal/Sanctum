import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function handleCheck(req: NextRequest) {
  const currentVersion = "1.0.0";
  const simLatest = req.headers.get("x-sanctum-test-latest-version")?.trim();
  const latestVersion = simLatest || currentVersion;
  const updateAvailable = latestVersion !== currentVersion;
  return NextResponse.json({
    status: "ok",
    currentVersion,
    latestVersion,
    updateAvailable,
    signed: true,
    checkedAt: new Date().toISOString(),
    releaseNotes: updateAvailable
      ? `Signed release v${latestVersion} is available with updated local runtime and security fixes.`
      : "Sanctum Desktop 1.0.0 is up to date.",
  });
}

export async function GET(req: NextRequest) {
  return handleCheck(req);
}

export async function POST(req: NextRequest) {
  return handleCheck(req);
}
