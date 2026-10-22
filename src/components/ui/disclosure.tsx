"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  title: React.ReactNode;
  /** Short muted text shown next to the title (e.g. a count or current value) */
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Minimal collapsible section. Closed by default to keep screens calm. */
export function Disclosure({ title, hint, defaultOpen = false, className, children }: DisclosureProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-accent/40 transition-colors rounded-lg"
      >
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="font-medium text-foreground">{title}</span>
        {hint && <span className="ml-auto text-xs text-muted-foreground truncate">{hint}</span>}
      </button>
      {open && (
        <div id={id} className="border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
