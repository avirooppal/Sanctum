"use client";

import React, { useState, useEffect, useCallback } from "react";
import { IconMinus, IconSquare, IconCopy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  className?: string;
}

export const postHostWindowMessage = (
  action: "windowDrag" | "windowMinimize" | "windowMaximize" | "windowRestore" | "windowClose"
) => {
  if (typeof window !== "undefined") {
    const wv = (window as unknown as { chrome?: { webview?: { postMessage: (msg: string) => void } } }).chrome?.webview;
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify({ type: action }));
    }
  }
};

export const handleTitleBarMouseDown = (e: React.MouseEvent<HTMLElement>) => {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (
    target.closest("button") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("a") ||
    target.closest("[role='button']") ||
    target.closest("[role='combobox']") ||
    target.closest("[data-no-drag]")
  ) {
    return;
  }
  postHostWindowMessage("windowDrag");
};

export const handleTitleBarDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (
    target.closest("button") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("a") ||
    target.closest("[role='button']") ||
    target.closest("[role='combobox']") ||
    target.closest("[data-no-drag]")
  ) {
    return;
  }
  postHostWindowMessage("windowMaximize");
};

export const WindowControls: React.FC<WindowControlsProps> = ({ className }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const checkInitialBounds = useCallback(() => {
    if (typeof window !== "undefined" && window.screen) {
      const isNearMax =
        window.innerWidth >= window.screen.availWidth - 24 &&
        window.innerHeight >= window.screen.availHeight - 48;
      setIsMaximized(isNearMax);
    }
  }, []);

  useEffect(() => {
    checkInitialBounds();

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.type === "windowStateChanged" && typeof data.isMaximized === "boolean") {
          setIsMaximized(data.isMaximized);
        }
      } catch {}
    };

    const wv = (window as unknown as {
      chrome?: {
        webview?: {
          addEventListener: (t: string, fn: (e: any) => void) => void;
          removeEventListener: (t: string, fn: (e: any) => void) => void;
        };
      };
    }).chrome?.webview;

    if (wv?.addEventListener) {
      wv.addEventListener("message", handleMessage);
    }
    window.addEventListener("message", handleMessage);
    window.addEventListener("resize", checkInitialBounds);

    return () => {
      if (wv?.removeEventListener) {
        wv.removeEventListener("message", handleMessage);
      }
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("resize", checkInitialBounds);
    };
  }, [checkInitialBounds]);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    postHostWindowMessage("windowMinimize");
  };

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isMaximized) {
      postHostWindowMessage("windowRestore");
      setIsMaximized(false);
    } else {
      postHostWindowMessage("windowMaximize");
      setIsMaximized(true);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    postHostWindowMessage("windowClose");
  };

  return (
    <div
      data-no-drag
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center shrink-0 select-none pointer-events-auto",
        className
      )}
    >
      <button
        type="button"
        onClick={handleMinimize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Minimize window"
        title="Minimize"
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors rounded-md"
      >
        <IconMinus size={14} stroke={1.75} />
      </button>

      <button
        type="button"
        onClick={handleToggleMaximize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        title={isMaximized ? "Restore" : "Maximize"}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors rounded-md"
      >
        {isMaximized ? (
          <IconCopy size={13} stroke={1.75} className="rotate-90" />
        ) : (
          <IconSquare size={13} stroke={1.75} />
        )}
      </button>

      <button
        type="button"
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Close window"
        title="Close"
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors rounded-md"
      >
        <IconX size={15} stroke={1.75} />
      </button>
    </div>
  );
};
