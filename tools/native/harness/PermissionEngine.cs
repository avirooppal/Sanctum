using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32.SafeHandles;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public enum PermissionDecisionKind { Allow, Ask, Deny }

    public sealed class PermissionDecision {
        public PermissionDecisionKind Kind { get; set; }
        public string RiskClass { get; set; } = "low"; // "low" | "high"
        public string Reason { get; set; } = "";
        public string HostCardText { get; set; } = "";
    }

    public sealed class PendingApproval {
        public string ApprovalId { get; set; } = "";
        public string SessionId { get; set; } = "";
        public string WorkspaceId { get; set; } = "";
        public string WorkspaceName { get; set; } = "";
        public string WorkspaceRoot { get; set; } = "";
        public string RunId { get; set; } = "";
        public string CallId { get; set; } = "";
        public string ToolName { get; set; } = "";
        public string CanonicalArgsSha256 { get; set; } = "";
        public string RiskClass { get; set; } = "low";
        public string HostCardText { get; set; } = "";
        public ManualResetEventSlim WaitHandle { get; } = new ManualResetEventSlim(false);
        public volatile bool Resolved;
        public volatile bool Approved;
        public string Scope { get; set; } = "once";
        public string ResolvedBy { get; set; } = "";
    }

    public sealed class PermissionRule {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("workspaceId")] public string WorkspaceId { get; set; } = "";
        [JsonProperty("effect")] public string Effect { get; set; } = "ask"; // allow | ask | deny
        [JsonProperty("tool")] public string Tool { get; set; } = "*";
        [JsonProperty("commandPattern", NullValueHandling = NullValueHandling.Ignore)] public string CommandPattern { get; set; }
        [JsonProperty("pathPattern", NullValueHandling = NullValueHandling.Ignore)] public string PathPattern { get; set; }
        [JsonProperty("domainPattern", NullValueHandling = NullValueHandling.Ignore)] public string DomainPattern { get; set; }
        [JsonProperty("createdAt")] public string CreatedAt { get; set; } = "";
    }

    /// <summary>
    /// Host-side deny-by-default Permission Engine (single enforcement point).
    /// Enforces persistent allow/ask/deny rules, ToolPath containment, hard-blocked paths,
    /// command rules, Plan Mode, unattended fail-closed policy, audit logging, and Item 1 Trust Model.
    /// </summary>
    public sealed class PermissionEngine {
        private static readonly HashSet<string> PlanModeMutatingTools = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "create_file", "edit_file", "apply_patch", "create_directory", "move_path", "delete_path"
        };

        private static readonly Regex[] HardDenyCommandPatterns = new[] {
            new Regex(@"(rm\s+-(rf|fr|r)\s+(/|/\*|[a-z]:\\)|format\s+[a-z]:|\bdiskpart\b|\bbcdedit\b|\bcipher\s+/w\b|\breg\s+delete\s+hklm\b|\bshutdown\s+/[sr]\b|\bvssadmin\s+delete\s+shadows\b|\bmkfs\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            new Regex(@"(Remove-Item\s+.*-Recurse.*-Force\s+[a-z]:\\|\bInvoke-Expression\b|\biex\s*\(|curl\s+.*\|\s*(sh|bash|pwsh|powershell)\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        };

        private static readonly Regex[] ReadOnlyAllowCommandPatterns = new[] {
            new Regex(@"^\s*git\s+(status|diff|log|branch|rev-parse|show)(\s|$)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            new Regex(@"^\s*(pwd|whoami|hostname|echo|dir|ls|Get-ChildItem|Get-Location)(\s|$)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            new Regex(@"^\s*(node|npm|python|python3|dotnet|git)\s+(-v|--version)\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        };

        private static readonly Regex ShellChainOperators = new Regex(@"[;&|`$<>]", RegexOptions.Compiled);

        private readonly ConcurrentDictionary<string, PendingApproval> _pending = new ConcurrentDictionary<string, PendingApproval>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, HashSet<string>> _sessionApprovals = new ConcurrentDictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _knownTools = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly List<PermissionRule> _rules = new List<PermissionRule>();
        private readonly object _rulesLock = new object();
        private readonly string _appDataDir;
        private readonly string _rulesPath;
        private readonly HarnessAuditLog _audit;

        public PermissionEngine(string appDataDir, HarnessAuditLog audit = null) {
            _appDataDir = appDataDir;
            _rulesPath = Path.Combine(appDataDir, "permission_rules.json");
            _audit = audit ?? new HarnessAuditLog(appDataDir);
            LoadRules();
        }

        public HarnessAuditLog Audit => _audit;

        private void LoadRules() {
            lock (_rulesLock) {
                _rules.Clear();
                if (!File.Exists(_rulesPath)) return;
                try {
                    var loaded = JsonConvert.DeserializeObject<List<PermissionRule>>(File.ReadAllText(_rulesPath));
                    if (loaded != null) _rules.AddRange(loaded);
                } catch { }
            }
        }

        private void SaveRules() {
            Directory.CreateDirectory(_appDataDir);
            string tmp = _rulesPath + ".tmp." + Guid.NewGuid().ToString("N");
            File.WriteAllText(tmp, JsonConvert.SerializeObject(_rules, Formatting.Indented), new System.Text.UTF8Encoding(false));
            WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
            if (File.Exists(_rulesPath)) File.Delete(_rulesPath);
            File.Move(tmp, _rulesPath);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_rulesPath);
        }

        public JArray ListRules(string workspaceId = null) {
            lock (_rulesLock) {
                if (string.IsNullOrWhiteSpace(workspaceId)) return JArray.FromObject(_rules);
                string ws = workspaceId.Trim();
                var filtered = new List<PermissionRule>();
                foreach (var r in _rules) {
                    if (string.Equals(r.WorkspaceId ?? "", ws, StringComparison.OrdinalIgnoreCase)) filtered.Add(r);
                }
                return JArray.FromObject(filtered);
            }
        }

        public (int status, JObject body) AddRule(PermissionRule rule, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                _audit.Record("", rule?.Tool ?? "*", "add_rule", rule?.CommandPattern ?? rule?.PathPattern ?? "", "denied", "Rule creation requires trusted channel", "bearer_channel");
                return (403, new JObject {
                    ["error"] = "Permission rules may only be created through a trusted channel (native dialog or CLI TTY).",
                    ["code"] = "trusted_channel_required"
                });
            }
            if (rule == null || (rule.Effect != "allow" && rule.Effect != "ask" && rule.Effect != "deny")) {
                return (400, new JObject { ["error"] = "Invalid rule effect (must be allow, ask, or deny)." });
            }
            rule.Id = "rule_" + Guid.NewGuid().ToString("N").Substring(0, 10);
            rule.CreatedAt = DateTime.UtcNow.ToString("o");
            lock (_rulesLock) {
                _rules.Add(rule);
                SaveRules();
            }
            _audit.Record("", rule.Tool, "add_rule", rule.CommandPattern ?? rule.PathPattern ?? "*", "allowed", "Rule created: " + rule.Effect, "trusted_channel");
            return (201, JObject.FromObject(rule));
        }

        private PermissionRule MatchCustomRule(string toolName, JObject args) {
            string cmd = args?["command"]?.Value<string>() ?? "";
            string p = args?["path"]?.Value<string>() ?? "";
            string url = args?["url"]?.Value<string>() ?? "";
            lock (_rulesLock) {
                // Deny rules take precedence, then allow/ask
                foreach (string pass in new[] { "deny", "allow", "ask" }) {
                    foreach (var r in _rules) {
                        if (!string.Equals(r.Effect, pass, StringComparison.OrdinalIgnoreCase)) continue;
                        if (r.Tool != "*" && !string.Equals(r.Tool, toolName, StringComparison.OrdinalIgnoreCase)) continue;
                        if (!string.IsNullOrEmpty(r.CommandPattern) && !Regex.IsMatch(cmd, r.CommandPattern, RegexOptions.IgnoreCase)) continue;
                        if (!string.IsNullOrEmpty(r.PathPattern) && !Regex.IsMatch(p, r.PathPattern, RegexOptions.IgnoreCase)) continue;
                        if (!string.IsNullOrEmpty(r.DomainPattern) && !Regex.IsMatch(url, r.DomainPattern, RegexOptions.IgnoreCase)) continue;
                        return r;
                    }
                }
            }
            return null;
        }

        public void RegisterKnownTool(string toolName) {
            lock (_knownTools) _knownTools.Add(toolName);
        }

        public static bool IsPlanMdPath(string rawPath) {
            if (string.IsNullOrWhiteSpace(rawPath)) return false;
            string norm = rawPath.Trim().Replace('\\', '/');
            if (norm.StartsWith("./")) norm = norm.Substring(2);
            return string.Equals(norm, "plan.md", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsHardBlockedPath(string fullPath) {
            string norm = Path.GetFullPath(fullPath).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
            string winDir = Environment.GetFolderPath(Environment.SpecialFolder.Windows).ToLowerInvariant();
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles).ToLowerInvariant();
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile).ToLowerInvariant();

            if (!string.IsNullOrEmpty(winDir) && (norm == winDir || norm.StartsWith(winDir + "\\"))) return true;
            if (!string.IsNullOrEmpty(progFiles) && (norm == progFiles || norm.StartsWith(progFiles + "\\"))) return true;
            foreach (string secretDir in new[] { ".ssh", ".aws", ".gnupg", ".kube", ".azure" }) {
                string blocked = Path.Combine(userProfile, secretDir).ToLowerInvariant();
                if (norm == blocked || norm.StartsWith(blocked + "\\")) return true;
            }
            if (norm.Contains("\\appdata\\roaming\\sanctum\\runtime.json")) return true;
            return false;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafeFileHandle CreateFileW(
            string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes,
            uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint GetFinalPathNameByHandleW(
            SafeFileHandle hFile, StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);

        /// <summary>
        /// Canonicalizes a filesystem path by expanding 8.3 short names, symlinks, and junctions
        /// via GetFinalPathNameByHandleW when the path exists on disk.
        /// </summary>
        public static string CanonicalizePath(string rawPath) {
            if (string.IsNullOrWhiteSpace(rawPath)) return "";
            string full = Path.GetFullPath(rawPath.Trim());
            if (Directory.Exists(full) || File.Exists(full)) {
                try {
                    const uint FILE_SHARE_ALL = 0x00000001 | 0x00000002 | 0x00000004;
                    const uint OPEN_EXISTING = 3;
                    const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
                    using (var h = CreateFileW(full, 0, FILE_SHARE_ALL, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero)) {
                        if (!h.IsInvalid) {
                            var sb = new StringBuilder(1024);
                            uint len = GetFinalPathNameByHandleW(h, sb, (uint)sb.Capacity, 0);
                            if (len > 0 && len < sb.Capacity) {
                                string resolved = sb.ToString();
                                if (resolved.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) {
                                    resolved = @"\\" + resolved.Substring(8);
                                } else if (resolved.StartsWith(@"\\?\", StringComparison.Ordinal)) {
                                    resolved = resolved.Substring(4);
                                }
                                if (!string.IsNullOrWhiteSpace(resolved)) {
                                    full = resolved;
                                }
                            }
                        }
                    }
                } catch { }
            }
            if (full.Length > 3) full = full.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            return full;
        }

        public static string ResolveToolPath(string workspaceRoot, string rawPath, bool allowRoot = true) {
            if (string.IsNullOrWhiteSpace(workspaceRoot)) throw new InvalidOperationException("Workspace root is not set.");
            string trimmed = (rawPath ?? "").Trim();
            if (trimmed.IndexOf('\0') >= 0) throw new UnauthorizedAccessException("Null byte in path.");
            if (trimmed.StartsWith("\\\\") || trimmed.StartsWith("//")) throw new UnauthorizedAccessException("UNC network paths are blocked.");
            if (Path.IsPathRooted(trimmed)) throw new UnauthorizedAccessException("Absolute paths are forbidden under 'workspace_only' access scope.");

            string root = CanonicalizePath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            string full = Path.GetFullPath(Path.Combine(root, string.IsNullOrEmpty(trimmed) ? "." : trimmed));

            // Block symlinks/junctions
            string cur = full;
            while (!string.IsNullOrEmpty(cur)) {
                if ((File.Exists(cur) || Directory.Exists(cur)) && (File.GetAttributes(cur) & FileAttributes.ReparsePoint) != 0) {
                    throw new UnauthorizedAccessException("Symbolic links and junctions are blocked.");
                }
                cur = Path.GetDirectoryName(cur);
            }

            if (IsHardBlockedPath(full)) {
                throw new UnauthorizedAccessException("Access to critical system or credential path is hard-blocked.");
            }

            bool sameAsRoot = full.Equals(root, StringComparison.OrdinalIgnoreCase);
            bool insideRoot = full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
            if (!((allowRoot && sameAsRoot) || insideRoot)) {
                throw new UnauthorizedAccessException("Path escapes workspace root under 'workspace_only' scope.");
            }
            return full;
        }

        public static (string action, string reason) EvaluateCommandRule(string command, string workspaceRoot = null) {
            return PowerShellAstEvaluator.Evaluate(command, workspaceRoot);
        }

        public PermissionDecision Evaluate(
            string sessionId,
            string mode,
            string autonomy,
            HarnessToolDescriptor tool,
            JObject args,
            bool unattended = false) {
            PermissionDecision Finalize(PermissionDecision d) {
                if (unattended && d.Kind == PermissionDecisionKind.Ask) {
                    d = new PermissionDecision {
                        Kind = PermissionDecisionKind.Deny,
                        RiskClass = d.RiskClass,
                        Reason = "Unattended policy: action not pre-approved (" + d.Reason + ")"
                    };
                }
                _audit.Record(
                    sessionId,
                    tool?.Name ?? "unknown",
                    "evaluate",
                    args?["command"]?.Value<string>() ?? args?["path"]?.Value<string>() ?? "",
                    d.Kind.ToString().ToLowerInvariant(),
                    d.Reason);
                return d;
            }

            if (tool == null) {
                return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Deny, Reason = "Unknown tool denied by default." });
            }
            lock (_knownTools) {
                if (!_knownTools.Contains(tool.Name)) {
                    return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Deny, Reason = "Unregistered tool denied by default." });
                }
            }

            // Plan Mode guard: only PLAN.md may be mutated
            if (string.Equals(mode, "plan", StringComparison.OrdinalIgnoreCase) && PlanModeMutatingTools.Contains(tool.Name)) {
                string target = args?["path"]?.Value<string>() ?? "";
                if (!IsPlanMdPath(target)) {
                    return Finalize(new PermissionDecision {
                        Kind = PermissionDecisionKind.Deny,
                        Reason = "Plan Mode is active: only PLAN.md may be written before user approval."
                    });
                }
            }

            // Hard-deny command safety rules ALWAYS win before custom rules
            if (string.Equals(tool.Name, "run_command", StringComparison.OrdinalIgnoreCase)) {
                string cmd0 = args?["command"]?.Value<string>() ?? "";
                string ws0 = args?["_workspace"]?.Value<string>();
                var (ruleAction0, ruleReason0) = EvaluateCommandRule(cmd0, ws0);
                if (ruleAction0 == "deny") {
                    return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Deny, RiskClass = "high", Reason = ruleReason0 });
                }
            }

            // Custom persistent rules (created via trusted channel only)
            var matchedRule = MatchCustomRule(tool.Name, args);
            if (matchedRule != null) {
                if (matchedRule.Effect == "deny") {
                    return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Deny, RiskClass = "high", Reason = "Denied by rule " + matchedRule.Id });
                }
                if (matchedRule.Effect == "allow") {
                    return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Allowed by rule " + matchedRule.Id });
                }
            }

            // Shell command rules
            if (string.Equals(tool.Name, "run_command", StringComparison.OrdinalIgnoreCase)) {
                string cmd = args?["command"]?.Value<string>() ?? "";
                string ws = args?["_workspace"]?.Value<string>();
                var (ruleAction, ruleReason) = EvaluateCommandRule(cmd, ws);
                if (ruleAction == "allow" && autonomy != "ask_all") {
                    return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = ruleReason });
                }
                return Finalize(new PermissionDecision {
                    Kind = PermissionDecisionKind.Ask,
                    RiskClass = "high",
                    Reason = ruleReason,
                    HostCardText = $"Execute shell command: {cmd}"
                });
            }

            // Destructive deletes are always high-risk
            if (tool.Safety == "destructive" || string.Equals(tool.Name, "delete_path", StringComparison.OrdinalIgnoreCase)) {
                string p = args?["path"]?.Value<string>() ?? "";
                return Finalize(new PermissionDecision {
                    Kind = PermissionDecisionKind.Ask,
                    RiskClass = "high",
                    Reason = "Destructive delete requires native/TTY confirmation.",
                    HostCardText = $"Move workspace path to trash: {p}"
                });
            }

            // Safe reads
            if (tool.Safety == "read") {
                if (autonomy == "ask_all") {
                    return Finalize(new PermissionDecision {
                        Kind = PermissionDecisionKind.Ask,
                        RiskClass = "low",
                        Reason = "Autonomy is ask_all.",
                        HostCardText = $"Run read tool '{tool.Name}' with args: {CanonicalJson.Serialize(args ?? new JObject())}"
                    });
                }
                return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Read tool allowed." });
            }

            // Workspace writes (low-risk inside workspace)
            if (autonomy == "full_auto") {
                return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Allowed under full_auto." });
            }

            if (_sessionApprovals.TryGetValue(sessionId, out var approvedSet)) {
                lock (approvedSet) {
                    if (approvedSet.Contains(tool.Name)) {
                        return Finalize(new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Session-approved." });
                    }
                }
            }

            string targetPath = args?["path"]?.Value<string>() ?? "";
            return Finalize(new PermissionDecision {
                Kind = PermissionDecisionKind.Ask,
                RiskClass = "low",
                Reason = $"Tool '{tool.Name}' requires user approval.",
                HostCardText = string.IsNullOrEmpty(targetPath)
                    ? $"Execute '{tool.Name}'"
                    : $"Modify workspace file ({tool.Name}): {targetPath}"
            });
        }

        public PendingApproval CreatePendingApproval(string sessionId, string runId, string callId, string toolName, JObject args, PermissionDecision decision) {
            var pa = new PendingApproval {
                ApprovalId = "apr_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                SessionId = sessionId,
                RunId = runId,
                CallId = callId,
                ToolName = toolName,
                CanonicalArgsSha256 = CanonicalJson.Sha256Hex(CanonicalJson.Serialize(args ?? new JObject())),
                RiskClass = decision.RiskClass,
                HostCardText = decision.HostCardText
            };
            _pending[pa.ApprovalId] = pa;
            return pa;
        }

        public (int status, JObject body) ResolveApproval(
            string approvalId,
            bool approved,
            string scope,
            string expectedCallId,
            string expectedArgsSha256,
            bool viaTrustedChannel) {
            if (!_pending.TryGetValue(approvalId, out var pa)) {
                return (404, new JObject { ["error"] = "Approval request not found or already expired." });
            }
            if (pa.Resolved) {
                return (409, new JObject { ["error"] = "Approval already consumed (replay rejected).", ["code"] = "approval_already_used" });
            }

            // Call-binding check: approval for call A cannot be replayed for call B
            if (!string.IsNullOrEmpty(expectedCallId) && !string.Equals(expectedCallId, pa.CallId, StringComparison.Ordinal)) {
                return (403, new JObject { ["error"] = "Approval callId mismatch (call binding failed).", ["code"] = "approval_call_mismatch" });
            }
            if (!string.IsNullOrEmpty(expectedArgsSha256) && !string.Equals(expectedArgsSha256, pa.CanonicalArgsSha256, StringComparison.OrdinalIgnoreCase)) {
                return (403, new JObject { ["error"] = "Approval arguments hash mismatch.", ["code"] = "approval_args_mismatch" });
            }

            string normScope = string.IsNullOrWhiteSpace(scope) ? "once" : scope.Trim().ToLowerInvariant();
            bool requiresTrusted = approved && (pa.RiskClass == "high" || normScope == "always_rule");
            if (requiresTrusted && !viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "High-risk approvals and always-rules require native dialog or CLI TTY confirmation.",
                    ["code"] = "trusted_channel_required"
                });
            }

            pa.Approved = approved;
            pa.Scope = normScope;
            pa.ResolvedBy = viaTrustedChannel ? "trusted_channel" : "bearer_channel";
            pa.Resolved = true;

            if (approved && normScope == "session" && pa.RiskClass == "low") {
                var set = _sessionApprovals.GetOrAdd(pa.SessionId, _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase));
                lock (set) set.Add(pa.ToolName);
            }

            pa.WaitHandle.Set();
            return (200, new JObject {
                ["approvalId"] = pa.ApprovalId,
                ["approved"] = pa.Approved,
                ["scope"] = pa.Scope,
                ["callId"] = pa.CallId
            });
        }

        public void RemovePending(string approvalId) {
            if (_pending.TryRemove(approvalId, out var pa)) {
                pa.WaitHandle.Dispose();
            }
        }

        public List<PendingApproval> ListPendingApprovals() {
            var list = new List<PendingApproval>();
            foreach (var kv in _pending) {
                if (!kv.Value.Resolved) list.Add(kv.Value);
            }
            return list;
        }
    }
}
