"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

export function WorkspaceTools() {
  const { toolsEnabled, setToolsEnabled, thinkEnabled, setThinkEnabled, activeTracker } = useAppStore();
  const [root, setRoot] = useState("");
  const [undoBusy, setUndoBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetch("/api/workspace")
        .then((r) => (r.ok ? r.json() : null))
        .then((w) => {
          if (live) setRoot(w?.root || "");
        })
        .catch(() => {});
    void refresh();
    const bridge = (window as any).chrome?.webview;
    const listener = (e: any) => {
      if (e.data?.type === "toolWorkspaceChanged") void refresh();
    };
    bridge?.addEventListener("message", listener);
    return () => {
      live = false;
      bridge?.removeEventListener("message", listener);
    };
  }, []);

  const handleUndoTrash = async () => {
    if (undoBusy || activeTracker) return;
    setUndoBusy(true);
    try {
      const wsRes = await fetch("/api/workspace");
      const ws = wsRes.ok ? await wsRes.json() : { id: "default" };
      const res = await fetchWithApproval("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "workspace_files",
          workspaceId: ws.id,
          arguments: { action: "undo", path: "." },
        }),
      }, "undo_last_action");
      const data = await res.json();
      if (res.ok && data.restored) {
        toast.success(`Restored ${data.restored} from tool-trash`);
      } else {
        toast.error(data.error || "Nothing in tool-trash to undo");
      }
    } catch {
      toast.error("Could not undo last file action");
    } finally {
      setUndoBusy(false);
    }
  };

  if (!root) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 text-xs" data-no-drag>
      <button
        type="button"
        aria-pressed={toolsEnabled}
        disabled={!!activeTracker}
        onClick={() => setToolsEnabled(!toolsEnabled)}
        className="rounded border px-2 py-1 font-medium whitespace-nowrap shrink-0"
      >
        Tools {toolsEnabled ? "on" : "off"}
      </button>
      <button
        type="button"
        aria-pressed={Boolean(thinkEnabled)}
        disabled={!!activeTracker}
        onClick={() => setThinkEnabled?.(!thinkEnabled)}
        className="rounded border px-2 py-1 whitespace-nowrap shrink-0"
        title="Toggle model reasoning step"
      >
        Reasoning {thinkEnabled ? "on" : "off"}
      </button>
      <span className="min-w-[80px] flex-1 truncate text-muted-foreground" title={root}>
        {root}
      </span>
      {toolsEnabled && (
        <button
          type="button"
          disabled={!!activeTracker || undoBusy}
          onClick={handleUndoTrash}
          className="rounded border px-2 py-1 text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
          title="Restore most recently trashed file from tool-trash"
        >
          Undo trash
        </button>
      )}
      <button
        type="button"
        disabled={!!activeTracker}
        onClick={() =>
          (window as any).chrome?.webview?.postMessage(
            JSON.stringify({ type: "selectToolWorkspace" })
          )
        }
        className="rounded border px-2 py-1 whitespace-nowrap shrink-0"
      >
        Choose folder
      </button>
      {toolsEnabled && (
        <span
          title="Read, search, create, edit, move, trash, and remember facts in this folder. Tool-capable model required."
          className="text-muted-foreground whitespace-nowrap"
        >
          File access enabled
        </span>
      )}
    </div>
  );
}
