"use client";

import React, { useState, useEffect } from "react";
import { IconCircles, IconPlus, IconDeviceFloppy, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command: string;
  args: string;
  enabled: boolean;
}

const INITIAL_MCP: McpServerConfig[] = [
  {
    id: "filesystem",
    name: "Filesystem Explorer",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem C:\\Users\\aviroop\\Desktop",
    enabled: true,
  },
  {
    id: "github",
    name: "GitHub Operations",
    type: "stdio",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    enabled: false,
  },
];

export const SettingsMcp: React.FC = () => {
  const [servers, setServers] = useState<McpServerConfig[]>(INITIAL_MCP);
  const [plugins, setPlugins] = useState<{ id: string; name?: string; description?: string }[]>([]);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newCommand, setNewCommand] = useState<string>("");
  const [newArgs, setNewArgs] = useState<string>("");

  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.servers) && data.servers.length > 0) {
          setServers(data.servers);
        }
        if (Array.isArray(data?.plugins)) {
          setPlugins(data.plugins);
        }
      })
      .catch(() => {});
  }, []);

  const persistServers = (next: McpServerConfig[]) => {
    setServers(next);
    fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servers: next }),
    }).catch(() => {});
  };

  const toggleServer = (id: string) => {
    const next = servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    persistServers(next);
    toast.success("MCP server state updated");
  };

  const removeServer = (id: string) => {
    const next = servers.filter((s) => s.id !== id);
    persistServers(next);
    toast.success("MCP server removed");
  };

  const handleAddServer = () => {
    if (!newName.trim() || !newCommand.trim()) {
      toast.error("Name and Command are required");
      return;
    }
    const newServer: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: newName.trim(),
      type: "stdio",
      command: newCommand.trim(),
      args: newArgs.trim(),
      enabled: true,
    };
    const next = [...servers, newServer];
    persistServers(next);
    setNewName("");
    setNewCommand("");
    setNewArgs("");
    setIsAdding(false);
    toast.success(`MCP Server ${newServer.name} saved`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Model Context Protocol (MCP)
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect external tools, databases, and local system services via the standard MCP protocol.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="rounded-xl text-xs flex items-center gap-1.5"
        >
          <IconPlus size={14} />
          <span>Add Server</span>
        </Button>
      </div>

      {isAdding && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Register New MCP Server
          </h2>
          <div className="rounded-2xl border border-primary/40 bg-card p-5 space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">Server Name</span>
              <input
                type="text"
                placeholder="Local SQLite Database"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
              />
            </div>

            <div className="space-y-1.5 pt-3 border-t border-border/50">
              <span className="text-xs font-medium text-foreground">Executable Command</span>
              <input
                type="text"
                placeholder="node or npx or python"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
            </div>

            <div className="space-y-1.5 pt-3 border-t border-border/50">
              <span className="text-xs font-medium text-foreground">Arguments</span>
              <input
                type="text"
                placeholder="-y @modelcontextprotocol/server-sqlite --db path/to/db"
                value={newArgs}
                onChange={(e) => setNewArgs(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddServer}
                className="rounded-xl text-xs flex items-center gap-1.5"
              >
                <IconDeviceFloppy size={14} />
                <span>Save Server</span>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Installed Servers */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configured Servers ({servers.length})
        </h2>
        <div className="space-y-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border/70 bg-card p-5 flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <IconCircles size={16} className="text-primary" />
                  <span className="text-xs font-medium text-foreground">{s.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {s.type}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                  {s.command} {s.args}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.enabled}
                  onClick={() => toggleServer(s.id)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                    s.enabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg transition duration-200",
                      s.enabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeServer(s.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Remove server"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {plugins.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Discovered Folder Plugins ({plugins.length})
          </h2>
          <div className="space-y-2">
            {plugins.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/70 bg-card p-4 text-xs">
                <span className="font-medium text-foreground">{p.name || p.id}</span>
                {p.description && <p className="text-muted-foreground mt-0.5">{p.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
