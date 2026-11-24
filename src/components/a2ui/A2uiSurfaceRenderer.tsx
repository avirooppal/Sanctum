"use client";

import React, { Component, useState } from "react";
import { FileText, GitCompare, Copy, Check, AlertTriangle, Code2, Terminal, BookOpen } from "lucide-react";
import {
  validateA2uiSurfaceClient,
  type A2uiComponentNode,
  type A2uiSurfacePayload,
} from "@/lib/a2ui/adapter";
import { cn } from "@/lib/utils";

interface SurfaceErrorBoundaryProps {
  fallbackText: string;
  rawJson: string;
  children: React.ReactNode;
}

interface SurfaceErrorBoundaryState {
  hasError: boolean;
}

class SurfaceErrorBoundary extends Component<SurfaceErrorBoundaryProps, SurfaceErrorBoundaryState> {
  constructor(props: SurfaceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): SurfaceErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <A2uiFallbackNotice fallbackText={this.props.fallbackText} rawJson={this.props.rawJson} />;
    }
    return this.props.children;
  }
}

const A2uiFallbackNotice: React.FC<{ fallbackText: string; rawJson: string }> = ({ fallbackText, rawJson }) => {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 text-amber-300">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" />
          Couldn&apos;t render interactive view, showing text
        </span>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-[11px] underline text-muted-foreground hover:text-foreground"
        >
          {showRaw ? "Hide raw" : "View raw"}
        </button>
      </div>
      {fallbackText && <pre className="whitespace-pre-wrap font-sans text-foreground/90">{fallbackText}</pre>}
      {showRaw && (
        <pre className="p-2 rounded-lg bg-background/80 border border-border/60 overflow-x-auto text-[11px] font-mono text-muted-foreground">
          {rawJson}
        </pre>
      )}
    </div>
  );
};

export interface A2uiSurfaceRendererProps {
  sessionId: string;
  rawSurface: unknown;
  markdownFallback?: string;
  onOpenFile?: (relPath: string) => void;
  onOpenDiff?: (relPath: string) => void;
  onUserAction?: (action: { surfaceId: string; componentId: string; actionName: string; data: Record<string, any> }) => void;
}

export const A2uiSurfaceRenderer: React.FC<A2uiSurfaceRendererProps> = ({
  sessionId,
  rawSurface,
  markdownFallback,
  onOpenFile,
  onOpenDiff,
  onUserAction,
}) => {
  const rawJson = (() => {
    try { return JSON.stringify(rawSurface, null, 2); } catch { return String(rawSurface); }
  })();

  const validation = validateA2uiSurfaceClient(rawSurface);
  if (!validation.ok || !validation.surface) {
    return (
      <A2uiFallbackNotice
        fallbackText={markdownFallback || validation.markdownFallback}
        rawJson={rawJson}
      />
    );
  }

  return (
    <SurfaceErrorBoundary fallbackText={markdownFallback || validation.markdownFallback} rawJson={rawJson}>
      <A2uiSurfaceBody
        sessionId={sessionId}
        surface={validation.surface}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
        onUserAction={onUserAction}
      />
    </SurfaceErrorBoundary>
  );
};

