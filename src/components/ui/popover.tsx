"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface PopoverContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export const Popover: React.FC<PopoverProps> = ({ open, onOpenChange, children }) => {
  return (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  return (
    <div
      ref={ref}
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
>(({ className, align = "start", side = "bottom", children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx?.open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        ref={ref}
        className={cn(
          "absolute z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95",
          side === "bottom" && "top-full mt-2",
          side === "right" && "left-full ml-2 top-0",
          align === "start" && "left-0",
          align === "end" && "right-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
PopoverContent.displayName = "PopoverContent";
