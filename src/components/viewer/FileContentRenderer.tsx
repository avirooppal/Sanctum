"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ListTree,
  Maximize2,
  Minimize2,
  Save,
  ShieldAlert,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  renderSanitizedMarkdown,
  buildSandboxedPreviewConfig,
} from "@core/infra/security/content_sanitizer.ts";
import { ViewerTab } from "@/store/slices/viewerSlice";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";

export interface FsReadResponse {
  path: string;
  fullPath?: string;
  exists: boolean;
  isBinary: boolean;
  truncated: boolean;
  size: number;
  modifiedAt: string;
  revision: string;
  lineCount: number;
  content: string | null;
  hexPreview?: string;
  error?: string;
}

function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  return idx >= 0 ? filePath.slice(idx).toLowerCase() : "";
}

const JsonTreeNode: React.FC<{ label?: string; value: unknown; depth?: number }> = ({
  label,
  value,
  depth = 0,
}) => {
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === "object";

  if (!isObj) {
    const formatted =
      typeof value === "string"
        ? `"${value}"`
        : value === null
        ? "null"
        : String(value);
    const colorClass =
      typeof value === "string"
        ? "text-emerald-400"
        : typeof value === "number"
        ? "text-amber-400"
        : typeof value === "boolean"
        ? "text-sky-400"
        : "text-muted-foreground";
    return (
      <div className="font-mono text-xs py-0.5 flex items-baseline gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
        {label !== undefined && <span className="text-purple-300">{label}:</span>}
        <span className={cn("break-all", colorClass)}>{formatted}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="font-mono text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: `${depth * 14}px` }}
        className="flex items-center gap-1 py-0.5 hover:text-foreground text-left w-full"
      >
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        {label !== undefined && <span className="text-purple-300">{label}:</span>}
        <span className="text-muted-foreground">
          {Array.isArray(value) ? `Array(${entries.length})` : `{${entries.length} keys}`}
        </span>
      </button>
      {open &&
        entries.slice(0, 200).map(([k, v]) => (
          <JsonTreeNode key={k} label={k} value={v} depth={depth + 1} />
        ))}
    </div>
  );
};

function parseSimpleYaml(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let currentSection: Record<string, any> = result;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, val] = match;
    if (!val) {
      currentSection = {};
      result[key] = currentSection;
    } else {
      const clean = val.replace(/^['"]|['"]$/g, "");
      if (clean === "true") currentSection[key] = true;
      else if (clean === "false") currentSection[key] = false;
      else if (!Number.isNaN(Number(clean)) && clean !== "") currentSection[key] = Number(clean);
      else currentSection[key] = clean;
    }
  }
  return result;
}

function parseCsvRows(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n").slice(0, 300);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

interface FileContentRendererProps {
  tab: ViewerTab;
  data: FsReadResponse | null;
  loading: boolean;
  onUpdateTab: (patch: Partial<ViewerTab>) => void;
  onOpenFilePath: (relPath: string) => void;
  onOpenExternal: (relPath: string) => void;
  onSaved: (newRev: string) => void;
}

export const FileContentRenderer: React.FC<FileContentRendererProps> = ({
  tab,
  data,
  loading,
  onUpdateTab,
  onOpenFilePath,
  onOpenExternal,
  onSaved,
}) => {
  const ext = getExtension(tab.path);
  const [showToc, setShowToc] = useState(false);
  const [jumpLineInput, setJumpLineInput] = useState(tab.jumpLine ? String(tab.jumpLine) : "");
  const [highlightedLine, setHighlightedLine] = useState<number | null>(tab.jumpLine || null);
  const [imageZoom, setImageZoom] = useState(1);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [rangeVerified, setRangeVerified] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp"].includes(ext);
  const isVideo = [".mp4", ".webm", ".mov"].includes(ext);
  const isAudio = [".mp3", ".wav", ".ogg", ".m4a"].includes(ext);
  const isPdf = ext === ".pdf";
  const isHtmlOrSvg = [".html", ".htm", ".svg"].includes(ext);
  const isMarkdown = [".md", ".mdx"].includes(ext);
  const isJson = ext === ".json";
  const isYaml = [".yaml", ".yml"].includes(ext);
  const isCsv = ext === ".csv";

  useEffect(() => {
    if (tab.jumpLine) {
      setHighlightedLine(tab.jumpLine);
      setJumpLineInput(String(tab.jumpLine));
      const el = codeContainerRef.current?.querySelector(`[data-line="${tab.jumpLine}"]`);
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [tab.jumpLine, data?.revision]);

  // Load binary media via authenticated /api/fs/raw
  useEffect(() => {
    if (!isImage && !isVideo && !isAudio && !isPdf) return;
    let active = true;
    let createdUrl: string | null = null;

    const loadMedia = async () => {
      try {
        if (isVideo || isAudio) {
          // Probe HTTP Range support first
          const rangeRes = await fetch(`/api/fs/raw?path=${encodeURIComponent(tab.path)}`, {
            headers: { Range: "bytes=0-63" },
          });
          if (active && rangeRes.status === 206) {
            setRangeVerified(true);
          }
        }
        const res = await fetch(`/api/fs/raw?path=${encodeURIComponent(tab.path)}`);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setMediaBlobUrl(createdUrl);
      } catch {
        // Ignore
      }
    };

    void loadMedia();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [tab.path, tab.refreshCounter, isImage, isVideo, isAudio, isPdf]);

  const handleSaveRaw = async () => {
    if (tab.dirtyContent === null || tab.dirtyContent === undefined || saving) return;
    setSaving(true);
    try {
      const res = await fetchWithApproval(
        "/api/fs/write",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: tab.path,
            content: tab.dirtyContent,
          }),
        },
        "edit_file"
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Saved ${tab.title} (checkpoint created)`);
        onSaved(body.revision || "");
      } else {
        toast.error(body.error || "Could not save file");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const markdownRendered = useMemo(() => {
    if (!isMarkdown || !data?.content) return null;
    return renderSanitizedMarkdown(data.content, {
      allowRemoteImages: Boolean(tab.allowRemoteImages),
    });
  }, [isMarkdown, data?.content, tab.allowRemoteImages]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        Loading {tab.title}…
      </div>
    );
  }

  if (data?.error || (data && !data.exists)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="size-5 text-amber-400" />
        <p className="text-xs text-muted-foreground">{data?.error || "File could not be loaded."}</p>
      </div>
    );
  }

  // RAW EDIT / SOURCE MODE
  if (tab.mode === "raw" && data && !data.isBinary) {
    const currentText = tab.dirtyContent !== null && tab.dirtyContent !== undefined ? tab.dirtyContent : (data.content || "");
    const lines = currentText.replace(/\r\n/g, "\n").split("\n");
    const isDirty = tab.dirtyContent !== null && tab.dirtyContent !== undefined && tab.dirtyContent !== data.content;

    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background/60">
        {/* Raw Editor Sub-toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-card/50 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              {lines.length} lines · {(data.size / 1024).toFixed(1)} KB
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={lines.length}
                value={jumpLineInput}
                onChange={(e) => setJumpLineInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const ln = Number(jumpLineInput);
                    if (ln >= 1) {
                      setHighlightedLine(ln);
                      const el = codeContainerRef.current?.querySelector(`[data-line="${ln}"]`);
                      if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }
                }}
                placeholder="Line #"
                aria-label="Jump to line"
                className="w-16 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isDirty && (
              <button
                type="button"
                onClick={() => onUpdateTab({ dirtyContent: null })}
                className="px-2 py-0.5 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              disabled={!isDirty || saving}
              onClick={() => void handleSaveRaw()}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-40"
            >
              <Save className="size-3" />
              <span>{saving ? "Saving…" : "Save"}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 overflow-auto" ref={codeContainerRef}>
          <textarea
            aria-label={`Raw editor for ${tab.path}`}
            value={currentText}
            onChange={(e) => onUpdateTab({ dirtyContent: e.target.value })}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void handleSaveRaw();
              }
            }}
            spellCheck={false}
            className="w-full h-full p-4 bg-transparent font-mono text-xs leading-5 text-foreground focus:outline-none resize-none"
          />
        </div>
      </div>
    );
  }

  // 1. IMAGE RENDERER
  if (isImage) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-card/40 text-xs">
          <span className="text-[11px] font-mono text-muted-foreground">
            Image · {data ? `${(data.size / 1024).toFixed(1)} KB` : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setImageZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
              className="p-1 rounded hover:bg-accent"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="text-[11px] font-mono w-12 text-center">
              {Math.round(imageZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setImageZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              className="p-1 rounded hover:bg-accent"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setImageZoom(1)}
              className="px-1.5 py-0.5 rounded border border-border/60 text-[10px] hover:bg-accent"
            >
              Fit
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#111115]">
          {mediaBlobUrl ? (
            <img
              src={mediaBlobUrl}
              alt={tab.title}
              style={{ transform: `scale(${imageZoom})`, transformOrigin: "center center" }}
              className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Loading image…</span>
          )}
        </div>
      </div>
    );
  }

  // 2. VIDEO & AUDIO RENDERER
  if (isVideo || isAudio) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-card/40 text-xs">
          <span className="text-[11px] font-mono text-muted-foreground">
            {isVideo ? "Video" : "Audio"} · {data ? `${(data.size / 1024).toFixed(1)} KB` : ""}
          </span>
          {rangeVerified && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <Check className="size-3" /> HTTP 206 Range Active
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-6 bg-[#101014]">
          {mediaBlobUrl ? (
            isVideo ? (
              <video
                src={mediaBlobUrl}
                controls
                className="max-w-full max-h-full rounded-lg border border-border/60 shadow-xl"
              />
            ) : (
              <audio src={mediaBlobUrl} controls className="w-full max-w-md" />
            )
          ) : (
            <span className="text-xs text-muted-foreground">Loading media stream…</span>
          )}
        </div>
      </div>
    );
  }

  // 3. PDF RENDERER
  if (isPdf) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-card/40 text-xs">
          <span className="text-[11px] font-mono text-muted-foreground">
            PDF Document · {data ? `${(data.size / 1024).toFixed(1)} KB` : ""}
          </span>
          <button
            type="button"
            onClick={() => onOpenExternal(tab.path)}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[11px] hover:bg-accent"
          >
            <ExternalLink className="size-3" /> Open in PDF reader
          </button>
        </div>
        <div className="flex-1 bg-[#141418]">
          {mediaBlobUrl ? (
            <iframe
              title={tab.title}
              src={mediaBlobUrl}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="p-6 text-xs text-muted-foreground">Loading PDF preview…</div>
          )}
        </div>
      </div>
    );
  }

  // 4. SANDBOXED HTML / SVG RENDERER (Security Critical: NEVER allow-same-origin)
  if (isHtmlOrSvg && data?.content !== null && data?.content !== undefined) {
    const sandboxCfg = buildSandboxedPreviewConfig(data.content, {
      isSvg: ext === ".svg",
      allowScripts: Boolean(tab.allowScripts),
    });

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-card/60 text-xs">
          <div className="flex items-center gap-1.5 text-[11px]">
            {tab.allowScripts ? (
              <>
                <ShieldAlert className="size-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-300 font-medium">
                  Null-Origin Sandbox (Scripts Enabled · Host Token Isolated)
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span className="text-muted-foreground">
                  Strict Sandbox (Scripts & Same-Origin Disabled)
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onUpdateTab({ allowScripts: !tab.allowScripts })}
            className={cn(
              "px-2 py-0.5 rounded border text-[11px] transition-colors",
              tab.allowScripts
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.allowScripts ? "Disable Scripts" : "Allow Scripts (Null Origin)"}
          </button>
        </div>

        <iframe
          title={`Sandboxed preview of ${tab.title}`}
          sandbox={sandboxCfg.sandbox}
          srcDoc={sandboxCfg.srcDoc}
          className="flex-1 w-full border-0 bg-[#141418]"
        />
      </div>
    );
  }

  // 5. MARKDOWN RENDERER (Sanitized + Table of Contents)
  if (isMarkdown && markdownRendered) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {markdownRendered.toc.length > 0 && (
          <div className="border-b border-border/60 bg-card/40 px-3 py-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowToc((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ListTree className="size-3.5" />
                <span>Table of Contents ({markdownRendered.toc.length})</span>
                {showToc ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => onUpdateTab({ allowRemoteImages: !tab.allowRemoteImages })}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                {tab.allowRemoteImages ? "Block remote images" : "Allow remote images"}
              </button>
            </div>
            {showToc && (
              <div className="mt-1.5 max-h-36 overflow-y-auto space-y-0.5 border-t border-border/40 pt-1.5">
                {markdownRendered.toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    style={{ paddingLeft: `${(item.level - 1) * 10}px` }}
                    className="block text-[11px] text-muted-foreground hover:text-foreground truncate py-0.5"
                  >
                    {item.text}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          onClick={(e) => {
            const target = (e.target as HTMLElement).closest("[data-workspace-path]");
            if (target) {
              e.preventDefault();
              const p = target.getAttribute("data-workspace-path");
              if (p) onOpenFilePath(p);
            }
          }}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-3 text-sm leading-relaxed text-foreground/90 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_pre]:border [&_pre]:border-border/60 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:overflow-x-auto [&_.md-inline-code]:rounded [&_.md-inline-code]:bg-muted/70 [&_.md-inline-code]:px-1.5 [&_.md-inline-code]:py-0.5 [&_.md-inline-code]:font-mono [&_.md-inline-code]:text-xs [&_.md-inline-code]:text-emerald-300 [&_.md-workspace-link]:text-primary [&_.md-workspace-link]:underline [&_.md-blocked-img]:inline-block [&_.md-blocked-img]:rounded [&_.md-blocked-img]:border [&_.md-blocked-img]:border-amber-500/40 [&_.md-blocked-img]:px-2 [&_.md-blocked-img]:py-0.5 [&_.md-blocked-img]:text-xs [&_.md-blocked-img]:text-amber-300"
          dangerouslySetInnerHTML={{ __html: markdownRendered.html }}
        />
      </div>
    );
  }

  // 6. JSON / YAML STRUCTURED TREE RENDERER
  if ((isJson || isYaml) && data?.content) {
    let parsedData: any = null;
    let parseErr: string | null = null;
    try {
      parsedData = isJson ? JSON.parse(data.content) : parseSimpleYaml(data.content);
    } catch (e: any) {
      parseErr = e?.message || "Parse error";
    }

    if (!parseErr && parsedData !== null) {
      return (
        <div className="flex-1 overflow-auto p-4 bg-background/50">
          <JsonTreeNode value={parsedData} />
        </div>
      );
    }
  }

  // 7. CSV TABLE RENDERER
  if (isCsv && data?.content) {
    const rows = parseCsvRows(data.content);
    const header = rows[0] || [];
    const bodyRows = rows.slice(1);
    return (
      <div className="flex-1 overflow-auto p-3">
        <table className="w-full border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {header.map((h, idx) => (
                <th key={idx} className="px-2.5 py-1.5 text-left font-semibold text-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((r, rIdx) => (
              <tr key={rIdx} className="border-b border-border/40 hover:bg-muted/30">
                {r.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1 text-foreground/85">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 8. BINARY / HEX NOTICE
  if (data?.isBinary) {
    return (
      <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4 overflow-auto">
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 p-3.5">
          <div>
            <div className="text-xs font-semibold text-foreground">
              Binary File ({(data.size / 1024).toFixed(1)} KB)
            </div>
            <div className="text-[11px] text-muted-foreground">
              First 512 bytes shown below in hexadecimal.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenExternal(tab.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
          >
            <ExternalLink className="size-3.5" />
            <span>Open in Default App</span>
          </button>
        </div>
        {data.hexPreview && (
          <pre className="rounded-xl border border-border/60 bg-muted/30 p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground overflow-x-auto">
            {data.hexPreview}
          </pre>
        )}
      </div>
    );
  }

  // 9. DEFAULT SOURCE CODE RENDERER (Line numbers + Jump to line + Syntax coloring)
  const codeLines = (data?.content || "").replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border/50 bg-card/30 text-[11px] text-muted-foreground font-mono">
        <span>
          {codeLines.length} lines · {data ? `${(data.size / 1024).toFixed(1)} KB` : ""}
          {data?.truncated ? " (Truncated at size cap)" : ""}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Jump to line:</span>
          <input
            type="number"
            min={1}
            max={codeLines.length}
            value={jumpLineInput}
            onChange={(e) => setJumpLineInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const ln = Number(jumpLineInput);
                if (ln >= 1) {
                  setHighlightedLine(ln);
                  const el = codeContainerRef.current?.querySelector(`[data-line="${ln}"]`);
                  if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }
            }}
            placeholder="#"
            className="w-14 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
          />
        </div>
      </div>

      <div ref={codeContainerRef} className="flex-1 overflow-auto py-2 font-mono text-xs leading-5">
        {codeLines.map((ln, idx) => {
          const lineNumber = idx + 1;
          const isTarget = highlightedLine === lineNumber;
          return (
            <div
              key={lineNumber}
              data-line={lineNumber}
              className={cn(
                "flex px-3 hover:bg-muted/30",
                isTarget && "bg-primary/20 border-l-2 border-primary"
              )}
            >
              <span className="w-10 shrink-0 select-none text-right pr-3 text-muted-foreground/50">
                {lineNumber}
              </span>
              <span className="whitespace-pre flex-1 text-foreground/90">{ln || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
