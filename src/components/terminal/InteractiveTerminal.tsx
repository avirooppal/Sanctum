"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Terminal as TerminalIcon,
  Square,
  RotateCcw,
  Trash2,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InteractiveTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

type ShellKind = "powershell" | "cmd" | "wsl";

const getWebViewBridge = () => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as {
    chrome?: {
      webview?: {
        postMessage: (msg: string) => void;
        addEventListener: (t: string, fn: (e: MessageEvent) => void) => void;
        removeEventListener: (t: string, fn: (e: MessageEvent) => void) => void;
      };
    };
  }).chrome?.webview;
};

export const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({
  isOpen,
  onClose,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termInstanceRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [shell, setShell] = useState<ShellKind>("powershell");
  const [isRunning, setIsRunning] = useState(false);
  const [isPtyAlive, setIsPtyAlive] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelHeight, setPanelHeight] = useState(220);

  const shellRef = useRef<ShellKind>(shell);
  shellRef.current = shell;
  const cwdRef = useRef<string>(currentCwd);
  cwdRef.current = currentCwd;
  const isRunningRef = useRef<boolean>(false);
  const currentLineRef = useRef<string>("");
  const abortCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((w) => {
        if (w?.root) {
          setCurrentCwd(w.root);
          cwdRef.current = w.root;
        }
      })
      .catch(() => {});
  }, []);

  const postPty = useCallback((payload: Record<string, unknown>) => {
    const wv = getWebViewBridge();
    if (wv?.postMessage) {
      wv.postMessage(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const startPty = useCallback(
    (targetShell?: ShellKind) => {
      const term = termInstanceRef.current;
      const fit = fitAddonRef.current;
      try {
        fit?.fit();
      } catch {}
      const cols = term?.cols || 80;
      const rows = term?.rows || 14;
      setIsPtyAlive(true);
      postPty({
        type: "ptyStart",
        shell: targetShell || shellRef.current,
        cwd: cwdRef.current,
        cols,
        rows,
      });
      setTimeout(() => term?.focus(), 50);
    },
    [postPty]
  );

  const promptFallback = useCallback((term: any) => {
    const cwd = cwdRef.current;
    const cwdDisplay = cwd ? cwd.split(/[\\/]/).pop() || cwd : "sanctum";
    term.write(`\x1b[32m${cwdDisplay}\x1b[0m \x1b[38;5;208m$\x1b[0m `);
  }, []);

  const executeFallbackCommand = useCallback(
    async (cmd: string, term: any) => {
      isRunningRef.current = true;
      setIsRunning(true);
      abortCtrlRef.current = new AbortController();
      try {
        const res = await fetch("/api/terminal/execute", {
          method: "POST",
          signal: abortCtrlRef.current.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "run_command",
            command: cmd,
            shell: shellRef.current,
            cwd: cwdRef.current,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          term.writeln(`\x1b[31m[Error]: ${data.error || "Command execution failed"}\x1b[0m`);
        } else {
          if (data.stdout) {
            term.write(data.stdout.replace(/\r?\n/g, "\r\n"));
            if (!data.stdout.endsWith("\n")) term.writeln("");
          }
          if (data.stderr) {
            term.write(`\x1b[33m${data.stderr.replace(/\r?\n/g, "\r\n")}\x1b[0m`);
            if (!data.stderr.endsWith("\n")) term.writeln("");
          }
          if (data.exitCode !== 0) {
            term.writeln(`\x1b[90mProcess exited with code ${data.exitCode}\x1b[0m`);
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          term.writeln("\x1b[31m[Process terminated by user]\x1b[0m");
        } else {
          term.writeln(`\x1b[31m[Network error]: ${err.message}\x1b[0m`);
        }
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
        abortCtrlRef.current = null;
        promptFallback(term);
      }
    },
    [promptFallback]
  );

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const wv = getWebViewBridge();
    const hasPty = Boolean(wv?.postMessage);

    const handlePtyMessage = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const term = termInstanceRef.current;
        if (!msg || !term) return;
        if (msg.type === "ptyOutput" && typeof msg.data === "string") {
          term.write(msg.data);
        } else if (msg.type === "ptyExit") {
          setIsPtyAlive(false);
          term.writeln(`\r\n\x1b[90m[Shell exited with code ${msg.exitCode ?? 0}. Click Restart to open a new session.]\x1b[0m`);
        }
      } catch {}
    };

    if (hasPty && wv?.addEventListener) {
      wv.addEventListener("message", handlePtyMessage);
    }

    Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
      ([{ Terminal }, { FitAddon }]) => {
        if (disposed || !containerRef.current) return;

        if (termInstanceRef.current) {
          try {
            termInstanceRef.current.dispose();
          } catch {}
        }

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 12,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          theme: {
            background: "#0c0d12",
            foreground: "#f0f1f5",
            cursor: "#f97316",
            black: "#1e1e24",
            red: "#ef4444",
            green: "#10b981",
            yellow: "#f59e0b",
            blue: "#3b82f6",
            magenta: "#ec4899",
            cyan: "#06b6d4",
            white: "#f8fafc",
            brightBlack: "#4b5563",
            brightRed: "#f87171",
            brightGreen: "#34d399",
            brightYellow: "#fbbf24",
            brightBlue: "#60a5fa",
            brightMagenta: "#f472b6",
            brightCyan: "#22d3ee",
            brightWhite: "#ffffff",
          },
          convertEol: !hasPty,
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        termInstanceRef.current = term;
        fitAddonRef.current = fit;

        const syncSize = () => {
          try {
            fit.fit();
            if (hasPty && term.cols > 0 && term.rows > 0) {
              postPty({ type: "ptyResize", cols: term.cols, rows: term.rows });
            }
          } catch {}
        };

        syncSize();

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver(() => syncSize());
          resizeObserver.observe(containerRef.current);
        }

        if (hasPty) {
          startPty(shellRef.current);
          term.onData((data: string) => {
            postPty({ type: "ptyInput", data });
          });
        } else {
          term.writeln("\x1b[38;5;208mSanctum Host Terminal (HTTP Fallback)\x1b[0m");
          term.writeln("\x1b[90mRun inside Sanctum Desktop for full interactive ConPTY.\x1b[0m\r\n");
          promptFallback(term);

          term.onData((data: string) => {
            if (data === "\x03") {
              if (abortCtrlRef.current) {
                abortCtrlRef.current.abort();
                abortCtrlRef.current = null;
              } else {
                term.write("^C\r\n");
                currentLineRef.current = "";
                promptFallback(term);
              }
              return;
            }
            if (isRunningRef.current) return;
            if (data === "\r") {
              const cmd = currentLineRef.current.trim();
              term.write("\r\n");
              currentLineRef.current = "";
              if (cmd) {
                void executeFallbackCommand(cmd, term);
              } else {
                promptFallback(term);
              }
              return;
            }
            if (data === "\x7f" || data === "\b") {
              if (currentLineRef.current.length > 0) {
                currentLineRef.current = currentLineRef.current.slice(0, -1);
                term.write("\b \b");
              }
              return;
            }
            if (data >= " ") {
              currentLineRef.current += data;
              term.write(data);
            }
          });
        }

        setTimeout(() => term.focus(), 40);
      }
    );

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (hasPty) {
        if (wv?.removeEventListener) {
          wv.removeEventListener("message", handlePtyMessage);
        }
        postPty({ type: "ptyStop" });
        setIsPtyAlive(false);
      }
      if (termInstanceRef.current) {
        try {
          termInstanceRef.current.dispose();
        } catch {}
        termInstanceRef.current = null;
      }
    };
  }, [isOpen, postPty, startPty, promptFallback, executeFallbackCommand]);

  const handleResizeDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(120, Math.min(window.innerHeight * 0.68, startH + (startY - ev.clientY)));
      setPanelHeight(Math.round(next));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        fitAddonRef.current?.fit();
      } catch {}
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleShellChange = (nextShell: ShellKind) => {
    setShell(nextShell);
    shellRef.current = nextShell;
    if (getWebViewBridge()?.postMessage) {
      termInstanceRef.current?.reset();
      startPty(nextShell);
    }
  };

  const handleRestart = () => {
    if (getWebViewBridge()?.postMessage) {
      termInstanceRef.current?.reset();
      startPty(shellRef.current);
    }
  };

  const handleStop = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setIsRunning(false);
    isRunningRef.current = false;
    toast.info("Process termination signaled");
  };

  const handleClear = () => {
    const term = termInstanceRef.current;
    if (!term) return;
    term.clear();
    if (getWebViewBridge()?.postMessage) {
      postPty({ type: "ptyInput", data: "\r" });
      term.focus();
    } else {
      promptFallback(term);
    }
  };

  if (!isOpen) return null;

  const hasWebView = Boolean(getWebViewBridge()?.postMessage);

  return (
    <div
      style={isMaximized ? undefined : { height: `${panelHeight}px` }}
      className={cn(
        "flex flex-col border-t border-border/80 bg-[#0c0d12] overflow-hidden z-30",
        isMaximized ? "absolute inset-0 top-11 z-40" : "shrink-0 w-full",
        className
      )}
    >
      {/* Top Drag-Resize Handle */}
      {!isMaximized && (
        <div
          onMouseDown={handleResizeDrag}
          title="Drag to resize terminal"
          className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-primary/40 transition-colors shrink-0"
        />
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border/60 bg-[#12131a] select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon size={14} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground shrink-0">Terminal</span>
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              isRunning
                ? "bg-amber-400 animate-pulse"
                : hasWebView && !isPtyAlive
                ? "bg-muted-foreground/50"
                : "bg-emerald-400"
            )}
            title={isRunning ? "Running command" : isPtyAlive || !hasWebView ? "Connected" : "Exited"}
          />
          {currentCwd && (
            <span className="text-[11px] text-muted-foreground/80 truncate max-w-[260px]" title={currentCwd}>
              {currentCwd}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={shell}
            onChange={(e) => handleShellChange(e.target.value as ShellKind)}
            className="bg-card/60 border border-border/60 rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none"
            title="Execution Shell"
          >
            <option value="powershell">PowerShell</option>
            <option value="cmd">cmd.exe</option>
            <option value="wsl">WSL (bash)</option>
          </select>

          {isRunning && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              className="h-6 px-2 text-[10px] rounded flex items-center gap-1 font-medium bg-red-600 hover:bg-red-700"
              title="Stop running command"
            >
              <Square size={10} className="fill-current" /> Stop
            </Button>
          )}

          {hasWebView && (
            <button
              type="button"
              onClick={handleRestart}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Restart shell session"
            >
              <RotateCcw size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Clear terminal buffer"
          >
            <Trash2 size={12} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMaximized((v) => !v);
              setTimeout(() => fitAddonRef.current?.fit(), 50);
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title={isMaximized ? "Restore panel size" : "Maximize terminal"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Close Terminal"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        className="flex-1 min-h-0 w-full px-2 py-1.5 overflow-hidden bg-[#0c0d12]"
        ref={containerRef}
        onClick={() => termInstanceRef.current?.focus()}
      />
    </div>
  );
};
