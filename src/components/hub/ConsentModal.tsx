"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconShieldCheck, IconAlertTriangle } from "@tabler/icons-react";

interface ConsentModalProps {
  isOpen: boolean;
  targetHost: string;
  resourceName: string;
  sizeBytes: number;
  onConsent: () => void;
  onDecline: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  targetHost,
  resourceName,
  sizeBytes,
  onConsent,
  onDecline,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);

  const formattedSize =
    sizeBytes > 1024 * 1024 * 1024
      ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="max-w-[460px] rounded-2xl border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="space-y-2 pb-1">
          <div className="flex items-center gap-2.5 text-primary">
            <IconShieldCheck className="size-5" />
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
              Network Access Consent Required
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Sanctum enforces a strict zero-egress policy by default. Downloading or fetching this resource requires initiating an outbound HTTPS request to:
          </p>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Host:</span>
              <span className="font-semibold text-foreground">{targetHost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resource:</span>
              <span className="text-foreground truncate max-w-[240px]" title={resourceName}>{resourceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Size:</span>
              <span className="text-foreground">{formattedSize}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0"
            />
            <span>Remember my choice for {targetHost} (revocable in Settings &gt; Privacy)</span>
          </label>
        </div>

        <DialogFooter className="pt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onDecline}
            className="rounded-xl px-4 text-xs font-medium"
          >
            Decline
          </Button>
          <Button
            type="button"
            onClick={onConsent}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 text-xs font-medium h-9 shadow-sm"
          >
            Allow Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
