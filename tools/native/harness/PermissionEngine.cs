using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;
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

    /// <summary>
    /// Host-side deny-by-default Permission Engine (single enforcement point).
    /// Enforces ToolPath containment, hard-blocked system/credential paths, command rules,
    /// Plan Mode write restriction, autonomy levels, and the Item 1 Approval Trust Model.
    /// </summary>
    public sealed class PermissionEngine {
        private static readonly HashSet<string> PlanModeMutatingTools = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "create_file", "edit_file", "apply_patch", "create_directory", "move_path", "delete_path"
        };

        private static readonly Regex[] HardDenyCommandPatterns = new[] {
            new Regex(@"\b(rm\s+-rf\s+/|format\s+[a-z]:|diskpart|bcdedit|cipher\s+/w|reg\s+delete\s+hklm|shutdown\s+/[sr]|vssadmin\s+delete\s+shadows)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            new Regex(@"\b(Remove-Item\s+.*-Recurse.*-Force\s+[a-z]:\\|Invoke-Expression|iex\s*\(|curl\s+.*\|\s*(sh|bash|pwsh|powershell))\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)
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
        private readonly string _appDataDir;

        public PermissionEngine(string appDataDir) {
            _appDataDir = appDataDir;
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

        public static string ResolveToolPath(string workspaceRoot, string rawPath, bool allowRoot = true) {
            if (string.IsNullOrWhiteSpace(workspaceRoot)) throw new InvalidOperationException("Workspace root is not set.");
            string trimmed = (rawPath ?? "").Trim();
            if (trimmed.IndexOf('\0') >= 0) throw new UnauthorizedAccessException("Null byte in path.");
            if (trimmed.StartsWith("\\\\") || trimmed.StartsWith("//")) throw new UnauthorizedAccessException("UNC network paths are blocked.");
            if (Path.IsPathRooted(trimmed)) throw new UnauthorizedAccessException("Absolute paths are forbidden under 'workspace_only' access scope.");

            string root = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
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

        public static (string action, string reason) EvaluateCommandRule(string command) {
            string cmd = (command ?? "").Trim();
            if (string.IsNullOrEmpty(cmd)) return ("deny", "Empty command.");
            foreach (var rx in HardDenyCommandPatterns) {
                if (rx.IsMatch(cmd)) return ("deny", "Blocked by host command safety rule.");
            }
            if (!ShellChainOperators.IsMatch(cmd)) {
                foreach (var rx in ReadOnlyAllowCommandPatterns) {
                    if (rx.IsMatch(cmd)) return ("allow", "Matches read-only command allowlist.");
                }
            }
            return ("ask", "Non-allowlisted shell command requires explicit user approval.");
        }

        public PermissionDecision Evaluate(
            string sessionId,
            string mode,
            string autonomy,
            HarnessToolDescriptor tool,
            JObject args) {
            if (tool == null) {
                return new PermissionDecision { Kind = PermissionDecisionKind.Deny, Reason = "Unknown tool denied by default." };
            }
            lock (_knownTools) {
                if (!_knownTools.Contains(tool.Name)) {
                    return new PermissionDecision { Kind = PermissionDecisionKind.Deny, Reason = "Unregistered tool denied by default." };
                }
            }

            // Plan Mode guard: only PLAN.md may be mutated
            if (string.Equals(mode, "plan", StringComparison.OrdinalIgnoreCase) && PlanModeMutatingTools.Contains(tool.Name)) {
                string target = args?["path"]?.Value<string>() ?? "";
                if (!IsPlanMdPath(target)) {
                    return new PermissionDecision {
                        Kind = PermissionDecisionKind.Deny,
                        Reason = "Plan Mode is active: only PLAN.md may be written before user approval."
                    };
                }
            }

            // Shell command rules
            if (string.Equals(tool.Name, "run_command", StringComparison.OrdinalIgnoreCase)) {
                string cmd = args?["command"]?.Value<string>() ?? "";
                var (ruleAction, ruleReason) = EvaluateCommandRule(cmd);
                if (ruleAction == "deny") {
                    return new PermissionDecision { Kind = PermissionDecisionKind.Deny, RiskClass = "high", Reason = ruleReason };
                }
                if (ruleAction == "allow" && autonomy != "ask_all") {
                    return new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = ruleReason };
                }
                return new PermissionDecision {
                    Kind = PermissionDecisionKind.Ask,
                    RiskClass = "high",
                    Reason = ruleReason,
                    HostCardText = $"Execute shell command: {cmd}"
                };
            }

            // Destructive deletes are always high-risk
            if (tool.Safety == "destructive" || string.Equals(tool.Name, "delete_path", StringComparison.OrdinalIgnoreCase)) {
                string p = args?["path"]?.Value<string>() ?? "";
                return new PermissionDecision {
                    Kind = PermissionDecisionKind.Ask,
                    RiskClass = "high",
                    Reason = "Destructive delete requires native/TTY confirmation.",
                    HostCardText = $"Move workspace path to trash: {p}"
                };
            }

            // Safe reads
            if (tool.Safety == "read") {
                if (autonomy == "ask_all") {
                    return new PermissionDecision {
                        Kind = PermissionDecisionKind.Ask,
                        RiskClass = "low",
                        Reason = "Autonomy is ask_all.",
                        HostCardText = $"Run read tool '{tool.Name}' with args: {CanonicalJson.Serialize(args ?? new JObject())}"
                    };
                }
                return new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Read tool allowed." };
            }

            // Workspace writes (low-risk inside workspace)
            if (autonomy == "full_auto") {
                return new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Allowed under full_auto." };
            }

            if (_sessionApprovals.TryGetValue(sessionId, out var approvedSet)) {
                lock (approvedSet) {
                    if (approvedSet.Contains(tool.Name)) {
                        return new PermissionDecision { Kind = PermissionDecisionKind.Allow, RiskClass = "low", Reason = "Session-approved." };
                    }
                }
            }

            string targetPath = args?["path"]?.Value<string>() ?? "";
            return new PermissionDecision {
                Kind = PermissionDecisionKind.Ask,
                RiskClass = "low",
                Reason = $"Tool '{tool.Name}' requires user approval.",
                HostCardText = string.IsNullOrEmpty(targetPath)
                    ? $"Execute '{tool.Name}'"
                    : $"Modify workspace file ({tool.Name}): {targetPath}"
            };
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
    }
}
