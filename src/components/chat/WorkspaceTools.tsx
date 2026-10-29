"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function WorkspaceTools() {
  const { toolsEnabled, setToolsEnabled, activeTracker } = useAppStore();
  const [root, setRoot] = useState("");
  useEffect(() => {
    let live = true;
    const refresh = () => fetch("/api/workspace").then(r => r.ok ? r.json() : null).then(w => { if (live) setRoot(w?.root || ""); }).catch(() => {});
    void refresh();
    const bridge = (window as any).chrome?.webview;
    const listener = (e: any) => { if (e.data?.type === "toolWorkspaceChanged") void refresh(); };
    bridge?.addEventListener("message", listener);
    return () => { live = false; bridge?.removeEventListener("message", listener); };
  }, []);
  if (!root) return null;
  return <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs" data-no-drag>
    <button type="button" aria-pressed={toolsEnabled} disabled={!!activeTracker} onClick={() => setToolsEnabled(!toolsEnabled)} className="rounded border px-2 py-1 font-medium">Tools {toolsEnabled ? "on" : "off"}</button>
    <span className="min-w-0 flex-1 truncate text-muted-foreground" title={root}>{root}</span>
    <button type="button" disabled={!!activeTracker} onClick={() => (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: "selectToolWorkspace" }))} className="rounded border px-2 py-1">Choose folder</button>
    {toolsEnabled && <span title="Read, create, edit, move, and trash files in this folder. Tool-capable model required." className="text-muted-foreground">File access enabled</span>}
  </div>;
}