const A2uiSurfaceBody: React.FC<{
  sessionId: string;
  surface: A2uiSurfacePayload;
  onOpenFile?: (relPath: string) => void;
  onOpenDiff?: (relPath: string) => void;
  onUserAction?: (action: { surfaceId: string; componentId: string; actionName: string; data: Record<string, any> }) => void;
}> = ({ sessionId, surface, onOpenFile, onOpenDiff, onUserAction }) => {
  const [formValues, setFormValues] = useState<Record<string, any>>(surface.dataModel || {});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dispatchAction = async (componentId: string, actionName: string) => {
    const payload = {
      idempotencyKey: `a2ui-${surface.surfaceId}-${componentId}-${Date.now()}`,
      surfaceId: surface.surfaceId,
      componentId,
      actionName,
      data: formValues,
    };
    onUserAction?.({ surfaceId: surface.surfaceId, componentId, actionName, data: formValues });
    if (sessionId) {
      await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}/a2ui-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  };

  const renderNode = (node: A2uiComponentNode) => {
    const p = node.props || {};
    switch (node.type) {
      case "Text":
        return (
          <p key={node.id} className={cn("text-xs text-foreground", p.variant === "title" && "text-sm font-semibold")}>
            {String(p.text || p.content || "")}
          </p>
        );
      case "Button":
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => void dispatchAction(node.id, String(p.action || p.label || "click"))}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-xs font-medium text-primary hover:bg-primary/25 transition-colors motion-reduce:transition-none"
          >
            {String(p.label || "Action")}
          </button>
        );
      case "TextField":
        return (
          <label key={node.id} className="block space-y-1 text-xs">
            <span className="text-muted-foreground">{String(p.label || "Input")}</span>
            <input
              type="text"
              value={String(formValues[node.id] ?? p.value ?? "")}
              placeholder={String(p.placeholder || "")}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [node.id]: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
        );
      case "Checkbox":
        return (
          <label key={node.id} className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(formValues[node.id] ?? p.checked)}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [node.id]: e.target.checked }))}
              className="rounded border-border"
            />
            <span>{String(p.label || "")}</span>
          </label>
        );
      case "Select": {
        const opts = Array.isArray(p.options) ? p.options : [];
        return (
          <label key={node.id} className="block space-y-1 text-xs">
            <span className="text-muted-foreground">{String(p.label || "Select")}</span>
            <select
              value={String(formValues[node.id] ?? p.value ?? "")}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [node.id]: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              {opts.map((o: any, idx: number) => (
                <option key={idx} value={String(o?.value ?? o)}>
                  {String(o?.label ?? o)}
                </option>
              ))}
            </select>
          </label>
        );
      }
      case "Table": {
        const cols = Array.isArray(p.columns) ? p.columns : [];
        const rows = Array.isArray(p.rows) ? p.rows : [];
        return (
          <div key={node.id} className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr>
                  {cols.map((c: any, idx: number) => (
                    <th key={idx} className="px-2.5 py-1.5 font-semibold text-foreground">{String(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r: any, rIdx: number) => (
                  <tr key={rIdx}>
                    {(Array.isArray(r) ? r : []).map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="px-2.5 py-1.5 text-muted-foreground">{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "FileCard": {
        const relPath = String(p.path || "");
        const valid = p.pathValid !== false && Boolean(relPath);
        return (
          <button
            key={node.id}
            type="button"
            disabled={!valid}
            onClick={() => valid && onOpenFile?.(relPath)}
            className={cn(
              "w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors",
              valid
                ? "border-border/70 bg-background/70 hover:border-primary/50"
                : "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
            )}
          >
            <FileText className="size-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-mono truncate text-foreground">{relPath}</div>
              {p.description && <div className="text-[11px] text-muted-foreground truncate">{String(p.description)}</div>}
              {!valid && <div className="text-[10px] text-amber-400">Unavailable or out of workspace scope</div>}
            </div>
          </button>
        );
      }
      case "DiffSummary": {
        const relPath = String(p.path || "");
        const valid = p.pathValid !== false && Boolean(relPath);
        return (
          <button
            key={node.id}
            type="button"
            disabled={!valid}
            onClick={() => valid && onOpenDiff?.(relPath)}
            className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/70 bg-background/70 text-xs hover:border-primary/50 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2 font-mono truncate">
              <GitCompare className="size-4 text-sky-400 shrink-0" />
              {relPath}
            </span>
            <span className="font-mono text-[11px] shrink-0">
              <span className="text-emerald-400">+{Number(p.added || 0)}</span>{" "}
              <span className="text-rose-400">-{Number(p.removed || 0)}</span>
            </span>
          </button>
        );
      }
      case "TodoList": {
        const items = Array.isArray(p.items) ? p.items : [];
        return (
          <ul key={node.id} className="space-y-1 text-xs">
            {items.map((it: any, idx: number) => {
              const done = it?.done === true || String(it?.status || "").toLowerCase() === "done";
              return (
                <li key={idx} className="flex items-center gap-2">
                  <span className={cn("size-3.5 rounded border inline-flex items-center justify-center text-[10px]", done ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "border-border")}>
                    {done ? "✓" : ""}
                  </span>
                  <span className={cn(done && "line-through text-muted-foreground")}>{String(it?.title || "")}</span>
                </li>
              );
            })}
          </ul>
        );
      }
      case "CodeBlock": {
        const code = String(p.code || "");
        return (
          <div key={node.id} className="rounded-xl border border-border/60 bg-background/90 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 text-[10px] font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Code2 className="size-3" />{String(p.language || "code")}</span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(code);
                  setCopiedId(node.id);
                  setTimeout(() => setCopiedId(null), 1500);
                }}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {copiedId === node.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                {copiedId === node.id ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-[11px] font-mono text-foreground">{code}</pre>
          </div>
        );
      }
      case "TerminalOutput":
        return (
          <div key={node.id} className="rounded-xl border border-border/60 bg-black/40 p-2.5 space-y-1">
            <div className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
              <Terminal className="size-3" /> Read-only output
            </div>
            <pre className="text-[11px] font-mono text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {String(p.output || "").slice(0, 4096)}
            </pre>
          </div>
        );
      case "Citations": {
        const sources = Array.isArray(p.sources) ? p.sources : [];
        return (
          <div key={node.id} className="space-y-1 text-xs">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground inline-flex items-center gap-1">
              <BookOpen className="size-3" /> Sources
            </div>
            {sources.map((s: any, idx: number) => (
              <div key={idx} className="text-[11px] text-muted-foreground">
                <span className="font-mono text-foreground">{String(s?.path || "")}</span>
                {s?.excerpt ? ` — ${String(s.excerpt)}` : ""}
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <div key={node.id} className="p-2 rounded-lg border border-border/50 text-xs text-muted-foreground">
            {String(p.title || p.text || node.type)}
          </div>
        );
    }
  };

  return (
    <section
      aria-label="Agent-generated UI"
      className="relative isolate overflow-hidden rounded-2xl border border-border/80 bg-card/80 p-3.5 space-y-2.5 my-2"
    >
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1.5">
        <span>Agent-generated UI · A2UI v{surface.a2uiVersion}</span>
        <span>Untrusted data view</span>
      </div>
      <div className="space-y-2">{surface.components.map(renderNode)}</div>
    </section>
  );
};
