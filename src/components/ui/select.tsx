"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  value: string;
  onValueChange: (val: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedLabel: string;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  className,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const findLabel = (nodes: React.ReactNode): string => {
    for (const node of React.Children.toArray(nodes)) {
      if (!React.isValidElement<{ value?: string; children?: React.ReactNode }>(node)) continue;
      if (node.type === SelectItem && node.props.value === value && typeof node.props.children === "string") return node.props.children;
      const nested = findLabel(node.props.children);
      if (nested) return nested;
    }
    return "";
  };
  const selectedLabel = findLabel(children);

  const handleValueChange = (val: string) => {
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onValueChange?.(val);
    setOpen(false);
  };

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        selectedLabel,
      }}
    >
      <div data-no-drag className={cn("relative inline-block w-full", className)}>{children}</div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={ctx?.open}
      aria-haspopup="listbox"
      onKeyDown={(e) => { if (e.key === "Escape") ctx?.setOpen(false); }}
      onClick={() => ctx?.setOpen(!ctx.open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-4 opacity-50 shrink-0 ml-2" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext);
  return (
    <span className="truncate">
      {ctx?.selectedLabel || ctx?.value || placeholder}
    </span>
  );
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(SelectContext);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest("[role=combobox]")) {
        ctx?.setOpen(false);
      }
    };
    if (ctx?.open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ctx?.open]);

  if (!ctx?.open) return null;

  return (
    <div
      ref={ref}
      role="listbox"
      onKeyDown={(e) => { if (e.key === "Escape") ctx?.setOpen(false); }}
      data-no-drag
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(SelectContext);
  const isSelected = ctx?.value === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-no-drag
      onClick={() => {
        ctx?.onValueChange(value);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        isSelected && "font-medium text-accent-foreground",
        className
      )}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {isSelected && <Check className="size-4" />}
      </span>
      <span>{children}</span>
    </button>
  );
}
