"use client";
import { useEffect, useState } from "react";
import { JanAppShell } from "@/components/jan/JanAppShell";
export function DesktopApp() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => { setDesktop(!!(window as any).chrome?.webview); }, []);
  if (desktop === null) return <main className="p-8">Opening Sanctum…</main>;
  if (!desktop) return <main className="p-8"><h1>Sanctum for Windows</h1><p>Open Sanctum.exe to use this application.</p></main>;
  return <JanAppShell />;
}
