"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  IconCircles,
  IconPlus,
  IconDeviceFloppy,
  IconTrash,
  IconPlugConnected,
  IconRefresh,
  IconEdit,
  IconKey,
  IconWorld,
  IconTerminal2,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconAlertCircle,
  IconCalendar,
  IconMail,
  IconBrandGithub,
  IconBrandSlack,
  IconDatabase,
  IconFolder,
  IconNotes,
  IconCloud,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchWithApproval } from "@/lib/hostBridge";
import { toast } from "sonner";
import type {
  McpServerConfig,
  McpConnectorPreset,
  McpDiscoveredTool,
  McpTransportType,
} from "../../../../core/ai/mcp/client_manager";

interface KeyValueRow {
  key: string;
  value: string;
  placeholder?: string;
  secret?: boolean;
}

interface ServerTestState {
  testing: boolean;
  ok?: boolean;
  latencyMs?: number;
  tools?: McpDiscoveredTool[];
  error?: string;
}

const PRESET_ICON: Record<string, React.ReactNode> = {
  "google-calendar": <IconCalendar size={15} className="text-primary" />,
  gmail: <IconMail size={15} className="text-primary" />,
  "google-drive": <IconCloud size={15} className="text-primary" />,
  github: <IconBrandGithub size={15} className="text-primary" />,
  notion: <IconNotes size={15} className="text-primary" />,
  slack: <IconBrandSlack size={15} className="text-primary" />,
  filesystem: <IconFolder size={15} className="text-primary" />,
  postgres: <IconDatabase size={15} className="text-primary" />,
  "remote-http": <IconWorld size={15} className="text-primary" />,
};

function recordToRows(rec?: Record<string, string>): KeyValueRow[] {
  if (!rec) return [];
  return Object.entries(rec).map(([key, value]) => ({ key, value }));
}

