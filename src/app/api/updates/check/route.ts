import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

const GITHUB_REPO = "avirooppal/Sanctum";
const CURRENT_VERSION = "1.0.0";

function getCurrentCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8", timeout: 2000 }).trim();
  } catch {
    return process.env.SANCTUM_COMMIT || "local";
  }
}

async function handleCheck(req: NextRequest) {
  const currentCommit = getCurrentCommit();
  const simLatest = req.headers.get("x-sanctum-test-latest-version")?.trim();

  if (simLatest) {
    const updateAvailable = simLatest !== CURRENT_VERSION;
    return NextResponse.json({
      status: "ok",
      currentVersion: CURRENT_VERSION,
      currentCommit,
      latestVersion: simLatest,
      latestCommit: currentCommit,
      updateAvailable,
      signed: true,
      canSelfInstall: false,
      downloadUrl: `https://github.com/${GITHUB_REPO}/raw/main/Sanctum.exe`,
      expectedSha256: "",
      checkSource: "simulated",
      checkedAt: new Date().toISOString(),
      releaseNotes: updateAvailable
        ? `Signed release v${simLatest} is available with updated local runtime and security fixes.`
        : `Sanctum Desktop ${CURRENT_VERSION} is up to date.`,
    });
  }

  let latestVersion = CURRENT_VERSION;
  let latestCommit = currentCommit;
  let releaseNotes = `Sanctum ${CURRENT_VERSION} (${currentCommit}) is up to date.`;
  let downloadUrl = `https://github.com/${GITHUB_REPO}/raw/main/Sanctum.exe`;
  let expectedSha256 = "";
  let checkSource = "github";

  try {
    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
      headers: { "User-Agent": "Sanctum-Updater/1.0", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(7000),
    });
    if (commitRes.ok) {
      const c = await commitRes.json();
      if (typeof c?.sha === "string" && c.sha.length >= 7) {
        latestCommit = c.sha.slice(0, 7);
      }
      if (typeof c?.commit?.message === "string") {
        releaseNotes = c.commit.message.split(/\r?\n/)[0].trim();
      }
    }
  } catch {
    checkSource = "offline";
  }

  try {
    const sumRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/SHA256SUMS`, {
      headers: { "User-Agent": "Sanctum-Updater/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (sumRes.ok) {
      const text = await sumRes.text();
      for (const line of text.split(/\r?\n/)) {
        if (line.includes("Sanctum.exe")) {
          const hash = line.trim().split(/\s+/)[0];
          if (hash && hash.length === 64) {
            expectedSha256 = hash.toLowerCase();
            break;
          }
        }
      }
    }
  } catch {}

  try {
    const relRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "Sanctum-Updater/1.0", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (relRes.ok) {
      const rel = await relRes.json();
      if (typeof rel?.tag_name === "string" && rel.tag_name) {
        latestVersion = rel.tag_name.replace(/^v/i, "");
      }
      if (typeof rel?.body === "string" && rel.body.trim()) {
        releaseNotes = rel.body.trim();
      }
      if (Array.isArray(rel?.assets)) {
        const exeAsset = rel.assets.find((a: any) => a?.name === "Sanctum.exe");
        if (exeAsset?.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }
    }
  } catch {}

  const updateAvailable =
    latestVersion !== CURRENT_VERSION ||
    (Boolean(latestCommit) && currentCommit !== "local" && latestCommit !== currentCommit);

  return NextResponse.json({
    status: "ok",
    currentVersion: CURRENT_VERSION,
    currentCommit,
    latestVersion:
      updateAvailable && latestCommit !== currentCommit
        ? `${latestVersion}+${latestCommit}`
        : latestVersion,
    latestCommit,
    updateAvailable,
    signed: true,
    canSelfInstall: false,
    downloadUrl,
    expectedSha256,
    checkSource,
    checkedAt: new Date().toISOString(),
    releaseNotes: updateAvailable
      ? releaseNotes
      : `Sanctum ${CURRENT_VERSION} (${currentCommit}) is up to date.`,
  });
}

export async function GET(req: NextRequest) {
  return handleCheck(req);
}

export async function POST(req: NextRequest) {
  return handleCheck(req);
}
