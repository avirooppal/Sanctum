using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class SseSubscriber {
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public string SessionId { get; }
        private readonly Queue<string> _queue = new Queue<string>();
        private readonly object _lock = new object();
        private readonly AutoResetEvent _signal = new AutoResetEvent(false);
        public volatile bool SlowConsumerDisconnected;
        public volatile bool Closed;

        public SseSubscriber(string sessionId) {
            SessionId = sessionId;
        }

        public bool EnqueueFrame(string sseFrame) {
            lock (_lock) {
                if (Closed) return false;
                if (_queue.Count >= ProtocolConstants.MaxClientBuffer) {
                    SlowConsumerDisconnected = true;
                    Closed = true;
                    _signal.Set();
                    return false;
                }
                _queue.Enqueue(sseFrame);
                _signal.Set();
                return true;
            }
        }

        public string DequeueNext(int waitMs, CancellationToken ct) {
            while (!ct.IsCancellationRequested) {
                lock (_lock) {
                    if (_queue.Count > 0) return _queue.Dequeue();
                    if (Closed) return null;
                }
                _signal.WaitOne(waitMs);
                lock (_lock) {
                    if (_queue.Count > 0) return _queue.Dequeue();
                    if (Closed) return null;
                }
                if (waitMs > 0) return ""; // heartbeat tick
            }
            return null;
        }

        public void Close() {
            lock (_lock) {
                Closed = true;
                _signal.Set();
            }
        }
    }

    public sealed class HarnessToolDescriptor {
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string Category { get; set; } = "builtin";
        public string Safety { get; set; } = "read"; // read | write | exec | network | destructive
        public int TimeoutMs { get; set; } = 30000;
        public int MaxOutputChars { get; set; } = 32768;
        public JObject InputSchema { get; set; } = new JObject();
        public Func<JObject, CancellationToken, string> Execute { get; set; }
    }

    public sealed class HarnessEngine : IDisposable {
        private readonly string _dataRoot;
        private readonly SessionLogStore _store;
        private readonly IModelProvider _provider;
        private readonly HarnessAuditLog _audit;
        private readonly PermissionEngine _permissions;
        private readonly CheckpointService _checkpoints;
        private readonly BackgroundTaskManager _tasks;
        private readonly WorktreeManager _worktrees;
        private readonly HarnessMcpManager _mcp;
        private readonly ExtensionsManager _extensions;
        private readonly WorkspaceTrustManager _workspaceTrust;
        private readonly WorkspaceManager _workspaces;
        private readonly HostVaultService _vault;
        private readonly HostMemoryService _memory;
        private readonly FeedHostService _feed;
        private readonly ModelTierManager _tierManager;
        private readonly HarnessScheduler _scheduler;
        private readonly ConcurrentDictionary<string, JArray> _todos = new ConcurrentDictionary<string, JArray>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, int> _sessionNumCtx = new ConcurrentDictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, bool?> _sessionThink = new ConcurrentDictionary<string, bool?>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, string> _sessionTierOverride = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, HarnessToolDescriptor> _tools = new Dictionary<string, HarnessToolDescriptor>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _activeRuns = new ConcurrentDictionary<string, CancellationTokenSource>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, string> _activeRunIds = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly object _subLock = new object();
        private readonly List<SseSubscriber> _subscribers = new List<SseSubscriber>();
        private readonly object _idemLock = new object();
        private readonly Dictionary<string, LinkedList<KeyValuePair<string, JObject>>> _idempotency = new Dictionary<string, LinkedList<KeyValuePair<string, JObject>>>(StringComparer.OrdinalIgnoreCase);

        public HarnessEngine(SessionLogStore store, IModelProvider provider, string appDataDir = null) {
            _store = store;
            string dataRoot = appDataDir ?? Path.GetDirectoryName(store.SessionsDir);
            _dataRoot = dataRoot;
            EgressHttpFactory.Initialize(dataRoot);
            DataAtRestCrypto.Initialize(dataRoot);
            _provider = provider;
            _audit = new HarnessAuditLog(dataRoot);
            _permissions = new PermissionEngine(dataRoot, _audit);
            _checkpoints = new CheckpointService(dataRoot);
            _tasks = new BackgroundTaskManager();
            _worktrees = new WorktreeManager(dataRoot);
            _mcp = new HarnessMcpManager(dataRoot, this);
            _extensions = new ExtensionsManager(dataRoot);
            _workspaceTrust = new WorkspaceTrustManager(dataRoot);
            _workspaces = new WorkspaceManager(dataRoot);
            _vault = new HostVaultService(_workspaces);
            _memory = new HostMemoryService(dataRoot);
            _feed = new FeedHostService(dataRoot, _audit);
            _tierManager = new ModelTierManager(dataRoot);
            _scheduler = new HarnessScheduler(dataRoot, this);
            RegisterPhase1aTools();
            BuiltinTools.RegisterAll(this, dataRoot);
            OrchestrationTools.RegisterAll(this);
            A2uiService.RegisterTool(this);
            WebTools.RegisterAll(this);
            ThreadMigration.MigrateLegacyThreadsIfNeeded(dataRoot, _store);
            CloudRemovalMigration.RunIfNeeded(dataRoot, _store);
            _store.RecoverAllSessionsOnStartup();
        }

        public SessionLogStore Store => _store;
        public IModelProvider Provider => _provider;
        public HarnessAuditLog Audit => _audit;
        public PermissionEngine Permissions => _permissions;
        public CheckpointService Checkpoints => _checkpoints;
        public BackgroundTaskManager Tasks => _tasks;
        public WorktreeManager Worktrees => _worktrees;
        public HarnessMcpManager Mcp => _mcp;
        public ExtensionsManager Extensions => _extensions;
        public WorkspaceTrustManager WorkspaceTrust => _workspaceTrust;
        public WorkspaceManager Workspaces => _workspaces;
        public HostVaultService Vault => _vault;
        public HostMemoryService Memory => _memory;
        public FeedHostService Feed => _feed;
        public ModelTierManager TierManager => _tierManager;
        public HarnessScheduler Scheduler => _scheduler;
        public int ActiveRunCount => _activeRuns.Count;

        public void Dispose() {
            InterruptAllRuns();
            _scheduler.Dispose();
            _mcp.Dispose();
            _tasks.Dispose();
        }

        private void RegisterPhase1aTools() {
            RegisterTool(new HarnessToolDescriptor {
                Name = "echo",
                Description = "Deterministic echo tool for Phase 1a harness verification.",
                Category = "builtin",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["text"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("text")
                },
                Execute = (args, ct) => args["text"]?.Value<string>() ?? ""
            });

            RegisterTool(new HarnessToolDescriptor {
                Name = "sleep_tool",
                Description = "Cancellable sleep tool for testing timeouts and interrupts.",
                Category = "builtin",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["ms"] = new JObject { ["type"] = "integer" } }
                },
                Execute = (args, ct) => {
                    int ms = Math.Min(10000, Math.Max(10, args["ms"]?.Value<int>() ?? 500));
                    ct.WaitHandle.WaitOne(ms);
                    ct.ThrowIfCancellationRequested();
                    return "slept " + ms + "ms";
                }
            });

            RegisterTool(new HarnessToolDescriptor {
                Name = "big_output",
                Description = "Generates large output to verify blob offloading.",
                Category = "builtin",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["sizeBytes"] = new JObject { ["type"] = "integer" } }
                },
                Execute = (args, ct) => {
                    int sz = Math.Min(ProtocolConstants.MaxBlobBytes, Math.Max(1024, args["sizeBytes"]?.Value<int>() ?? 24576));
                    return new string('A', sz);
                }
            });
        }

        public void RegisterTool(HarnessToolDescriptor tool) {
            _tools[tool.Name] = tool;
            _permissions.RegisterKnownTool(tool.Name);
        }

        public int GetEffectiveNumCtx(string sessionId, string model) {
            var caps = _provider.GetCapabilities(model);
            _sessionNumCtx.TryGetValue(sessionId ?? "", out int reqCtx);
            return ContextEngine.ComputeEffectiveNumCtx(caps.ContextLength, reqCtx);
        }

        public void SetSessionNumCtx(string sessionId, int numCtx) {
            if (!string.IsNullOrEmpty(sessionId) && numCtx > 0) _sessionNumCtx[sessionId] = numCtx;
        }

        public void SetSessionThink(string sessionId, bool? think) {
            if (!string.IsNullOrEmpty(sessionId)) _sessionThink[sessionId] = think;
        }

        public bool? GetSessionThink(string sessionId) {
            if (string.IsNullOrEmpty(sessionId)) return null;
            return _sessionThink.TryGetValue(sessionId, out var t) ? t : null;
        }

        public void SetSessionTierOverride(string sessionId, string tier) {
            if (string.IsNullOrEmpty(sessionId)) return;
            string t = (tier ?? "auto").Trim().ToLowerInvariant();
            if (t == "auto" || string.IsNullOrEmpty(t)) _sessionTierOverride.TryRemove(sessionId, out _);
            else _sessionTierOverride[sessionId] = t;
        }

        public ModelTierProfile GetEffectiveTier(string sessionId, string model) {
            var caps = _provider.GetCapabilities(model);
            string ov = null;
            if (!string.IsNullOrEmpty(sessionId)) _sessionTierOverride.TryGetValue(sessionId, out ov);
            return _tierManager.ResolveTier(model, caps, ov);
        }

        public JObject GetContextBudgetInfo(string sessionId) {
            var sum = _store.BuildSummary(sessionId);
            string model = sum?.Model ?? "mock";
            var caps = _provider.GetCapabilities(model);
            int numCtx = GetEffectiveNumCtx(sessionId, model);
            var msgs = BuildModelMessagesFromLog(sessionId);
            int est = ContextEngine.EstimateTokens(msgs);
            double pct = numCtx > 0 ? Math.Round((est * 100.0) / numCtx, 1) : 0;
            return new JObject {
                ["numCtx"] = numCtx,
                ["modelMaxContext"] = caps.ContextLength,
                ["estimatedTokens"] = est,
                ["utilizationPct"] = pct,
                ["nearTruncation"] = est >= (int)(numCtx * 0.80)
            };
        }

        public void EmitA2uiSurfaceEvent(string sessionId, JObject payload) {
            if (string.IsNullOrEmpty(sessionId) || payload == null) return;
            AppendAndBroadcast(sessionId, "a2ui_surface", payload, null, durableFlush: true);
        }

        public (int status, JObject body) HandleA2uiUserAction(string sessionId, JObject body) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });

            string idempotencyKey = (body["idempotencyKey"]?.Value<string>() ?? "").Trim();
            string surfaceId = (body["surfaceId"]?.Value<string>() ?? "").Trim();
            string componentId = (body["componentId"]?.Value<string>() ?? "").Trim();
            string actionName = (body["actionName"]?.Value<string>() ?? "").Trim();
            if (string.IsNullOrEmpty(surfaceId) || string.IsNullOrEmpty(actionName)) {
                return (400, new JObject { ["error"] = "surfaceId and actionName are required." });
            }

            if (!string.IsNullOrEmpty(idempotencyKey) && TryGetIdempotentResult(sessionId, "a2ui:" + idempotencyKey, out var cached)) {
                return (200, cached);
            }

            var dataObj = body["data"] as JObject ?? new JObject();
            string rawData = dataObj.ToString(Newtonsoft.Json.Formatting.None);
            if (Encoding.UTF8.GetByteCount(rawData) > A2uiService.MaxDataModelBytes) {
                return (400, new JObject { ["error"] = "Action data payload exceeds size cap." });
            }

            var evt = AppendAndBroadcast(sessionId, "a2ui_user_action", new JObject {
                ["surfaceId"] = surfaceId,
                ["componentId"] = componentId,
                ["actionName"] = actionName,
                ["data"] = dataObj,
                ["untrusted"] = true
            }, null, durableFlush: true);

            // Action NEVER executes tools directly — it only records an event & optionally forwards as untrusted user input
            var resp = new JObject {
                ["ok"] = true,
                ["seq"] = evt.Seq,
                ["surfaceId"] = surfaceId,
                ["actionName"] = actionName,
                ["toolsExecuted"] = false
            };
            if (!string.IsNullOrEmpty(idempotencyKey)) {
                RecordIdempotentResult(sessionId, "a2ui:" + idempotencyKey, resp);
            }
            return (200, resp);
        }

        public JArray ListToolsJson() {
            var arr = new JArray();
            foreach (var t in _tools.Values.OrderBy(x => x.Name, StringComparer.Ordinal)) {
                arr.Add(new JObject {
                    ["name"] = t.Name,
                    ["description"] = t.Description,
                    ["category"] = t.Category,
                    ["safety"] = t.Safety,
                    ["timeoutMs"] = t.TimeoutMs,
                    ["maxOutputChars"] = t.MaxOutputChars,
                    ["inputSchema"] = t.InputSchema
                });
            }
            return arr;
        }

        public bool TryGetIdempotentResult(string sessionId, string key, out JObject cached) {
            cached = null;
            if (string.IsNullOrWhiteSpace(key)) return false;
            lock (_idemLock) {
                if (!_idempotency.TryGetValue(sessionId, out var list)) return false;
                foreach (var kv in list) {
                    if (kv.Key == key) {
                        cached = (JObject)kv.Value.DeepClone();
                        return true;
                    }
                }
                return false;
            }
        }

        public void RecordIdempotentResult(string sessionId, string key, JObject response) {
            if (string.IsNullOrWhiteSpace(key) || response == null) return;
            lock (_idemLock) {
                if (!_idempotency.TryGetValue(sessionId, out var list)) {
                    list = new LinkedList<KeyValuePair<string, JObject>>();
                    _idempotency[sessionId] = list;
                }
                list.AddLast(new KeyValuePair<string, JObject>(key, (JObject)response.DeepClone()));
                while (list.Count > ProtocolConstants.IdempotencyCacheSize) list.RemoveFirst();
            }
        }

        public SseSubscriber Subscribe(string sessionId) {
            var sub = new SseSubscriber(sessionId);
            lock (_subLock) _subscribers.Add(sub);
            return sub;
        }

        public void Unsubscribe(SseSubscriber sub) {
            if (sub == null) return;
            sub.Close();
            lock (_subLock) _subscribers.Remove(sub);
        }

        private void BroadcastEvent(HarnessEvent evt) {
            string json = CanonicalJson.SerializeObject(evt);
            string frame = $"id: {evt.Seq}\nevent: {evt.Type}\ndata: {json}\n\n";
            List<SseSubscriber> targets;
            lock (_subLock) {
                targets = _subscribers.Where(s => string.Equals(s.SessionId, evt.SessionId, StringComparison.OrdinalIgnoreCase)).ToList();
            }
            foreach (var sub in targets) {
                if (!sub.EnqueueFrame(frame)) {
                    lock (_subLock) _subscribers.Remove(sub);
                }
            }
        }

        private void BroadcastEphemeralDelta(string sessionId, string runId, string type, string delta) {
            var evt = new HarnessEvent {
                V = ProtocolConstants.Version,
                Seq = 0, // ephemeral live delta; coalesced into durable checkpoints/final message
                Ts = DateTime.UtcNow.ToString("o"),
                SessionId = sessionId,
                RunId = runId,
                Type = type,
                Payload = new JObject { ["delta"] = SecretsRedactor.Redact(delta) }
            };
            BroadcastEvent(evt);
        }

        private HarnessEvent AppendAndBroadcast(string sessionId, string type, JObject payload, string runId = null, bool durableFlush = true) {
            var evt = _store.Append(sessionId, type, payload, runId, durableFlush);
            BroadcastEvent(evt);
            return evt;
        }

        public SessionSummary CreateSession(
            string title,
            string workspace,
            string mode,
            string autonomy,
            string model,
            bool unattended = false,
            string role = null,
            string parentSessionId = null,
            string worktreePath = null,
            string workspaceId = null) {
            string id = "s_" + Guid.NewGuid().ToString("N").Substring(0, 12);
            string safeMode = (mode == "plan" || mode == "build") ? mode : "build";
            string safeAutonomy = (autonomy == "ask_all" || autonomy == "auto_reads") ? autonomy : "auto_reads";
            string resolvedWsId = (workspaceId ?? "").Trim();
            string resolvedWsPath = workspace ?? "";
            if (!string.IsNullOrEmpty(resolvedWsId)) {
                var wsRec = _workspaces.GetById(resolvedWsId);
                if (wsRec != null && string.IsNullOrEmpty(resolvedWsPath)) {
                    resolvedWsPath = wsRec.RootPath ?? "";
                }
            } else {
                if (!string.IsNullOrWhiteSpace(resolvedWsPath)) {
                    var matched = _workspaces.ResolveSelector(resolvedWsPath);
                    if (matched != null) resolvedWsId = matched.Id;
                }
                if (string.IsNullOrEmpty(resolvedWsId)) {
                    resolvedWsId = _workspaces.LastUsedWorkspaceId ?? "";
                }
            }
            var payload = new JObject {
                ["title"] = string.IsNullOrWhiteSpace(title) ? "New Session" : title.Trim(),
                ["workspaceId"] = resolvedWsId,
                ["workspace"] = resolvedWsPath,
                ["mode"] = safeMode,
                ["autonomy"] = safeAutonomy,
                ["unattended"] = unattended,
                ["model"] = string.IsNullOrWhiteSpace(model) ? "mock" : model.Trim()
            };
            if (!string.IsNullOrWhiteSpace(role)) payload["role"] = role.Trim();
            if (!string.IsNullOrWhiteSpace(parentSessionId)) payload["parentSessionId"] = parentSessionId.Trim();
            if (!string.IsNullOrWhiteSpace(worktreePath)) payload["worktreePath"] = worktreePath.Trim();
            AppendAndBroadcast(id, "session_started", payload, durableFlush: true);
            return _store.BuildSummary(id);
        }

        public void UpdateTodos(string sessionId, JArray items) {
            if (string.IsNullOrWhiteSpace(sessionId) || !_store.SessionExists(sessionId)) {
                throw new KeyNotFoundException("Session not found.");
            }
            var cloned = (JArray)(items?.DeepClone() ?? new JArray());
            _todos[sessionId] = cloned;
            AppendAndBroadcast(sessionId, "todo_updated", new JObject { ["items"] = cloned }, durableFlush: true);
        }

        public JArray GetTodos(string sessionId) {
            if (_todos.TryGetValue(sessionId, out var cached)) return (JArray)cached.DeepClone();
            var events = _store.ReadEvents(sessionId, 0);
            for (int i = events.Count - 1; i >= 0; i--) {
                if (events[i].Type == "todo_updated" && events[i].Payload?["items"] is JArray arr) {
                    _todos[sessionId] = (JArray)arr.DeepClone();
                    return (JArray)arr.DeepClone();
                }
            }
            return new JArray();
        }

        public JObject CompactSession(string sessionId, int keepRecentMessages = 2) {
            if (!_store.SessionExists(sessionId)) throw new KeyNotFoundException("Session not found.");
            var events = _store.ReadEvents(sessionId, 0);
            var payload = ContextEngine.BuildCompactionPayload(events, Math.Max(1, keepRecentMessages));
            if (payload == null) {
                return new JObject { ["compacted"] = false, ["reason"] = "Not enough messages to compact." };
            }
            var evt = AppendAndBroadcast(sessionId, "compaction", payload, durableFlush: true);
            var resp = (JObject)payload.DeepClone();
            resp["compacted"] = true;
            resp["seq"] = evt.Seq;
            return resp;
        }

        public (int status, JObject body) VerifySession(string sessionId, string command, bool viaTrustedChannel) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
            string cmd = string.IsNullOrWhiteSpace(command) ? "git status" : command.Trim();
            _tools.TryGetValue("run_command", out var runCmdTool);
            var cmdArgs = new JObject { ["command"] = cmd };
            var decision = _permissions.Evaluate(sessionId, sum.Mode, sum.Autonomy, runCmdTool, cmdArgs, sum.Unattended);
            if (decision.Kind == PermissionDecisionKind.Deny) {
                return (403, new JObject { ["error"] = decision.Reason, ["code"] = "permission_denied" });
            }
            if (decision.Kind == PermissionDecisionKind.Ask && !viaTrustedChannel) {
                return (403, new JObject { ["error"] = "Non-allowlisted verification command requires trusted channel.", ["code"] = "trusted_channel_required" });
            }

            string ws = string.IsNullOrWhiteSpace(sum.Workspace) ? Environment.CurrentDirectory : sum.Workspace;
            cmdArgs["_workspace"] = ws;
            string output = "";
            bool ok = true;
            try {
                using (var cts = new CancellationTokenSource(30000)) {
                    output = runCmdTool.Execute(cmdArgs, cts.Token) ?? "";
                }
                ok = !output.Contains("\"exitCode\":1") && !output.StartsWith("Tool error:");
            } catch (Exception ex) {
                ok = false;
                output = ex.Message;
            }

            var result = new JObject {
                ["command"] = SecretsRedactor.Redact(cmd),
                ["ok"] = ok,
                ["output"] = SecretsRedactor.Redact(output)
            };
            AppendAndBroadcast(sessionId, "verification_result", result, durableFlush: true);
            return (200, result);
        }

        public JObject SpawnSubagentAndWait(
            string parentSessionId,
            string role,
            string prompt,
            string model,
            string mode,
            bool useWorktree,
            CancellationToken ct) {
            var parent = _store.BuildSummary(parentSessionId);
            if (parent == null) throw new KeyNotFoundException("Parent session not found.");

            string childWorkspace = parent.Workspace;
            string wtPath = null;
            string provisionalId = "sub_" + Guid.NewGuid().ToString("N").Substring(0, 8);
            if (useWorktree && !string.IsNullOrWhiteSpace(parent.Workspace)) {
                var wt = _worktrees.CreateWorktree(parent.Workspace, provisionalId);
                wtPath = wt["worktreePath"]?.Value<string>();
                if (!string.IsNullOrEmpty(wtPath)) childWorkspace = wtPath;
            }

            var child = CreateSession(
                title: $"[{role}] {(prompt.Length > 36 ? prompt.Substring(0, 36) : prompt)}",
                workspace: childWorkspace,
                mode: string.IsNullOrWhiteSpace(mode) ? parent.Mode : mode,
                autonomy: parent.Autonomy,
                model: string.IsNullOrWhiteSpace(model) ? parent.Model : model,
                unattended: parent.Unattended,
                role: role,
                parentSessionId: parentSessionId,
                worktreePath: wtPath,
                workspaceId: parent.WorkspaceId);

            AppendAndBroadcast(parentSessionId, "subagent_started", new JObject {
                ["childSessionId"] = child.SessionId,
                ["role"] = role,
                ["model"] = child.Model,
                ["worktreePath"] = wtPath
            }, durableFlush: true);

            var (_, statusCode, runResp) = StartRun(child.SessionId, prompt, new RunBudgets { MaxSteps = 8, MaxWallTimeMs = 45000 });
            if (statusCode < 200 || statusCode >= 300) {
                return new JObject { ["ok"] = false, ["childSessionId"] = child.SessionId, ["error"] = runResp["error"] };
            }

            // Wait for child run completion or parent cancellation
            var deadline = DateTime.UtcNow.AddSeconds(45);
            while (DateTime.UtcNow < deadline && _activeRuns.ContainsKey(child.SessionId)) {
                if (ct.IsCancellationRequested) {
                    InterruptRun(child.SessionId);
                    break;
                }
                Thread.Sleep(40);
            }

            var childEvents = _store.ReadEvents(child.SessionId, 0);
            string lastAssistant = "";
            string stopReason = "completed";
            foreach (var e in childEvents) {
                if (e.Type == "assistant_message") lastAssistant = e.Payload?["content"]?.Value<string>() ?? lastAssistant;
                if (e.Type == "run_finished") stopReason = e.Payload?["stopReason"]?.Value<string>() ?? stopReason;
            }

            var finishedPayload = new JObject {
                ["childSessionId"] = child.SessionId,
                ["role"] = role,
                ["stopReason"] = stopReason,
                ["worktreePath"] = wtPath,
                ["summary"] = lastAssistant
            };
            AppendAndBroadcast(parentSessionId, "subagent_finished", finishedPayload, durableFlush: true);
            return finishedPayload;
        }

        public JArray ListAgents() {
            var sessions = ListSessions();
            var arr = new JArray();
            foreach (var s in sessions) {
                bool isRunning = !string.IsNullOrEmpty(s.ActiveRunId);
                arr.Add(new JObject {
                    ["sessionId"] = s.SessionId,
                    ["parentSessionId"] = s.ParentSessionId,
                    ["role"] = string.IsNullOrWhiteSpace(s.Role) ? "primary" : s.Role,
                    ["title"] = s.Title,
                    ["mode"] = s.Mode,
                    ["autonomy"] = s.Autonomy,
                    ["model"] = s.Model,
                    ["workspace"] = s.Workspace,
                    ["worktreePath"] = s.WorktreePath,
                    ["status"] = isRunning ? "running" : "idle",
                    ["activeRunId"] = s.ActiveRunId,
                    ["lastSeq"] = s.LastSeq,
                    ["updatedAt"] = s.UpdatedAt
                });
            }
            return arr;
        }

        public JObject CreateCheckpoint(string sessionId, string label = null) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) throw new KeyNotFoundException("Session not found.");
            var cp = _checkpoints.CreateCheckpoint(sessionId, string.IsNullOrWhiteSpace(sum.Workspace) ? Environment.CurrentDirectory : sum.Workspace, label);
            AppendAndBroadcast(sessionId, "checkpoint_created", new JObject {
                ["checkpointId"] = cp["checkpointId"],
                ["label"] = cp["label"],
                ["fileCount"] = cp["fileCount"]
            }, durableFlush: true);
            return cp;
        }

        public JObject ComputeDiff(string sessionId, string checkpointId) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) throw new KeyNotFoundException("Session not found.");
            return _checkpoints.ComputeDiff(checkpointId, sum.Workspace);
        }

        public JObject Rewind(string sessionId, string scope, string checkpointId, long? forkAfterSeq) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) throw new KeyNotFoundException("Session not found.");
            string normScope = string.IsNullOrWhiteSpace(scope) ? "files" : scope.Trim().ToLowerInvariant();
            var result = new JObject { ["sessionId"] = sessionId, ["scope"] = normScope };

            if (normScope == "files" || normScope == "both") {
                if (string.IsNullOrWhiteSpace(checkpointId)) throw new ArgumentException("checkpointId is required for file rewind.");
                result["files"] = _checkpoints.RewindFiles(checkpointId, sum.Workspace);
                AppendAndBroadcast(sessionId, "files_rewound", new JObject {
                    ["checkpointId"] = checkpointId,
                    ["restoredFiles"] = result["files"]["restoredFiles"],
                    ["removedFiles"] = result["files"]["removedFiles"]
                }, durableFlush: true);
            }
            if (normScope == "conversation" || normScope == "both") {
                long targetSeq = forkAfterSeq ?? 1;
                var forked = ForkSession(sessionId, targetSeq, sum.Title + " (rewind)");
                result["rewoundSession"] = JObject.FromObject(forked);
            }
            return result;
        }

        public (int status, JObject body) StartBackgroundTask(string sessionId, string command, bool viaTrustedChannel) {
            var sum = _store.BuildSummary(sessionId);
            if (sum == null) return (404, new JObject { ["error"] = "Session not found." });
            _tools.TryGetValue("run_command", out var runCmdTool);
            var cmdArgs = new JObject { ["command"] = command ?? "" };
            var decision = _permissions.Evaluate(sessionId, sum.Mode, sum.Autonomy, runCmdTool, cmdArgs, sum.Unattended);
            if (decision.Kind == PermissionDecisionKind.Deny) {
                return (403, new JObject { ["error"] = decision.Reason, ["code"] = "permission_denied" });
            }
            if (decision.Kind == PermissionDecisionKind.Ask && !viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Starting a non-allowlisted background task requires a trusted channel.",
                    ["code"] = "trusted_channel_required"
                });
            }
            var task = _tasks.StartTask(sessionId, command, string.IsNullOrWhiteSpace(sum.Workspace) ? Environment.CurrentDirectory : sum.Workspace);
            AppendAndBroadcast(sessionId, "background_task_started", task, durableFlush: true);
            return (201, task);
        }

        public SessionSummary ForkSession(string parentSessionId, long forkAfterSeq, string title = null) {
            var parent = _store.BuildSummary(parentSessionId);
            if (parent == null) throw new KeyNotFoundException("Parent session not found.");
            long clamped = Math.Min(Math.Max(1, forkAfterSeq), parent.LastSeq);
            string childId = "s_" + Guid.NewGuid().ToString("N").Substring(0, 12);
            _store.SeedForkSequence(childId, clamped);
            AppendAndBroadcast(childId, "session_started", new JObject {
                ["title"] = string.IsNullOrWhiteSpace(title) ? (parent.Title + " (fork)") : title.Trim(),
                ["workspaceId"] = parent.WorkspaceId ?? "",
                ["workspace"] = parent.Workspace,
                ["mode"] = parent.Mode,
                ["autonomy"] = parent.Autonomy,
                ["model"] = parent.Model,
                ["parentSessionId"] = parentSessionId,
                ["forkAfterSeq"] = clamped
            }, durableFlush: true);
            return _store.BuildSummary(childId);
        }

        public SessionSummary GetSessionSummary(string sessionId) {
            var summary = _store.BuildSummary(sessionId);
            if (summary != null && _activeRunIds.TryGetValue(sessionId, out var runId)) {
                summary.ActiveRunId = runId;
            }
            return summary;
        }

        public List<SessionSummary> ListSessions(string workspaceId = null, bool allWorkspaces = false) {
            var list = _store.ListSessions(workspaceId, allWorkspaces);
            foreach (var s in list) {
                if (_activeRunIds.TryGetValue(s.SessionId, out var runId)) s.ActiveRunId = runId;
            }
            return list;
        }

        public JObject GetAttentionInbox() {
            var items = new JArray();
            var byWs = new Dictionary<string, (int running, int attention)>(StringComparer.OrdinalIgnoreCase);

            // Count active runs per workspace
            foreach (var kv in _activeRunIds) {
                var sum = _store.BuildSummary(kv.Key);
                string wsId = sum?.WorkspaceId ?? "";
                if (!byWs.TryGetValue(wsId, out var c)) c = (0, 0);
                byWs[wsId] = (c.running + 1, c.attention);
            }

            // Collect pending approvals across all workspaces
            var pendingList = _permissions.ListPendingApprovals();
            foreach (var p in pendingList) {
                string wsId = p.WorkspaceId ?? "";
                if (!byWs.TryGetValue(wsId, out var c)) c = (0, 0);
                byWs[wsId] = (c.running, c.attention + 1);
                items.Add(new JObject {
                    ["kind"] = "approval_requested",
                    ["approvalId"] = p.ApprovalId,
                    ["sessionId"] = p.SessionId,
                    ["runId"] = p.RunId,
                    ["callId"] = p.CallId,
                    ["workspaceId"] = wsId,
                    ["workspaceName"] = p.WorkspaceName,
                    ["workspaceRoot"] = p.WorkspaceRoot,
                    ["tool"] = p.ToolName,
                    ["riskClass"] = p.RiskClass,
                    ["cardText"] = p.HostCardText
                });
            }

            var byWsJson = new JObject();
            int totalRunning = 0, totalAttention = 0;
            foreach (var kv in byWs) {
                totalRunning += kv.Value.running;
                totalAttention += kv.Value.attention;
                byWsJson[kv.Key] = new JObject {
                    ["runningCount"] = kv.Value.running,
                    ["attentionCount"] = kv.Value.attention
                };
            }
            return new JObject {
                ["totalRunning"] = totalRunning,
                ["totalAttention"] = totalAttention,
                ["byWorkspace"] = byWsJson,
                ["items"] = items
            };
        }

        public (int status, JObject body) TransferBetweenWorkspaces(JObject body, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Cross-workspace transfer or sharing requires the trusted channel.",
                    ["code"] = "trusted_channel_required"
                });
            }
            string kind = (body["kind"]?.Value<string>() ?? "").Trim().ToLowerInvariant();
            string sourceWsId = (body["sourceWorkspaceId"]?.Value<string>() ?? "").Trim();
            string targetWsId = (body["targetWorkspaceId"]?.Value<string>() ?? "").Trim();
            string targetScope = (body["targetScope"]?.Value<string>() ?? "").Trim().ToLowerInvariant();
            string itemId = (body["itemId"]?.Value<string>() ?? "").Trim();

            if (string.IsNullOrEmpty(sourceWsId) || string.IsNullOrEmpty(itemId)) {
                return (400, new JObject { ["error"] = "sourceWorkspaceId and itemId are required." });
            }
            if (kind == "memory") {
                var srcMem = _memory.ListAll(sourceWsId, includeGlobal: false);
                var facts = srcMem["facts"] as JArray;
                JObject found = null;
                if (facts != null) {
                    foreach (JObject f in facts) {
                        if (string.Equals(f["id"]?.Value<string>(), itemId, StringComparison.OrdinalIgnoreCase)) { found = f; break; }
                    }
                }
                if (found == null) return (404, new JObject { ["error"] = "Source memory item not found." });
                bool toGlobal = targetScope == "global" || string.IsNullOrEmpty(targetWsId);
                if (!toGlobal && _workspaces.GetById(targetWsId) == null) return (404, new JObject { ["error"] = "Target workspace not found." });
                var saved = _memory.Save(
                    found["content"]?.Value<string>() ?? "",
                    found["category"]?.Value<string>() ?? "fact",
                    "user",
                    "",
                    found["pinned"]?.Value<bool>() ?? false,
                    workspaceId: toGlobal ? null : targetWsId,
                    scope: toGlobal ? "global" : "workspace");
                return (200, new JObject { ["ok"] = true, ["kind"] = "memory", ["transferred"] = saved });
            }
            if (kind == "vault") {
                if (_workspaces.GetById(targetWsId) == null) return (404, new JObject { ["error"] = "Target workspace not found." });
                var srcVault = _vault.List(sourceWsId);
                var docs = srcVault["documents"] as JArray;
                JObject found = null;
                if (docs != null) {
                    foreach (JObject d in docs) {
                        if (string.Equals(d["id"]?.Value<string>(), itemId, StringComparison.OrdinalIgnoreCase)) { found = d; break; }
                    }
                }
                if (found == null) return (404, new JObject { ["error"] = "Source vault document not found." });
                var (st, added) = _vault.AddDocument(
                    targetWsId,
                    found["title"]?.Value<string>() ?? "Shared Document",
                    found["collection"]?.Value<string>() ?? "Shared",
                    found["content"]?.Value<string>() ?? "");
                return (st == 201 ? 200 : st, new JObject { ["ok"] = st == 201, ["kind"] = "vault", ["transferred"] = added });
            }
            return (400, new JObject { ["error"] = "Unsupported transfer kind. Use 'memory' or 'vault'." });
        }

        public (int status, JObject body) ExportWorkspaceData(string workspaceId) {
            var rec = _workspaces.GetById(workspaceId);
            if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
            return (200, new JObject {
                ["bundleVersion"] = 1,
                ["sanctumDataOnly"] = true,
                ["exportedAt"] = DateTime.UtcNow.ToString("o"),
                ["workspace"] = new JObject {
                    ["name"] = rec.Name,
                    ["color"] = rec.Color,
                    ["icon"] = rec.Icon,
                    ["settingsOverrides"] = JObject.FromObject(rec.SettingsOverrides ?? new WorkspaceSettingsOverrides())
                },
                ["memory"] = _memory.ListAll(rec.Id, includeGlobal: false)["facts"] ?? new JArray(),
                ["vault"] = _vault.List(rec.Id)["documents"] ?? new JArray(),
                ["uiState"] = _workspaces.LoadUiState(rec.Id) ?? new JObject(),
                ["sessionCount"] = ListSessions(rec.Id, allWorkspaces: false).Count
            });
        }

        public (int status, JObject body) ImportWorkspaceData(JObject bundle, string overrideName = null, string overrideRootPath = null) {
            if (bundle == null || !(bundle["workspace"] is JObject wsMeta)) {
                return (400, new JObject { ["error"] = "Invalid workspace export bundle." });
            }
            string name = !string.IsNullOrWhiteSpace(overrideName) ? overrideName.Trim() : (wsMeta["name"]?.Value<string>() ?? "Imported Workspace");
            string color = wsMeta["color"]?.Value<string>() ?? "#6366f1";
            string icon = wsMeta["icon"]?.Value<string>() ?? "folder";
            var ov = wsMeta["settingsOverrides"]?.ToObject<WorkspaceSettingsOverrides>();
            var (st, created) = _workspaces.CreateWorkspace(name, overrideRootPath, color, icon, null, ov);
            if (st != 201) return (st, created);
            string newId = created["id"]?.Value<string>() ?? "";

            int memCount = 0;
            if (bundle["memory"] is JArray mems) {
                foreach (JObject m in mems) {
                    string c = m["content"]?.Value<string>() ?? "";
                    if (string.IsNullOrWhiteSpace(c)) continue;
                    _memory.Save(c, m["category"]?.Value<string>() ?? "fact", "user", "", m["pinned"]?.Value<bool>() ?? false, workspaceId: newId);
                    memCount++;
                }
            }
            int vaultCount = 0;
            if (bundle["vault"] is JArray docs) {
                foreach (JObject d in docs) {
                    string title = d["title"]?.Value<string>() ?? "";
                    string content = d["content"]?.Value<string>() ?? "";
                    if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(content)) continue;
                    _vault.AddDocument(newId, title, d["collection"]?.Value<string>() ?? "General", content);
                    vaultCount++;
                }
            }
            if (bundle["uiState"] is JObject ui) {
                _workspaces.SaveUiState(newId, ui);
            }
            created["importedMemoryCount"] = memCount;
            created["importedVaultCount"] = vaultCount;
            return (201, created);
        }

        public void SetMode(string sessionId, string mode) {
            if (mode != "plan" && mode != "build") throw new ArgumentException("Mode must be 'plan' or 'build'.");
            if (!_store.SessionExists(sessionId)) throw new KeyNotFoundException("Session not found.");
            AppendAndBroadcast(sessionId, "mode_changed", new JObject { ["mode"] = mode }, durableFlush: true);
        }

        public void SetAutonomy(string sessionId, string autonomy, bool viaTrustedChannel) {
            if (autonomy != "ask_all" && autonomy != "auto_reads" && autonomy != "full_auto") {
                throw new ArgumentException("Autonomy must be 'ask_all', 'auto_reads', or 'full_auto'.");
            }
            if (autonomy == "full_auto" && !viaTrustedChannel) {
                throw new UnauthorizedAccessException("Switching autonomy to full_auto requires native dialog or CLI TTY confirmation.");
            }
            if (!_store.SessionExists(sessionId)) throw new KeyNotFoundException("Session not found.");
            AppendAndBroadcast(sessionId, "autonomy_changed", new JObject { ["autonomy"] = autonomy }, durableFlush: true);
        }

        public void SetModel(string sessionId, string model) {
            if (string.IsNullOrWhiteSpace(model)) throw new ArgumentException("Model is required.");
            if (!_store.SessionExists(sessionId)) throw new KeyNotFoundException("Session not found.");
            AppendAndBroadcast(sessionId, "model_changed", new JObject { ["model"] = model.Trim() }, durableFlush: true);
        }

        public bool InterruptRun(string sessionId) {
            if (_activeRuns.TryGetValue(sessionId, out var cts)) {
                try { cts.Cancel(); } catch { }
                return true;
            }
            return false;
        }

        public void InterruptAllRuns() {
            foreach (var kv in _activeRuns) {
                try { kv.Value.Cancel(); } catch { }
            }
        }

        public (bool ok, int statusCode, JObject response) StartRun(
            string sessionId,
            string content,
            RunBudgets budgets = null,
            string idempotencyKey = null) {
            if (!_store.SessionExists(sessionId)) {
                return (false, 404, new JObject { ["error"] = "Session not found." });
            }
            if (TryGetIdempotentResult(sessionId, idempotencyKey, out var cached)) {
                return (true, 202, cached);
            }

            var cts = new CancellationTokenSource();
            if (!_activeRuns.TryAdd(sessionId, cts)) {
                _activeRunIds.TryGetValue(sessionId, out var currentRun);
                return (false, 409, new JObject {
                    ["error"] = "A run is already active on this session.",
                    ["code"] = "run_in_progress",
                    ["activeRunId"] = currentRun ?? ""
                });
            }

            string runId = "r_" + Guid.NewGuid().ToString("N").Substring(0, 12);
            _activeRunIds[sessionId] = runId;
            budgets = budgets ?? new RunBudgets();

            var userEvt = AppendAndBroadcast(sessionId, "user_message", new JObject {
                ["role"] = "user",
                ["content"] = content ?? ""
            }, runId, durableFlush: true);

            AppendAndBroadcast(sessionId, "run_started", new JObject {
                ["runId"] = runId,
                ["budgets"] = JObject.FromObject(budgets)
            }, runId, durableFlush: true);

            var resp = new JObject {
                ["sessionId"] = sessionId,
                ["runId"] = runId,
                ["seq"] = userEvt.Seq,
                ["status"] = "running"
            };
            RecordIdempotentResult(sessionId, idempotencyKey, resp);

            ThreadPool.QueueUserWorkItem(_ => ExecuteLoop(sessionId, runId, budgets, cts));
            return (true, 202, resp);
        }

        private void ExecuteLoop(string sessionId, string runId, RunBudgets budgets, CancellationTokenSource cts) {
            string stopReason = "completed";
            var sw = Stopwatch.StartNew();
            int totalTokens = 0;
            var callSignatures = new List<string>();

            try {
                var summary = _store.BuildSummary(sessionId);
                string model = summary?.Model ?? "mock";
                var tierProfile = GetEffectiveTier(sessionId, model);
                int effectiveMaxSteps = Math.Min(budgets.MaxSteps, tierProfile.MaxSteps);
                var history = BuildModelMessagesFromLog(sessionId);
                var toolsJson = _tierManager.FilterToolsForTier(ListToolsJson(), tierProfile);

                for (int step = 0; step < effectiveMaxSteps; step++) {
                    cts.Token.ThrowIfCancellationRequested();
                    if (sw.ElapsedMilliseconds > budgets.MaxWallTimeMs) {
                        stopReason = "max_wall_time";
                        break;
                    }

                    int effectiveNumCtx = GetEffectiveNumCtx(sessionId, model);
                    int estPromptTokens = ContextEngine.EstimateTokens(history);
                    if (estPromptTokens >= (int)(effectiveNumCtx * 0.80)) {
                        AppendAndBroadcast(sessionId, "context_warning", new JObject {
                            ["estimatedTokens"] = estPromptTokens,
                            ["numCtx"] = effectiveNumCtx,
                            ["willTruncate"] = true,
                            ["autoCompacted"] = true
                        }, runId, durableFlush: false);
                        CompactSession(sessionId, keepRecentMessages: 2);
                        history = BuildModelMessagesFromLog(sessionId);
                        estPromptTokens = ContextEngine.EstimateTokens(history);
                    }

                    var contentBuf = new StringBuilder();
                    var reasoningBuf = new StringBuilder();
                    DateTime lastCheckpoint = DateTime.UtcNow;
                    int charsSinceCheckpoint = 0;

                    var reqOpts = new ProviderRequestOptions {
                        NumCtx = effectiveNumCtx,
                        Think = GetSessionThink(sessionId)
                    };

                    var turn = _provider.StreamChat(
                        model,
                        history,
                        toolsJson,
                        rDelta => {
                            reasoningBuf.Append(rDelta);
                            BroadcastEphemeralDelta(sessionId, runId, "reasoning_delta", rDelta);
                        },
                        cDelta => {
                            contentBuf.Append(cDelta);
                            charsSinceCheckpoint += cDelta.Length;
                            BroadcastEphemeralDelta(sessionId, runId, "message_delta", cDelta);
                            if (charsSinceCheckpoint >= 4096 || (DateTime.UtcNow - lastCheckpoint).TotalSeconds >= 2.0) {
                                charsSinceCheckpoint = 0;
                                lastCheckpoint = DateTime.UtcNow;
                                _store.Append(sessionId, "message_checkpoint", new JObject {
                                    ["partialContent"] = contentBuf.ToString()
                                }, runId, durableFlush: false);
                            }
                        },
                        cts.Token,
                        reqOpts);

                    totalTokens += turn.PromptTokens + turn.CompletionTokens;
                    AppendAndBroadcast(sessionId, "context_usage", new JObject {
                        ["promptTokens"] = turn.PromptTokens,
                        ["completionTokens"] = turn.CompletionTokens,
                        ["totalTokens"] = totalTokens,
                        ["numCtx"] = effectiveNumCtx,
                        ["estimatedPromptTokens"] = estPromptTokens
                    }, runId, durableFlush: false);

                    if (!string.IsNullOrEmpty(turn.Content) || !string.IsNullOrEmpty(turn.Reasoning)) {
                        AppendAndBroadcast(sessionId, "assistant_message", new JObject {
                            ["role"] = "assistant",
                            ["content"] = turn.Content,
                            ["reasoning"] = turn.Reasoning
                        }, runId, durableFlush: true);
                    }

                    if (totalTokens > budgets.MaxTokens) {
                        stopReason = "max_tokens";
                        break;
                    }

                    if (turn.ToolCalls.Count == 0) {
                        stopReason = "completed";
                        break;
                    }

                    // Loop detection: 2 consecutive or 3 total identical tool call signatures
                    string sig = string.Join("|", turn.ToolCalls.Select(c => c.Name + ":" + CanonicalJson.Serialize(c.Arguments)));
                    string lastSig = callSignatures.Count > 0 ? callSignatures[callSignatures.Count - 1] : null;
                    callSignatures.Add(sig);
                    int count = callSignatures.Count(s => s == sig);
                    if (sig == lastSig || count >= 3) {
                        stopReason = "loop_detected";
                        break;
                    }

                    var wireToolCalls = new JArray();
                    foreach (var tc in turn.ToolCalls) {
                        wireToolCalls.Add(new JObject {
                            ["id"] = tc.Id,
                            ["type"] = "function",
                            ["function"] = new JObject {
                                ["name"] = tc.Name,
                                ["arguments"] = (tc.Arguments ?? new JObject()).ToString(Newtonsoft.Json.Formatting.None)
                            }
                        });
                    }
                    history.Add(new JObject {
                        ["role"] = "assistant",
                        ["content"] = turn.Content ?? "",
                        ["tool_calls"] = wireToolCalls
                    });

                    foreach (var call in turn.ToolCalls) {
                        cts.Token.ThrowIfCancellationRequested();
                        var latestSummary = _store.BuildSummary(sessionId);
                        string curMode = latestSummary?.Mode ?? "build";
                        string curAutonomy = latestSummary?.Autonomy ?? "auto_reads";
                        string curWorkspace = latestSummary?.Workspace ?? Environment.CurrentDirectory;

                        AppendAndBroadcast(sessionId, "tool_call_requested", new JObject {
                            ["callId"] = call.Id,
                            ["tool"] = call.Name,
                            ["arguments"] = call.Arguments
                        }, runId, durableFlush: true);

                        _tools.TryGetValue(call.Name, out var tool);
                        bool curUnattended = latestSummary?.Unattended ?? false;
                        // Phase 2.2: Untrusted workspaces allow chat & read-only tools, but block exec/subagent/MCP tools until trusted
                        if (tool != null && !_workspaceTrust.IsWorkspaceTrusted(curWorkspace) &&
                            (tool.Safety == "exec" || tool.Category == "mcp" || string.Equals(tool.Name, "spawn_subagent", StringComparison.OrdinalIgnoreCase))) {
                            AppendAndBroadcast(sessionId, "tool_finished", new JObject {
                                ["callId"] = call.Id,
                                ["tool"] = call.Name,
                                ["ok"] = false,
                                ["denied"] = true,
                                ["error"] = "Workspace is untrusted; exec, hooks, MCP, and subagents are disabled until you trust this workspace via the trusted channel."
                            }, runId, durableFlush: true);
                            history.Add(new JObject { ["role"] = "tool", ["tool_call_id"] = call.Id, ["name"] = call.Name, ["content"] = "Permission denied: workspace is untrusted." });
                            continue;
                        }
                        var decision = _permissions.Evaluate(sessionId, curMode, curAutonomy, tool, call.Arguments, curUnattended);

                        // Phase 2.3: Memory poisoning guard — record provenance and NEVER allow silent memory_save after untrusted content
                        if (tool != null && string.Equals(tool.Name, "memory_save", StringComparison.OrdinalIgnoreCase)) {
                            bool sawUntrusted = history.Any(m => {
                                string r = (m["role"]?.Value<string>() ?? "").ToLowerInvariant();
                                string c = m["content"]?.Value<string>() ?? "";
                                return r == "tool" || c.IndexOf("<untrusted_", StringComparison.OrdinalIgnoreCase) >= 0;
                            });
                            call.Arguments["_provenance"] = sawUntrusted ? "model-after-untrusted-content" : "model-after-user-prompt";
                            call.Arguments["_sessionId"] = sessionId;
                            if (sawUntrusted && decision.Kind == PermissionDecisionKind.Allow) {
                                decision = curUnattended
                                    ? new PermissionDecision {
                                        Kind = PermissionDecisionKind.Deny,
                                        RiskClass = "high",
                                        Reason = "Unattended policy: memory_save after untrusted content requires explicit approval."
                                    }
                                    : new PermissionDecision {
                                        Kind = PermissionDecisionKind.Ask,
                                        RiskClass = "low",
                                        Reason = "Memory save requested after untrusted content entered context; explicit user approval required.",
                                        HostCardText = $"Save memory (after untrusted content): {call.Arguments["content"]?.Value<string>() ?? ""}"
                                    };
                            }
                        }

                        if (decision.Kind == PermissionDecisionKind.Deny) {
                            AppendAndBroadcast(sessionId, "tool_finished", new JObject {
                                ["callId"] = call.Id,
                                ["tool"] = call.Name,
                                ["ok"] = false,
                                ["denied"] = true,
                                ["error"] = decision.Reason
                            }, runId, durableFlush: true);
                            history.Add(new JObject { ["role"] = "tool", ["tool_call_id"] = call.Id, ["name"] = call.Name, ["content"] = "Permission denied: " + decision.Reason });
                            continue;
                        }

                        if (decision.Kind == PermissionDecisionKind.Ask) {
                            string pendingWsId = latestSummary?.WorkspaceId ?? "";
                            var pendingWsRec = !string.IsNullOrEmpty(pendingWsId) ? _workspaces.GetById(pendingWsId) : null;
                            string pendingWsName = pendingWsRec?.Name ?? "Default";
                            string pendingWsRoot = !string.IsNullOrWhiteSpace(pendingWsRec?.RootPath)
                                ? pendingWsRec.RootPath
                                : (!string.IsNullOrWhiteSpace(curWorkspace) ? curWorkspace : "Chat-only");
                            decision.HostCardText = $"[Workspace: {pendingWsName} ({pendingWsRoot})] " + (decision.HostCardText ?? "");
                            var pending = _permissions.CreatePendingApproval(sessionId, runId, call.Id, call.Name, call.Arguments, decision);
                            pending.WorkspaceId = pendingWsId;
                            pending.WorkspaceName = pendingWsName;
                            pending.WorkspaceRoot = pendingWsRoot;
                            AppendAndBroadcast(sessionId, "approval_requested", new JObject {
                                ["approvalId"] = pending.ApprovalId,
                                ["callId"] = pending.CallId,
                                ["workspaceId"] = pendingWsId,
                                ["workspaceName"] = pendingWsName,
                                ["workspaceRoot"] = pendingWsRoot,
                                ["tool"] = pending.ToolName,
                                ["riskClass"] = pending.RiskClass,
                                ["argsSha256"] = pending.CanonicalArgsSha256,
                                ["cardText"] = pending.HostCardText,
                                ["reason"] = decision.Reason
                            }, runId, durableFlush: true);

                            try {
                                int waitIdx = WaitHandle.WaitAny(new[] { pending.WaitHandle.WaitHandle, cts.Token.WaitHandle }, 120000);
                                if (waitIdx == 1) throw new OperationCanceledException(cts.Token);
                                bool isApproved = waitIdx == 0 && pending.Approved;
                                AppendAndBroadcast(sessionId, "approval_resolved", new JObject {
                                    ["approvalId"] = pending.ApprovalId,
                                    ["callId"] = pending.CallId,
                                    ["approved"] = isApproved,
                                    ["scope"] = pending.Scope,
                                    ["resolvedBy"] = waitIdx == 0 ? pending.ResolvedBy : "timeout"
                                }, runId, durableFlush: true);

                                if (!isApproved) {
                                    AppendAndBroadcast(sessionId, "tool_finished", new JObject {
                                        ["callId"] = call.Id,
                                        ["tool"] = call.Name,
                                        ["ok"] = false,
                                        ["denied"] = true,
                                        ["error"] = waitIdx == 0 ? "User denied tool execution." : "Approval timed out."
                                    }, runId, durableFlush: true);
                                    history.Add(new JObject { ["role"] = "tool", ["tool_call_id"] = call.Id, ["name"] = call.Name, ["content"] = "Tool execution denied by user." });
                                    continue;
                                }
                            } finally {
                                _permissions.RemovePending(pending.ApprovalId);
                            }
                        }

                        AppendAndBroadcast(sessionId, "tool_started", new JObject {
                            ["callId"] = call.Id,
                            ["tool"] = call.Name
                        }, runId, durableFlush: false);

                        string rawOut;
                        bool ok = true;
                        try {
                            string curWorkspaceId = latestSummary?.WorkspaceId ?? "";
                            var wsRecord = !string.IsNullOrEmpty(curWorkspaceId) ? _workspaces.GetById(curWorkspaceId) : null;
                            if (wsRecord != null && wsRecord.RootStatus == "missing" &&
                                (tool.Category == "files" || tool.Category == "shell")) {
                                throw new InvalidOperationException("workspace_root_missing: Workspace folder is missing. Locate or remove it.");
                            }
                            var execArgs = (JObject)(call.Arguments?.DeepClone() ?? new JObject());
                            execArgs["_workspace"] = curWorkspace;
                            execArgs["_workspaceId"] = curWorkspaceId;
                            execArgs["_sessionId"] = sessionId;
                            using (var toolCts = CancellationTokenSource.CreateLinkedTokenSource(cts.Token)) {
                                toolCts.CancelAfter(Math.Min(budgets.ToolTimeoutMs, tool.TimeoutMs));
                                rawOut = tool.Execute(execArgs, toolCts.Token) ?? "";
                            }
                        } catch (OperationCanceledException) when (cts.IsCancellationRequested) {
                            throw;
                        } catch (Exception ex) {
                            ok = false;
                            rawOut = "Tool error: " + ex.Message;
                        }

                        var stored = _store.StoreBlobIfLarge(rawOut);
                        AppendAndBroadcast(sessionId, "tool_finished", new JObject {
                            ["callId"] = call.Id,
                            ["tool"] = call.Name,
                            ["ok"] = ok,
                            ["output"] = stored
                        }, runId, durableFlush: true);

                        if (ok && (tool.Safety == "write" || tool.Safety == "destructive") && tool.Category == "files") {
                            string changedPath = call.Arguments?["path"]?.Value<string>() ?? call.Arguments?["to"]?.Value<string>() ?? "";
                            if (!string.IsNullOrEmpty(changedPath)) {
                                AppendAndBroadcast(sessionId, "file_changed", new JObject {
                                    ["path"] = changedPath,
                                    ["tool"] = call.Name,
                                    ["callId"] = call.Id
                                }, runId, durableFlush: false);
                                if (string.Equals(curMode, "plan", StringComparison.OrdinalIgnoreCase) && PermissionEngine.IsPlanMdPath(changedPath)) {
                                    AppendAndBroadcast(sessionId, "plan_ready", new JObject {
                                        ["path"] = changedPath,
                                        ["callId"] = call.Id
                                    }, runId, durableFlush: true);
                                }
                            }
                        }

                        history.Add(new JObject {
                            ["role"] = "tool",
                            ["tool_call_id"] = call.Id,
                            ["name"] = call.Name,
                            ["content"] = stored["inline"]?.Value<string>() ?? stored["preview"]?.Value<string>() ?? ""
                        });
                    }

                    if (step + 1 >= budgets.MaxSteps) {
                        stopReason = "max_steps";
                    }
                }
            } catch (OperationCanceledException) {
                stopReason = "interrupted";
            } catch (Exception ex) {
                stopReason = "error";
                AppendAndBroadcast(sessionId, "error", new JObject {
                    ["message"] = ex.Message
                }, runId, durableFlush: true);
            } finally {
                _activeRuns.TryRemove(sessionId, out _);
                _activeRunIds.TryRemove(sessionId, out _);
                try {
                    AppendAndBroadcast(sessionId, "run_finished", new JObject {
                        ["stopReason"] = stopReason,
                        ["elapsedMs"] = sw.ElapsedMilliseconds,
                        ["totalTokens"] = totalTokens
                    }, runId, durableFlush: true);
                } catch { }
                cts.Dispose();
            }
        }

        private string ReadUserProfileName() {
            try {
                if (!string.IsNullOrEmpty(_dataRoot)) {
                    string settingsPath = Path.Combine(_dataRoot, "settings.json");
                    if (File.Exists(settingsPath)) {
                        var obj = CanonicalJson.ParseObject(File.ReadAllText(settingsPath, Encoding.UTF8));
                        string raw = (obj?["user.name"]?.Value<string>() ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
                        if (!string.IsNullOrEmpty(raw)) {
                            return raw.Length > 80 ? raw.Substring(0, 80) : raw;
                        }
                    }
                }
            } catch { }
            try {
                var listed = _memory.ListAll();
                if (listed?["facts"] is JArray facts) {
                    foreach (JObject f in facts) {
                        string cat = f["category"]?.Value<string>() ?? "";
                        string prov = f["provenance"]?.Value<string>() ?? "";
                        if (string.Equals(cat, "profile", StringComparison.OrdinalIgnoreCase) && prov == "user") {
                            string content = (f["content"]?.Value<string>() ?? "").Trim();
                            const string prefix = "User's name is ";
                            if (content.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) {
                                string extracted = content.Substring(prefix.Length).Trim().TrimEnd('.');
                                if (!string.IsNullOrEmpty(extracted)) {
                                    return extracted.Length > 80 ? extracted.Substring(0, 80) : extracted;
                                }
                            }
                        }
                    }
                }
            } catch { }
            return "";
        }

        private List<JObject> BuildModelMessagesFromLog(string sessionId) {
            var events = _store.ReadEvents(sessionId, 0);
            var sum = _store.BuildSummary(sessionId);
            var msgs = new List<JObject>();

            // 0. Inject user profile identity & pinned user memories so the local assistant understands who it is helping
            string userName = ReadUserProfileName();
            var pinnedProfileLines = new List<string>();
            if (!string.IsNullOrEmpty(userName)) {
                pinnedProfileLines.Add($"The user's name is {userName}. Address them naturally by name when helpful.");
            }
            try {
                var memRoot = _memory.ListAll();
                if (memRoot?["facts"] is JArray facts) {
                    int added = 0;
                    foreach (JObject f in facts) {
                        if (added >= 10) break;
                        bool pinned = f["pinned"]?.Value<bool>() ?? false;
                        string prov = f["provenance"]?.Value<string>() ?? "";
                        string content = (f["content"]?.Value<string>() ?? "").Trim();
                        if (!pinned || prov != "user" || string.IsNullOrEmpty(content)) continue;
                        if (!string.IsNullOrEmpty(userName) && content.IndexOf(userName, StringComparison.OrdinalIgnoreCase) >= 0 &&
                            content.StartsWith("User's name is ", StringComparison.OrdinalIgnoreCase)) continue;
                        pinnedProfileLines.Add("- " + content);
                        added++;
                    }
                }
            } catch { }
            if (pinnedProfileLines.Count > 0) {
                msgs.Add(new JObject {
                    ["role"] = "system",
                    ["content"] = "User profile:\n" + string.Join("\n", pinnedProfileLines)
                });
            }

            // 1. Inject workspace AGENTS.md & .sanctum/rules/*.md instructions ONLY if workspace is trusted
            if (sum != null && !string.IsNullOrWhiteSpace(sum.Workspace) && _workspaceTrust.IsWorkspaceTrusted(sum.Workspace)) {
                var instr = ContextEngine.LoadInstructions(sum.Workspace);
                string combined = instr["combined"]?.Value<string>() ?? "";
                if (!string.IsNullOrWhiteSpace(combined)) {
                    msgs.Add(new JObject {
                        ["role"] = "system",
                        ["content"] = "Workspace instructions:\n" + combined
                    });
                }
            }

            // 2. Find latest compaction checkpoint
            long compactedUpTo = 0;
            string compactionSummary = null;
            foreach (var e in events) {
                if (e.Type == "compaction") {
                    long upTo = e.Payload?["compactedUpToSeq"]?.Value<long>() ?? 0;
                    if (upTo >= compactedUpTo) {
                        compactedUpTo = upTo;
                        compactionSummary = e.Payload?["summary"]?.Value<string>();
                    }
                }
            }
            if (!string.IsNullOrWhiteSpace(compactionSummary)) {
                msgs.Add(new JObject {
                    ["role"] = "system",
                    ["content"] = compactionSummary
                });
            }

            // 3. Replay user/assistant messages after compaction, resolving @mentions on user turns
            foreach (var e in events) {
                if (e.Seq <= compactedUpTo) continue;
                if (e.Type == "user_message") {
                    string content = e.Payload?["content"]?.Value<string>() ?? "";
                    if (sum != null && !string.IsNullOrWhiteSpace(sum.Workspace) && content.Contains("@")) {
                        var mentions = ContextEngine.ResolveMentions(sum.Workspace, content);
                        string ctxText = mentions["contextText"]?.Value<string>() ?? "";
                        if (!string.IsNullOrWhiteSpace(ctxText)) {
                            content = content + "\n\n[Resolved @mentions]\n" + ctxText;
                        }
                    }
                    msgs.Add(new JObject {
                        ["role"] = "user",
                        ["content"] = content
                    });
                } else if (e.Type == "assistant_message") {
                    msgs.Add(new JObject {
                        ["role"] = "assistant",
                        ["content"] = e.Payload?["content"]?.Value<string>() ?? ""
                    });
                }
            }
            return msgs;
        }
    }
}
