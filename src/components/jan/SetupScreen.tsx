"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

type Setup = { phase: string; detail: string; busy: boolean; percent: number | null; model: string };
export const SetupScreen = ({ onComplete }: { onComplete?: (destination?: "chat" | "hub") => void }) => {
  const [setup, setSetup] = useState<Setup>({ phase: "idle", detail: "", busy: false, percent: null, model: "" });
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const { initModels, setActiveModelId, completeOnboarding } = useAppStore();
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch("/api/setup", { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error("Cannot reach desktop setup. Restart Sanctum to retry.");
        const value = await response.json();
        if (live) { setSetup(value); setError(""); }
      } catch (e) { if (live) setError(e instanceof Error ? e.message : "Setup unavailable"); }
      if (live) timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => { live = false; clearTimeout(timer); };
  }, []);
  const start = async () => {
    setStarting(true); setError("");
    try {
      const response = await fetch("/api/setup/start", { method: "POST" });
      if (!response.ok) throw new Error("Could not start setup. Restart Sanctum and retry.");
      setSetup(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Setup failed"); }
    finally { setStarting(false); }
  };
  const finish = async () => {
    await initModels();
    if (!useAppStore.getState().models.some(m => m.id === setup.model)) { setError("The verified model is no longer available. Retry setup."); return; }
    setActiveModelId(setup.model); completeOnboarding(); onComplete?.("chat");
  };
  const ready = setup.phase === "ready";
  return <div className="flex flex-1 items-center justify-center bg-background p-8">
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 space-y-6">
      <img src="/logo.jpg" alt="Sanctum logo" width={64} height={64} className="rounded-xl" />
      <p className="text-xs text-muted-foreground" data-testid="setup-step-counter">{ready ? "Step 3 of 3" : setup.phase === "idle" ? "Step 1 of 3" : "Step 2 of 3"}</p>
      <h1 className="text-2xl font-semibold">{ready ? "Sanctum is ready" : setup.phase === "idle" ? "Welcome to Sanctum" : "Setting up your local AI"}</h1>
      {setup.phase === "idle" ? <p className="text-sm text-muted-foreground">Sanctum will install or start the local AI runtime, download a first chat model if needed, and test a response. No terminal or separate app setup is needed. First-time downloads require internet and several GB of free space. Windows may ask for installation permission.</p>
        : <p role="status" className="text-sm text-muted-foreground">{setup.detail}</p>}
      {setup.busy && <div className="space-y-2"><progress className="w-full" max={100} value={setup.percent ?? undefined} aria-label="Setup progress" /><p className="text-xs text-muted-foreground">{setup.percent == null ? "Working… Keep Sanctum open." : `${Math.round(setup.percent)}% of current download`}</p></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {ready ? <><p className="text-sm">Verified model: <strong>{setup.model}</strong></p><Button onClick={finish} className="w-full">Start chatting</Button></>
        : setup.busy ? <Button variant="outline" onClick={async () => { await fetch("/api/setup/cancel", { method: "POST" }); }}>Stop setup</Button>
        : <Button onClick={start} disabled={starting} className="w-full">{setup.phase === "idle" ? "Set up Sanctum" : "Retry setup"}</Button>}
      <button className="text-xs underline text-muted-foreground" onClick={() => (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: "openLogs" }))}>Open setup logs</button>
    </div>
  </div>;
};
