"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconWifiOff,
  IconBell,
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
    // Inside native Sanctum Desktop host: open native Windows trusted-channel confirmation dialog directly
    if (typeof window !== "undefined" && (window as any).chrome?.webview) {
      try {
        (window as any).chrome.webview.postMessage(
          JSON.stringify({
            type: "feedEnableConfirm",
            consentAccepted: true,
            inPrivateMode: false,
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
        body: JSON.stringify({ consentAccepted: true, inPrivateMode: false }),
      });
      if (res.status === 403) {
        toast.info("Trusted-channel confirmation required in desktop host or CLI to enable Doomscrolling.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Could not open Instagram.");
        return;
      }
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

  // 2. Compact top warning popup (off by default)
  if (!status?.enabled) {
    return (
      <div className="flex-1 flex items-start justify-center pt-5 px-4" data-testid="feed-consent-screen">
        <div className="w-full max-w-sm rounded-2xl border border-amber-500/25 bg-card/85 backdrop-blur-xl p-4 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="size-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <IconAlertTriangle size={15} />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-xs font-semibold text-foreground">Open Instagram?</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Runs in an isolated browser — the AI agent cannot see or control this pane. Instagram/Meta still tracks your browsing here.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button
              size="sm"
              className="h-7 px-3 rounded-xl text-xs"
              onClick={() => void handleEnable()}
            >
              Continue
            </Button>
          </div>
        </div>
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
