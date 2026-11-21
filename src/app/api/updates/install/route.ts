import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const downloadUrl =
    typeof body?.downloadUrl === "string" &&
    body.downloadUrl.startsWith("https://github.com/avirooppal/Sanctum/")
      ? body.downloadUrl
      : "https://github.com/avirooppal/Sanctum/raw/main/Sanctum.exe";

  return NextResponse.json({
    status: "manual_download",
    downloadUrl,
    message: "Self-install is handled natively in Sanctum.exe. Download the latest executable from GitHub.",
  });
}
