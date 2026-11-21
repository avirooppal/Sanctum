using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Untrusted-content tagging and breakout neutralization across files, web, MCP, clipboard, and logs.
    /// </summary>
    public static class UntrustedContent {
        private static readonly HashSet<string> AllowedKinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "file", "web", "mcp", "clipboard", "log"
        };

        public static string Wrap(string kind, string label, string raw) {
            string k = AllowedKinds.Contains(kind ?? "") ? kind.ToLowerInvariant() : "file";
            string tag = $"untrusted_{k}_content";
            string safeLabel = (label ?? "").Replace("\"", "'").Replace("<", "").Replace(">", "");
            string redacted = SecretsRedactor.Redact(raw ?? "");
            // Neutralize any closing-tag breakout attempt (case-insensitive)
            string neutralized = System.Text.RegularExpressions.Regex.Replace(
                redacted,
                $"</\\s*{tag}\\s*>",
                $"&lt;/{tag}&gt;",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            string attr = k == "file" ? "path" : "source";
            return $"<{tag} {attr}=\"{safeLabel}\">\n{neutralized}\n</{tag}>";
        }
    }

    /// <summary>
    /// Host-side append-only Audit Logger (redacted, user-only ACL).
    /// </summary>
    public sealed class HarnessAuditLog {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _auditPath;
        private readonly object _lock = new object();

        public HarnessAuditLog(string appDataDir) {
            Directory.CreateDirectory(appDataDir);
            _auditPath = Path.Combine(appDataDir, "audit.jsonl");
        }

        public void Record(string sessionId, string tool, string action, string target, string decision, string reason, string channel = "harness") {
            try {
                var entry = new JObject {
                    ["ts"] = DateTime.UtcNow.ToString("o"),
                    ["sessionId"] = sessionId ?? "",
                    ["tool"] = tool ?? "",
                    ["action"] = action ?? "",
                    ["target"] = SecretsRedactor.Redact(target ?? ""),
                    ["decision"] = decision ?? "",
                    ["reason"] = SecretsRedactor.Redact(reason ?? ""),
                    ["channel"] = channel ?? "harness"
                };
                string line = CanonicalJson.Serialize(entry) + "\n";
                lock (_lock) {
                    bool isNew = !File.Exists(_auditPath);
                    File.AppendAllText(_auditPath, line, Utf8NoBom);
                    if (isNew) WindowsAclHelper.ApplyUserOnlyFileAcl(_auditPath);
                }
            } catch { }
        }

        public JArray ReadRecent(int limit = 100) {
            var arr = new JArray();
            lock (_lock) {
                if (!File.Exists(_auditPath)) return arr;
                string[] lines = File.ReadAllLines(_auditPath, Utf8NoBom);
                int start = Math.Max(0, lines.Length - Math.Max(1, limit));
                for (int i = start; i < lines.Length; i++) {
                    if (string.IsNullOrWhiteSpace(lines[i])) continue;
                    try { arr.Add(CanonicalJson.ParseObject(lines[i])); } catch { }
                }
            }
            return arr;
        }
    }

    /// <summary>
    /// Host-side workspace Checkpoint, Unified Diff, and Rewind service.
    /// </summary>
    public sealed class CheckpointService {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _checkpointsDir;

        public CheckpointService(string appDataDir) {
            _checkpointsDir = Path.Combine(appDataDir, "sessions", "checkpoints");
            WindowsAclHelper.ApplyUserOnlyDirectoryAcl(_checkpointsDir);
        }

        public JObject CreateCheckpoint(string sessionId, string workspaceRoot, string label = null) {
            string cpId = "cp_" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + "_" + Guid.NewGuid().ToString("N").Substring(0, 6);
            string cpDir = Path.Combine(_checkpointsDir, cpId);
            string filesDir = Path.Combine(cpDir, "files");
            Directory.CreateDirectory(filesDir);

            string root = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            var manifest = new JObject();
            int fileCount = 0;

            if (Directory.Exists(root)) {
                foreach (string file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)) {
                    if (fileCount >= 500) break;
                    if (file.Contains("\\.git\\") || file.Contains("\\node_modules\\") || file.Contains("\\.next\\")) continue;
                    try {
                        var fi = new FileInfo(file);
                        if (fi.Length > 2 * 1024 * 1024) continue;
                        string rel = file.Substring(root.Length).TrimStart('\\', '/');
                        string dest = Path.Combine(filesDir, rel);
                        Directory.CreateDirectory(Path.GetDirectoryName(dest));
                        File.Copy(file, dest, true);
                        manifest[rel.Replace('\\', '/')] = CanonicalJson.Sha256HexBytes(File.ReadAllBytes(file));
                        fileCount++;
                    } catch { }
                }
            }

            var meta = new JObject {
                ["checkpointId"] = cpId,
                ["sessionId"] = sessionId,
                ["workspace"] = root,
                ["label"] = label ?? "auto",
                ["createdAt"] = DateTime.UtcNow.ToString("o"),
                ["fileCount"] = fileCount,
                ["files"] = manifest
            };
            File.WriteAllText(Path.Combine(cpDir, "meta.json"), meta.ToString(Formatting.Indented), Utf8NoBom);
            return meta;
        }

        public JObject ComputeDiff(string checkpointId, string workspaceRoot) {
            string cpDir = Path.Combine(_checkpointsDir, SanitizeId(checkpointId));
            string metaPath = Path.Combine(cpDir, "meta.json");
            if (!File.Exists(metaPath)) throw new KeyNotFoundException("Checkpoint not found: " + checkpointId);
            var meta = CanonicalJson.ParseObject(File.ReadAllText(metaPath, Utf8NoBom));
            string root = Path.GetFullPath(string.IsNullOrEmpty(workspaceRoot) ? meta["workspace"].Value<string>() : workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            string filesDir = Path.Combine(cpDir, "files");
            var prevFiles = meta["files"] as JObject ?? new JObject();

            var changes = new JArray();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var prop in prevFiles.Properties()) {
                seen.Add(prop.Name);
                string oldPath = Path.Combine(filesDir, prop.Name.Replace('/', Path.DirectorySeparatorChar));
                string curPath = Path.Combine(root, prop.Name.Replace('/', Path.DirectorySeparatorChar));
                string oldText = File.Exists(oldPath) ? File.ReadAllText(oldPath, Utf8NoBom) : "";
                if (!File.Exists(curPath)) {
                    changes.Add(new JObject {
                        ["path"] = prop.Name,
                        ["status"] = "deleted",
                        ["diff"] = BuildUnifiedDiff(prop.Name, oldText, "")
                    });
                } else {
                    string curText = File.ReadAllText(curPath, Utf8NoBom);
                    if (oldText != curText) {
                        changes.Add(new JObject {
                            ["path"] = prop.Name,
                            ["status"] = "modified",
                            ["diff"] = BuildUnifiedDiff(prop.Name, oldText, curText)
                        });
                    }
                }
            }

            if (Directory.Exists(root)) {
                foreach (string file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)) {
                    if (file.Contains("\\.git\\") || file.Contains("\\node_modules\\")) continue;
                    string rel = file.Substring(root.Length).TrimStart('\\', '/').Replace('\\', '/');
                    if (seen.Contains(rel)) continue;
                    try {
                        if (new FileInfo(file).Length > 2 * 1024 * 1024) continue;
                        string curText = File.ReadAllText(file, Utf8NoBom);
                        changes.Add(new JObject {
                            ["path"] = rel,
                            ["status"] = "added",
                            ["diff"] = BuildUnifiedDiff(rel, "", curText)
                        });
                    } catch { }
                }
            }

            return new JObject {
                ["checkpointId"] = checkpointId,
                ["changes"] = changes
            };
        }

        public JObject RewindFiles(string checkpointId, string workspaceRoot) {
            string cpDir = Path.Combine(_checkpointsDir, SanitizeId(checkpointId));
            string metaPath = Path.Combine(cpDir, "meta.json");
            if (!File.Exists(metaPath)) throw new KeyNotFoundException("Checkpoint not found: " + checkpointId);
            var meta = CanonicalJson.ParseObject(File.ReadAllText(metaPath, Utf8NoBom));
            string root = Path.GetFullPath(string.IsNullOrEmpty(workspaceRoot) ? meta["workspace"].Value<string>() : workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            string filesDir = Path.Combine(cpDir, "files");
            var prevFiles = meta["files"] as JObject ?? new JObject();
            var keepSet = new HashSet<string>(prevFiles.Properties().Select(p => p.Name), StringComparer.OrdinalIgnoreCase);

            int restored = 0, removed = 0;
            // Remove files added after checkpoint
            if (Directory.Exists(root)) {
                foreach (string file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories).ToList()) {
                    if (file.Contains("\\.git\\") || file.Contains("\\node_modules\\")) continue;
                    string rel = file.Substring(root.Length).TrimStart('\\', '/').Replace('\\', '/');
                    if (!keepSet.Contains(rel)) {
                        try { File.Delete(file); removed++; } catch { }
                    }
                }
            }
            // Restore snapshot files
            foreach (var prop in prevFiles.Properties()) {
                string src = Path.Combine(filesDir, prop.Name.Replace('/', Path.DirectorySeparatorChar));
                string dst = Path.Combine(root, prop.Name.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(src)) {
                    Directory.CreateDirectory(Path.GetDirectoryName(dst));
                    File.Copy(src, dst, true);
                    restored++;
                }
            }
            return new JObject {
                ["checkpointId"] = checkpointId,
                ["restoredFiles"] = restored,
                ["removedFiles"] = removed
            };
        }

        private static string SanitizeId(string id) {
            if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("Invalid checkpointId");
            foreach (char c in id) {
                if (!char.IsLetterOrDigit(c) && c != '_' && c != '-') throw new ArgumentException("Invalid checkpointId");
            }
            return id;
        }

        private static string BuildUnifiedDiff(string path, string before, string after) {
            string[] a = (before ?? "").Replace("\r\n", "\n").Split('\n');
            string[] b = (after ?? "").Replace("\r\n", "\n").Split('\n');
            var sb = new StringBuilder();
            sb.AppendLine($"--- a/{path}");
            sb.AppendLine($"+++ b/{path}");
            int max = Math.Max(a.Length, b.Length);
            for (int i = 0; i < max; i++) {
                string la = i < a.Length ? a[i] : null;
                string lb = i < b.Length ? b[i] : null;
                if (la == lb) {
                    if (la != null) sb.Append(" ").AppendLine(la);
                } else {
                    if (la != null && !(before == "" && i == 0)) sb.Append("-").AppendLine(la);
                    if (lb != null && !(after == "" && i == 0)) sb.Append("+").AppendLine(lb);
                }
            }
            return sb.ToString();
        }
    }

    /// <summary>
    /// Host-side Background Task Manager with bounded ring-buffered output and clean process kill.
    /// </summary>
    public sealed class BackgroundTaskManager : IDisposable {
        private sealed class ManagedTask {
            public string TaskId;
            public string SessionId;
            public string Command;
            public string Cwd;
            public Process Proc;
            public readonly StringBuilder Output = new StringBuilder();
            public readonly object Lock = new object();
            public volatile bool Exited;
            public int ExitCode;
            public string StartedAt;
        }

        private readonly ConcurrentDictionary<string, ManagedTask> _tasks = new ConcurrentDictionary<string, ManagedTask>(StringComparer.OrdinalIgnoreCase);

        public int ActiveCount => _tasks.Values.Count(t => !t.Exited);

        public JObject StartTask(string sessionId, string command, string workspaceRoot) {
            string cwd = PermissionEngine.ResolveToolPath(workspaceRoot, ".", allowRoot: true);
            string id = "bg_" + Guid.NewGuid().ToString("N").Substring(0, 10);
            var psi = new ProcessStartInfo {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -NonInteractive -Command \"" + command.Replace("\"", "\\\"") + "\"",
                WorkingDirectory = cwd,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
            var mt = new ManagedTask {
                TaskId = id,
                SessionId = sessionId,
                Command = command,
                Cwd = cwd,
                Proc = proc,
                StartedAt = DateTime.UtcNow.ToString("o")
            };

            void AppendRing(string line) {
                if (line == null) return;
                string clean = SecretsRedactor.Redact(line);
                lock (mt.Lock) {
                    mt.Output.AppendLine(clean);
                    if (mt.Output.Length > 65536) {
                        mt.Output.Remove(0, mt.Output.Length - 65536);
                    }
                }
            }

            proc.OutputDataReceived += (s, e) => AppendRing(e.Data);
            proc.ErrorDataReceived += (s, e) => AppendRing(e.Data != null ? "[stderr] " + e.Data : null);
            proc.Exited += (s, e) => {
                mt.Exited = true;
                try { mt.ExitCode = proc.ExitCode; } catch { mt.ExitCode = -1; }
            };

            proc.Start();
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();
            _tasks[id] = mt;

            return new JObject {
                ["taskId"] = id,
                ["sessionId"] = sessionId,
                ["pid"] = proc.Id,
                ["command"] = SecretsRedactor.Redact(command),
                ["status"] = "running",
                ["startedAt"] = mt.StartedAt
            };
        }

        public JArray ListTasks(string sessionId = null) {
            var arr = new JArray();
            foreach (var t in _tasks.Values) {
                if (!string.IsNullOrEmpty(sessionId) && !string.Equals(t.SessionId, sessionId, StringComparison.OrdinalIgnoreCase)) continue;
                arr.Add(new JObject {
                    ["taskId"] = t.TaskId,
                    ["sessionId"] = t.SessionId,
                    ["command"] = SecretsRedactor.Redact(t.Command),
                    ["status"] = t.Exited ? "exited" : "running",
                    ["exitCode"] = t.Exited ? (JToken)t.ExitCode : JValue.CreateNull(),
                    ["startedAt"] = t.StartedAt
                });
            }
            return arr;
        }

        public JObject ReadOutput(string taskId) {
            if (!_tasks.TryGetValue(taskId, out var t)) throw new KeyNotFoundException("Background task not found: " + taskId);
            string text;
            lock (t.Lock) text = t.Output.ToString();
            return new JObject {
                ["taskId"] = t.TaskId,
                ["status"] = t.Exited ? "exited" : "running",
                ["exitCode"] = t.Exited ? (JToken)t.ExitCode : JValue.CreateNull(),
                ["output"] = text
            };
        }

        public JObject KillTask(string taskId) {
            if (!_tasks.TryGetValue(taskId, out var t)) throw new KeyNotFoundException("Background task not found: " + taskId);
            try { if (!t.Proc.HasExited) t.Proc.Kill(); } catch { }
            t.Exited = true;
            return new JObject { ["taskId"] = t.TaskId, ["killed"] = true };
        }

        public void Dispose() {
            foreach (var t in _tasks.Values) {
                try { if (!t.Proc.HasExited) t.Proc.Kill(); } catch { }
                try { t.Proc.Dispose(); } catch { }
            }
            _tasks.Clear();
        }
    }
}
