"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IconShieldLock,
  IconWifiOff,
  IconBell,
  IconEyeOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FeedPreset {
  id: string;
  name: string;
  startUrl: string;
  allowedHosts: string[];
  builtin: boolean;
}

interface FeedStatus {
  enabled: boolean;
  effectiveEnabled: boolean;
  offlineBlocked: boolean;
  consentAccepted: boolean;
  activePresetId: string;
  activePreset: FeedPreset | null;
  inPrivateMode: boolean;
  presets: FeedPreset[];
}

interface AttentionReason {
  id: string;
  trigger: string;
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  summary: string;
}

interface AttentionState {
  state: "Off" | "Active" | "PausedAttention" | "PausedByUser" | "Suspended";
  suspendReason: string;
  reasons: AttentionReason[];
  wellbeing: {
    showTimer: boolean;
    reminderMinutes: number;
    dailyCapMinutes: number;
    todayActiveMinutes: number;
    capReached: boolean;
  };
}

function postFeedControl(payload: Record<string, unknown>) {
  try {
    (window as any).chrome?.webview?.postMessage(
      JSON.stringify({ type: "feedControl", ...payload })
    );
  } catch {
    // non-WebView2 dev mode
  }
}

export const FeedPaneTab: React.FC = () => {
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [attention, setAttention] = useState<AttentionState | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [inPrivateChoice, setInPrivateChoice] = useState(false);
  const [airspaceOccluded, setAirspaceOccluded] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch("/v1/feed/status"),
        fetch("/v1/feed/attention"),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (aRes.ok) setAttention(await aRes.json());
    } catch {
      // daemon not attached
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onStatusChanged = () => void refresh();
    window.addEventListener("sanctum:feed-status-changed", onStatusChanged);
    const t = setInterval(() => void refresh(), 2500);
    return () => {
      clearInterval(t);
      window.removeEventListener("sanctum:feed-status-changed", onStatusChanged);
    };
  }, [refresh]);

  // Open/close native WebView2 feed control with slot lifecycle
  useEffect(() => {
    if (status?.effectiveEnabled && attention?.state === "Active" && !airspaceOccluded) {
      postFeedControl({ action: "open", url: status.activePreset?.startUrl || "" });
    } else if (status?.enabled && attention && attention.state !== "Active") {
      postFeedControl({ action: "pause" });
    }
    return () => {
      postFeedControl({ action: "close" });
    };
  }, [status?.effectiveEnabled, status?.activePreset?.startUrl, attention?.state, airspaceOccluded, status?.enabled]);

  // Report DPI-scaled slot rectangle via ResizeObserver & window resize
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const syncBounds = () => {
      const rect = el.getBoundingClientRect();
      postFeedControl({
        action: "bounds",
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        winWidth: window.innerWidth,
        winHeight: window.innerHeight,
      });
    };
    syncBounds();
    const ro = new ResizeObserver(syncBounds);
    ro.observe(el);
    window.addEventListener("resize", syncBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [status?.effectiveEnabled]);

  // Airspace handling: hide native feed HWND whenever any modal/dialog/popover opens
  useEffect(() => {
    const checkOverlays = () => {
      const hasOverlay = Boolean(
        document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')
      );
      setAirspaceOccluded(hasOverlay);
      postFeedControl({ action: "airspace", occluded: hasOverlay });
    };
    const mo = new MutationObserver(checkOverlays);
    mo.observe(document.body, { childList: true, subtree: true });
    checkOverlays();
    return () => mo.disconnect();
  }, []);

  // Optional local-only wellbeing aggregate minute ticker (only when Active & showTimer/cap enabled)
  useEffect(() => {
    if (attention?.state !== "Active") return;
    if (!attention.wellbeing.showTimer && attention.wellbeing.dailyCapMinutes <= 0) return;
    const t = setInterval(() => {
      fetch("/v1/feed/wellbeing/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltaMinutes: 1 }),
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [attention?.state, attention?.wellbeing.showTimer, attention?.wellbeing.dailyCapMinutes]);

  const handleEnable = async () => {
    if (!consentChecked) {
      toast.error("Please acknowledge the privacy disclosure first.");
      return;
    }
    // Inside native Sanctum Desktop host: open native Windows trusted-channel confirmation dialog directly
    if (typeof window !== "undefined" && (window as any).chrome?.webview) {
      try {
        (window as any).chrome.webview.postMessage(
          JSON.stringify({
            type: "feedEnableConfirm",
            consentAccepted: true,
            inPrivateMode: inPrivateChoice,
          })
        );
        return;
      } catch {
        // fall through
      }
    }
    try {
      const res = await fetch("/v1/feed/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentAccepted: true, inPrivateMode: inPrivateChoice }),
      });
      if (res.status === 403) {
        toast.info("Trusted-channel confirmation required in desktop host or CLI to enable Feed Pane.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Could not enable Feed Pane.");
        return;
      }
      toast.success("Feed Pane enabled.");
      void refresh();
    } catch {
      toast.error("Failed to reach host.");
    }
  };

  const primaryReason = attention?.reasons?.[0] || null;

  // 1. Offline mode block
  if (status?.offlineBlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3" data-testid="feed-offline-notice">
        <div className="size-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <IconWifiOff size={20} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Feed Pane Blocked (Offline Mode)</h3>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Global Offline mode is active. Disable Offline mode in Settings &rarr; Network activity to use the Feed Pane.
        </p>
      </div>
    );
  }

  // 2. Consent screen (off by default)
  if (!status?.enabled) {
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="feed-consent-screen">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IconShieldLock size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Isolated Side Feed</h3>
            <p className="text-[11px] text-muted-foreground">Off by default · Trusted-channel opt-in</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            Scroll a plain, user-operated side browser (default preset: <strong className="text-foreground">Instagram</strong>) while your local agent works.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            <li>Runs in a separate isolated WebView2 profile (<code className="font-mono">feed-profile</code>) with zero access to Sanctum, Ollama, or local files.</li>
            <li><strong className="text-foreground">The AI agent cannot see, read, screenshot, or control this pane.</strong></li>
            <li>Automatically mutes and suspends whenever Sanctum needs your approval or input.</li>
            <li><strong className="text-amber-400">Privacy notice:</strong> Instagram/Meta (or any visited preset) will see your browsing activity just as in any normal browser; Sanctum cannot prevent third-party tracking on external sites.</li>
          </ul>
        </div>

        <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 rounded border-border"
          />
          <span>I understand external sites (e.g. Meta/Instagram) see my activity in this pane, and host-level egress summaries will appear in Network activity.</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={inPrivateChoice}
            onChange={(e) => setInPrivateChoice(e.target.checked)}
            className="rounded border-border"
          />
          <IconEyeOff size={13} />
          <span>Use InPrivate mode (do not persist cookies/session)</span>
        </label>

        <Button size="sm" className="w-full rounded-xl" disabled={!consentChecked} onClick={() => void handleEnable()}>
          Enable Feed Pane
        </Button>
      </div>
    );
  }

  // 3. Enabled Feed Pane (Direct Instagram Slot / Attention Pause Overlay)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Host-owned slot area */}
      <div ref={slotRef} data-testid="feed-slot" className="relative flex-1 min-h-0 bg-background/60">
        {attention?.state === "PausedAttention" && primaryReason ? (
          <div
            data-testid="feed-paused-card"
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-card/95"
          >
            <div className="size-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <IconBell size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Sanctum needs you: {primaryReason.summary}
              </h4>
              <p className="text-xs text-muted-foreground">
                Feed muted and suspended until {attention.reasons.length} pending item(s) are resolved.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={async () => {
                  await fetch("/v1/feed/attention/resume", { method: "POST" });
                  void refresh();
                }}
              >
                Resume feed
              </Button>
            </div>
          </div>
        ) : attention?.state === "PausedByUser" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-card/95">
            <p className="text-xs text-muted-foreground">Feed paused and suspended.</p>
            <Button
              size="sm"
              className="rounded-xl text-xs"
              onClick={async () => {
                await fetch("/v1/feed/attention/resume", { method: "POST" });
                void refresh();
              }}
            >
              Resume feed
            </Button>
          </div>
        ) : airspaceOccluded ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-card/90">
            <p className="text-xs text-muted-foreground">Feed hidden while dialog is open.</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-[11px] text-muted-foreground">
              Native isolated WebView2 slot ({status.activePreset?.name || "Instagram"}) · Ctrl+Shift+F
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
