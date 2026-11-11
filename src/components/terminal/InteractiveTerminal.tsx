"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Terminal as TerminalIcon,
  Square,
  Play,
  RotateCcw,
  Trash2,
  ChevronUp,
  ChevronDown,
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

export const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({
  isOpen,
  onClose,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termInstanceRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [shell, setShell] = useState<"powershell" | "cmd" | "wsl">("powershell");
  const [isRunning, setIsRunning] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState(false);
  const currentLineRef = useRef<string>("");
  const abortCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((w) => {
        if (w?.root) setCurrentCwd(w.root);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let disposed = false;

    // Dynamically load xterm & addon-fit in browser
    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || !containerRef.current) return;

      // Clean existing terminal instance if present
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
        convertEol: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);

      termInstanceRef.current = term;
      fitAddonRef.current = fit;

      try {
        fit.fit();
      } catch {}

      term.writeln("\x1b[38;5;208mSanctum Host Terminal (Shared Agent Session)\x1b[0m");
      term.writeln("\x1b[90mConnected to local workspace executor. Output streams in real-time.\x1b[0m\r\n");
      promptUser(term);

      term.onData((data: string) => {
        if (isRunning) return;

        // Enter key
        if (data === "\r") {
          const cmd = currentLineRef.current.trim();
          term.write("\r\n");
          currentLineRef.current = "";
          if (cmd) {
            executeUserCommand(cmd, term);
          } else {
            promptUser(term);
          }
          return;
        }

        // Backspace
        if (data === "\x7f" || data === "\b") {
          if (currentLineRef.current.length > 0) {
            currentLineRef.current = currentLineRef.current.slice(0, -1);
            term.write("\b \b");
          }
          return;
        }

        // Ctrl+C
        if (data === "\x03") {
          term.write("^C\r\n");
          currentLineRef.current = "";
          promptUser(term);
          return;
        }

        // Printable characters
        if (data >= " ") {
          currentLineRef.current += data;
          term.write(data);
        }
      });
    });

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      if (termInstanceRef.current) {
        try {
          termInstanceRef.current.dispose();
        } catch {}
      }
    };
  }, [isOpen]);

  const promptUser = (term: any) => {
    const cwdDisplay = currentCwd ? currentCwd.split(/[\\/]/).pop() || currentCwd : "sanctum";
    term.write(`\x1b[32m${cwdDisplay}\x1b[0m \x1b[38;5;208m$\x1b[0m `);
  };

  const executeUserCommand = async (cmd: string, term: any) => {
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
          shell,
          cwd: currentCwd,
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
      setIsRunning(false);
      abortCtrlRef.current = null;
      promptUser(term);
    }
  };

  const handleStop = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setIsRunning(false);
    toast.info("Process termination signaled");
  };

  const handleClear = () => {
    if (termInstanceRef.current) {
      termInstanceRef.current.clear();
      promptUser(termInstanceRef.current);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col border border-border/80 bg-[#0c0d12]/95 backdrop-blur-2xl shadow-2xl rounded-2xl overflow-hidden z-40 transition-all",
        isMaximized
          ? "fixed inset-4 h-[calc(100vh-2rem)]"
          : "fixed bottom-4 right-6 w-[640px] h-[360px]",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-[#12131a] select-none shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Interactive Terminal</span>
          <span
            className={cn(
              "size-2 rounded-full",
              isRunning ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
            )}
            title={isRunning ? "Running command" : "Idle"}
          />
          {currentCwd && (
            <span className="text-[11px] text-muted-foreground/80 truncate max-w-[200px]" title={currentCwd}>
              {currentCwd}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={shell}
            onChange={(e) => setShell(e.target.value as any)}
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
              setIsMaximized(!isMaximized);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
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
      <div className="flex-1 w-full p-2 overflow-hidden bg-[#0c0d12]" ref={containerRef} />
    </div>
  );
};