function rowsToRecord(rows: KeyValueRow[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    const v = r.value.trim();
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const SettingsMcp: React.FC = () => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [presets, setPresets] = useState<McpConnectorPreset[]>([]);
  const [plugins, setPlugins] = useState<{ id: string; name?: string; description?: string }[]>([]);
  const [testStates, setTestStates] = useState<Record<string, ServerTestState>>({});
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Form state (Add or Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<McpTransportType>("stdio");
  const [formCommand, setFormCommand] = useState("npx");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPresetId, setFormPresetId] = useState<string | undefined>(undefined);
  const [formDocsHint, setFormDocsHint] = useState<string | undefined>(undefined);
  const [envRows, setEnvRows] = useState<KeyValueRow[]>([]);
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>([]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.servers)) {
        setServers(data.servers);
      }
      if (Array.isArray(data?.presets)) {
        setPresets(data.presets);
      }
      if (Array.isArray(data?.plugins)) {
        setPlugins(data.plugins);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const persistServers = async (next: McpServerConfig[]) => {
    setServers(next);
    try {
      const res = await fetchWithApproval(
        "/api/mcp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servers: next }),
        },
        "mcp_config"
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save MCP configuration");
      }
    } catch {
      toast.error("Failed to persist MCP servers");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormType("stdio");
    setFormCommand("npx");
    setFormArgs("");
    setFormUrl("");
    setFormDescription("");
    setFormPresetId(undefined);
    setFormDocsHint(undefined);
    setEnvRows([]);
    setHeaderRows([]);
    setIsFormOpen(false);
  };

  const openFromPreset = (preset: McpConnectorPreset) => {
    setEditingId(null);
    setFormName(preset.name);
    setFormType(preset.type);
    setFormCommand(preset.command || "npx");
    setFormArgs(preset.args || "");
    setFormUrl(preset.url || "");
    setFormDescription(preset.description);
    setFormPresetId(preset.id);
    setFormDocsHint(preset.docsHint);
    setEnvRows(
      (preset.envHints || []).map((h) => ({
        key: h.key,
        value: "",
        placeholder: h.placeholder,
        secret: h.secret,
      }))
    );
    setHeaderRows(
      (preset.headerHints || []).map((h) => ({
        key: h.key,
        value: "",
        placeholder: h.placeholder,
        secret: h.secret,
      }))
    );
    setIsFormOpen(true);
  };

  const openEditServer = (server: McpServerConfig) => {
    setEditingId(server.id);
    setFormName(server.name);
    setFormType(server.type);
    setFormCommand(server.command || "");
    setFormArgs(server.args || "");
    setFormUrl(server.url || "");
    setFormDescription(server.description || "");
    setFormPresetId(server.presetId);
    setFormDocsHint(undefined);
    setEnvRows(recordToRows(server.env));
    setHeaderRows(recordToRows(server.headers));
    setIsFormOpen(true);
  };

  const handleSaveServer = async () => {
    if (!formName.trim()) {
      toast.error("Server name is required");
      return;
    }
    if (formType === "stdio" && !formCommand.trim()) {
      toast.error("Executable command is required for stdio MCP servers");
      return;
    }
    if ((formType === "http" || formType === "sse") && !formUrl.trim()) {
      toast.error("Endpoint URL is required for HTTP / SSE MCP servers");
      return;
    }

    const baseId =
      editingId ||
      formPresetId ||
      formName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `mcp-${Date.now()}`;

    const uniqueId =
      editingId || !servers.some((s) => s.id === baseId)
        ? baseId
        : `${baseId}-${Date.now().toString().slice(-4)}`;

    const nextServer: McpServerConfig = {
      id: uniqueId,
      name: formName.trim(),
      type: formType,
      description: formDescription.trim() || undefined,
      presetId: formPresetId,
      enabled: editingId ? servers.find((s) => s.id === editingId)?.enabled ?? true : true,
      ...(formType === "stdio"
        ? {
            command: formCommand.trim(),
            args: formArgs.trim(),
            env: rowsToRecord(envRows),
          }
        : {
            url: formUrl.trim(),
            headers: rowsToRecord(headerRows),
          }),
    };

    const next = editingId
      ? servers.map((s) => (s.id === editingId ? nextServer : s))
      : [...servers, nextServer];

    await persistServers(next);
    toast.success(`${nextServer.name} saved to Sanctum MCP harness`);
    resetForm();
  };

  const toggleServer = async (id: string) => {
    const next = servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    await persistServers(next);
    toast.success("MCP connector state updated");
  };

  const removeServer = async (id: string) => {
    const next = servers.filter((s) => s.id !== id);
    await persistServers(next);
    setTestStates((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    toast.success("MCP connector removed");
  };

  const testServer = async (server: McpServerConfig) => {
    setTestStates((prev) => ({ ...prev, [server.id]: { testing: true } }));
    try {
      const res = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server }),
      });
      const data = await res.json();
      setTestStates((prev) => ({
        ...prev,
        [server.id]: {
          testing: false,
          ok: Boolean(data.ok),
          latencyMs: data.latencyMs,
          tools: Array.isArray(data.tools) ? data.tools : [],
          error: data.error,
        },
      }));
      if (data.ok) {
        setExpandedServerId(server.id);
        toast.success(`Connected to ${server.name} (${(data.tools || []).length} tools discovered)`);
      } else {
        toast.error(`${server.name}: ${data.error || "Connection failed"}`);
      }
    } catch (err: any) {
      setTestStates((prev) => ({
        ...prev,
        [server.id]: { testing: false, ok: false, error: err?.message || "Network error" },
      }));
      toast.error(`Failed to test ${server.name}`);
    }
  };

  const refreshAllTools = async () => {
    setRefreshingAll(true);
    try {
      const res = await fetch("/api/mcp/tools?refresh=1");
      const data = await res.json();
      const tools: McpDiscoveredTool[] = Array.isArray(data?.tools) ? data.tools : [];
      const errors: { serverId: string; error: string }[] = Array.isArray(data?.errors) ? data.errors : [];

      const byServer: Record<string, ServerTestState> = {};
      for (const s of servers.filter((x) => x.enabled)) {
        const sTools = tools.filter((t) => t.serverId === s.id);
        const sErr = errors.find((e) => e.serverId === s.id);
        byServer[s.id] = {
          testing: false,
          ok: !sErr,
          tools: sTools,
          error: sErr?.error,
        };
      }
      setTestStates((prev) => ({ ...prev, ...byServer }));
      toast.success(`Harness synced: ${tools.length} live external tool${tools.length === 1 ? "" : "s"} ready`);
    } catch {
      toast.error("Failed to refresh MCP tools");
    } finally {
      setRefreshingAll(false);
    }
  };

  const totalLiveTools = Object.values(testStates).reduce(
    (sum, st) => sum + (st.ok && st.tools ? st.tools.length : 0),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
              External MCP Connectors & Tool Harness
            </h1>
            {totalLiveTools > 0 && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[10px]">
                {totalLiveTools} live tools
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Connect Google Calendar, Gmail, GitHub, Notion, Slack, databases, or any local/remote MCP server.
            Enabled connectors automatically expose their tools to Sanctum chat when Tools are ON.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAllTools}
            disabled={refreshingAll || servers.every((s) => !s.enabled)}
            className="rounded-xl text-xs gap-1.5"
          >
            <IconRefresh size={14} className={cn(refreshingAll && "animate-spin")} />
            <span>Sync Tools</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setIsFormOpen(true);
            }}
            className="rounded-xl text-xs gap-1.5"
          >
            <IconPlus size={14} />
            <span>Custom MCP</span>
          </Button>
        </div>
      </div>

      {/* Add / Edit Connector Form */}
      {isFormOpen && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editingId ? "Edit MCP Connector" : "Configure MCP Connector"}
          </h2>
          <div className="rounded-2xl border border-primary/40 bg-card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Connector Name</label>
                <input
                  type="text"
                  placeholder="Google Calendar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Transport</label>
                <div className="flex gap-1.5">
                  {(["stdio", "http", "sse"] as McpTransportType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={cn(
                        "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-mono uppercase transition-colors",
                        formType === t
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formDocsHint && (
              <div className="rounded-xl bg-muted/50 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                {formDocsHint}
              </div>
            )}

            {formType === "stdio" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Command</label>
                    <input
                      type="text"
                      placeholder="npx / uvx / node / python"
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Arguments</label>
                    <input
                      type="text"
                      placeholder="-y @cocal/google-calendar-mcp"
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <IconKey size={13} className="text-primary" />
                      Environment Variables / Credentials
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEnvRows((r) => [...r, { key: "", value: "" }])}
                      className="h-7 text-[11px] rounded-lg gap-1"
                    >
                      <IconPlus size={12} /> Add Env Var
                    </Button>
                  </div>
                  {envRows.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No environment variables set. Add API keys, OAuth JSON paths, or tokens if required.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {envRows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ENV_KEY"
                            value={row.key}
                            onChange={(e) =>
                              setEnvRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r))
                              )
                            }
                            className="w-2/5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                          />
                          <input
                            type={row.secret ? "password" : "text"}
                            placeholder={row.placeholder || "value"}
                            value={row.value}
                            onChange={(e) =>
                              setEnvRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                              )
                            }
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => setEnvRows((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <label className="text-xs font-medium text-foreground">Remote MCP Endpoint URL</label>
                  <input
                    type="url"
                    placeholder="https://mcp.example.com/mcp"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <IconKey size={13} className="text-primary" />
                      HTTP Headers (Auth / API Keys)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHeaderRows((r) => [...r, { key: "", value: "" }])}
                      className="h-7 text-[11px] rounded-lg gap-1"
                    >
                      <IconPlus size={12} /> Add Header
                    </Button>
                  </div>
                  {headerRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Authorization"
                        value={row.key}
                        onChange={(e) =>
                          setHeaderRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r))
                          )
                        }
                        className="w-2/5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                      />
                      <input
                        type={row.secret ? "password" : "text"}
                        placeholder={row.placeholder || "Bearer ..."}
                        value={row.value}
                        onChange={(e) =>
                          setHeaderRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                          )
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setHeaderRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveServer} className="rounded-xl text-xs gap-1.5">
                <IconDeviceFloppy size={14} />
                <span>{editingId ? "Update Connector" : "Save Connector"}</span>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Configured Connectors */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Connected Servers ({servers.length})
        </h2>
        {servers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-6 text-center space-y-1">
            <p className="text-xs font-medium text-foreground">No external MCP connectors configured yet</p>
            <p className="text-[11px] text-muted-foreground">
              Pick a one-click connector below (Google Calendar, Gmail, GitHub, Notion, Slack, or Remote HTTP) to attach it to Sanctum.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((s) => {
              const st = testStates[s.id];
              const isExpanded = expandedServerId === s.id;
              const envCount = s.env ? Object.keys(s.env).length : 0;
              const headerCount = s.headers ? Object.keys(s.headers).length : 0;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.presetId && PRESET_ICON[s.presetId] ? (
                          PRESET_ICON[s.presetId]
                        ) : s.type === "stdio" ? (
                          <IconTerminal2 size={15} className="text-primary" />
                        ) : (
                          <IconWorld size={15} className="text-primary" />
                        )}
                        <span className="text-xs font-semibold text-foreground">{s.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          {s.type}
                        </span>
                        {(envCount > 0 || headerCount > 0) && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground">
                            {envCount > 0 ? `${envCount} env` : `${headerCount} header`}
                          </span>
                        )}
                        {st && !st.testing && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium",
                              st.ok
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-destructive/10 text-destructive"
                            )}
                          >
                            {st.ok ? <IconCheck size={11} /> : <IconAlertCircle size={11} />}
                            {st.ok
                              ? `${st.tools?.length ?? 0} tools${st.latencyMs ? ` · ${st.latencyMs}ms` : ""}`
                              : "Error"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {s.type === "stdio" ? `${s.command || ""} ${s.args || ""}` : s.url}
                      </p>
                      {st?.error && (
                        <p className="text-[11px] text-destructive leading-snug">{st.error}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={st?.testing}
                        onClick={() => testServer(s)}
                        className="h-7 px-2.5 text-[11px] rounded-lg gap-1"
                      >
                        <IconPlugConnected size={13} className={cn(st?.testing && "animate-pulse")} />
                        <span>{st?.testing ? "Testing..." : "Test"}</span>
                      </Button>

                      {st?.tools && st.tools.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedServerId(isExpanded ? null : s.id)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Show discovered tools"
                        >
                          {isExpanded ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditServer(s)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Edit connector"
                      >
                        <IconEdit size={14} />
                      </button>

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
                        title="Remove connector"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && st?.tools && st.tools.length > 0 && (
                    <div className="pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {st.tools.map((t) => (
                        <div
                          key={t.qualifiedName}
                          className="rounded-lg bg-muted/40 px-2.5 py-1.5 space-y-0.5"
                        >
                          <div className="text-[11px] font-mono font-medium text-foreground truncate">
                            {t.toolName}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">
                            {t.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* One-Click Connector Catalog */}
      {presets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connector Catalog (One-Click Add)
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Standard MCP protocol · local stdio & remote HTTP/SSE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => {
              const alreadyAdded = servers.some((s) => s.presetId === preset.id || s.id === preset.id);
              return (
                <div
                  key={preset.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {PRESET_ICON[preset.id] || <IconCircles size={15} className="text-primary" />}
                        <span className="text-xs font-semibold text-foreground truncate">
                          {preset.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase shrink-0">
                        {preset.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {preset.description}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant={alreadyAdded ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => openFromPreset(preset)}
                    className="w-full h-7 text-[11px] rounded-lg gap-1"
                  >
                    <IconPlus size={12} />
                    <span>{alreadyAdded ? "Add Another Instance" : `Connect ${preset.name}`}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {plugins.length > 0 && (
        <section className="space-y-3">
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
