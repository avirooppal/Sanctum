"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface PopoverContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export const Popover: React.FC<PopoverProps> = ({ open, onOpenChange, children }) => {
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (ctx) ctx.triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ctx, ref]
  );

  return (
    <div
      ref={setRefs}
      onClick={() => ctx?.onOpenChange(!ctx.open)}
      className="inline-block cursor-pointer"
      {...props}
    >
      {children}
    </div>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end";
    side?: "top" | "bottom" | "left" | "right";
  }
>(({ className, align = "start", side = "bottom", style, children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref]
  );

  const updatePosition = React.useCallback(() => {
    const trigger = ctx?.triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const tRect = trigger.getBoundingClientRect();
    const cRect = content.getBoundingClientRect();
    const pad = 12;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = tRect.bottom + gap;
    let left = tRect.left;

    if (side === "right") {
      left = tRect.right + gap;
      top = align === "end" ? tRect.bottom - cRect.height : tRect.top;
      if (left + cRect.width > vw - pad) {
        left = tRect.left;
        top = tRect.bottom + gap;
      }
    } else if (side === "left") {
      left = tRect.left - cRect.width - gap;
      top = align === "end" ? tRect.bottom - cRect.height : tRect.top;
    } else if (side === "top") {
      top = tRect.top - cRect.height - gap;
      left = align === "end" ? tRect.right - cRect.width : align === "center" ? tRect.left + (tRect.width - cRect.width) / 2 : tRect.left;
    } else {
      top = tRect.bottom + gap;
      left = align === "end" ? tRect.right - cRect.width : align === "center" ? tRect.left + (tRect.width - cRect.width) / 2 : tRect.left;
    }

    // Clamp cleanly within viewport so narrow/tiled windows never clip content
    left = Math.max(pad, Math.min(left, vw - cRect.width - pad));
    top = Math.max(pad, Math.min(top, vh - cRect.height - pad));
    setCoords({ top, left });
  }, [ctx, align, side]);

  React.useLayoutEffect(() => {
    if (!ctx?.open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [ctx?.open, updatePosition]);

  if (!ctx?.open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        ref={setRefs}
        style={{
          position: "fixed",
          top: coords ? `${coords.top}px` : "-9999px",
          left: coords ? `${coords.left}px` : "-9999px",
          visibility: coords ? "visible" : "hidden",
          ...style,
        }}
        className={cn(
          "z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>,
    document.body
  );
});
PopoverContent.displayName = "PopoverContent";
