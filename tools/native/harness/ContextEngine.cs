using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Host-side Context Engine: AGENTS.md & .sanctum/rules loader, compact repo map,
    /// @mention resolver (with ToolPath containment), and session compaction.
    /// </summary>
    public static class ContextEngine {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private static readonly HashSet<string> SkipDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            ".git", "node_modules", ".next", "out", "dist", "build", "vendor", "bin", "obj", ".venv", "__pycache__"
        };
        private static readonly Regex SymbolRegex = new Regex(
            @"^\s*(?:export\s+)?(?:public|private|internal|async\s+)?(?:class|interface|struct|enum|function|def|const\s+\w+\s*=\s*(?:async\s*)?\()\s*([A-Za-z_][A-Za-z0-9_]*)",
            RegexOptions.Compiled);
        private static readonly Regex MentionRegex = new Regex(
            @"(?:^|\s)@(file:|folder:|git:)?([A-Za-z0-9_./\\:-]+)",
            RegexOptions.Compiled);

        public static JObject LoadInstructions(string workspaceRoot) {
            var files = new JArray();
            var sb = new StringBuilder();
            if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot)) {
                return new JObject { ["files"] = files, ["combined"] = "" };
            }

            void TryAdd(string relPath) {
                try {
                    string full = PermissionEngine.ResolveToolPath(workspaceRoot, relPath, allowRoot: false);
                    if (!File.Exists(full)) return;
                    string raw = File.ReadAllText(full, Utf8NoBom);
                    if (raw.Length > 16384) raw = raw.Substring(0, 16384) + "\n... [truncated]";
                    files.Add(relPath.Replace('\\', '/'));
                    sb.AppendLine($"### Instruction file: {relPath.Replace('\\', '/')}");
                    sb.AppendLine(UntrustedContent.Wrap("file", relPath.Replace('\\', '/'), raw));
                    sb.AppendLine();
                } catch { }
            }

            TryAdd("AGENTS.md");
            TryAdd(".sanctum/AGENTS.md");

            try {
                string rulesDir = PermissionEngine.ResolveToolPath(workspaceRoot, ".sanctum/rules", allowRoot: false);
                if (Directory.Exists(rulesDir)) {
                    foreach (string f in Directory.GetFiles(rulesDir, "*.md").OrderBy(x => x, StringComparer.OrdinalIgnoreCase).Take(20)) {
                        string rel = ".sanctum/rules/" + Path.GetFileName(f);
                        TryAdd(rel);
                    }
                }
            } catch { }

            return new JObject {
                ["files"] = files,
                ["combined"] = sb.ToString().Trim()
            };
        }

        public static JObject BuildRepoMap(string workspaceRoot, int maxFiles = 120) {
            var entries = new JArray();
            var sb = new StringBuilder();
            if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot)) {
                return new JObject { ["fileCount"] = 0, ["entries"] = entries, ["text"] = "" };
            }

            string root = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
            var queue = new Queue<string>();
            queue.Enqueue(root);

            while (queue.Count > 0 && entries.Count < maxFiles) {
                string dir = queue.Dequeue();
                string[] subDirs;
                string[] files;
                try {
                    subDirs = Directory.GetDirectories(dir).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToArray();
                    files = Directory.GetFiles(dir).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToArray();
                } catch {
                    continue;
                }

                foreach (string sd in subDirs) {
                    string name = Path.GetFileName(sd);
                    if (SkipDirs.Contains(name)) continue;
                    queue.Enqueue(sd);
                }

                foreach (string f in files) {
                    if (entries.Count >= maxFiles) break;
                    string rel = f.Substring(root.Length).TrimStart('\\', '/').Replace('\\', '/');
                    var symbols = ExtractTopSymbols(f, 8);
                    entries.Add(new JObject {
                        ["path"] = rel,
                        ["symbols"] = new JArray(symbols)
                    });
                    if (symbols.Count > 0) {
                        sb.AppendLine($"{rel}: {string.Join(", ", symbols)}");
                    } else {
                        sb.AppendLine(rel);
                    }
                }
            }

            return new JObject {
                ["fileCount"] = entries.Count,
                ["entries"] = entries,
                ["text"] = sb.ToString().Trim()
            };
        }

        private static List<string> ExtractTopSymbols(string fullPath, int limit) {
            var list = new List<string>();
            string ext = Path.GetExtension(fullPath).ToLowerInvariant();
            if (ext != ".ts" && ext != ".tsx" && ext != ".js" && ext != ".cs" && ext != ".py") return list;
            try {
                if (new FileInfo(fullPath).Length > 256 * 1024) return list;
                foreach (string line in File.ReadLines(fullPath, Utf8NoBom).Take(400)) {
                    var m = SymbolRegex.Match(line);
                    if (m.Success) {
                        string name = m.Groups[1].Value;
                        if (!string.IsNullOrEmpty(name) && !list.Contains(name)) {
                            list.Add(name);
                            if (list.Count >= limit) break;
                        }
                    }
                }
            } catch { }
            return list;
        }

        public static JObject ResolveMentions(string workspaceRoot, string prompt) {
            var resolved = new JArray();
            var errors = new JArray();
            var sb = new StringBuilder();
            if (string.IsNullOrWhiteSpace(prompt) || string.IsNullOrWhiteSpace(workspaceRoot)) {
                return new JObject { ["resolved"] = resolved, ["errors"] = errors, ["contextText"] = "" };
            }

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (Match m in MentionRegex.Matches(prompt)) {
                string prefix = (m.Groups[1].Value ?? "").ToLowerInvariant();
                string target = (m.Groups[2].Value ?? "").TrimEnd('.', ',', ';', ')', ']', '"', '\'');
                if (string.IsNullOrWhiteSpace(target)) continue;
                string key = prefix + target;
                if (!seen.Add(key)) continue;

                if (prefix == "git:") {
                    string sub = target.ToLowerInvariant();
                    string gitArgs = sub == "status" ? "status --short"
                        : sub == "diff" ? "diff --stat"
                        : sub == "log" ? "log -n 10 --oneline"
                        : null;
                    if (gitArgs == null) {
                        errors.Add($"Unsupported @git mention: {target}");
                        continue;
                    }
                    string gitOut = RunSafeGit(workspaceRoot, gitArgs);
                    resolved.Add(new JObject { ["kind"] = "git", ["target"] = sub });
                    sb.AppendLine(UntrustedContent.Wrap("log", "git:" + sub, gitOut));
                    continue;
                }

                try {
                    string full = PermissionEngine.ResolveToolPath(workspaceRoot, target, allowRoot: true);
                    if (prefix == "folder:" || Directory.Exists(full)) {
                        if (!Directory.Exists(full)) {
                            errors.Add($"Folder not found: {target}");
                            continue;
                        }
                        var items = Directory.GetFileSystemEntries(full)
                            .Select(Path.GetFileName)
                            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                            .Take(100);
                        resolved.Add(new JObject { ["kind"] = "folder", ["target"] = target });
                        sb.AppendLine(UntrustedContent.Wrap("file", target, string.Join("\n", items)));
                    } else if (File.Exists(full)) {
                        string raw = File.ReadAllText(full, Utf8NoBom);
                        if (raw.Length > 16384) raw = raw.Substring(0, 16384) + "\n... [truncated]";
                        resolved.Add(new JObject { ["kind"] = "file", ["target"] = target });
                        sb.AppendLine(UntrustedContent.Wrap("file", target, raw));
                    } else if (prefix == "file:") {
                        errors.Add($"File not found: {target}");
                    }
                } catch (Exception ex) {
                    errors.Add($"Blocked mention @{key}: {ex.Message}");
                }
            }

            return new JObject {
                ["resolved"] = resolved,
                ["errors"] = errors,
                ["contextText"] = sb.ToString().Trim()
            };
        }

        private static string RunSafeGit(string workspaceRoot, string arguments) {
            try {
                var psi = new ProcessStartInfo {
                    FileName = "git",
                    Arguments = arguments,
                    WorkingDirectory = PermissionEngine.ResolveToolPath(workspaceRoot, ".", allowRoot: true),
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (var p = Process.Start(psi)) {
                    string stdout = p.StandardOutput.ReadToEnd();
                    string stderr = p.StandardError.ReadToEnd();
                    p.WaitForExit(5000);
                    string combined = string.IsNullOrWhiteSpace(stdout) ? stderr : stdout;
                    return combined.Length > 8192 ? combined.Substring(0, 8192) + "\n... [truncated]" : combined;
                }
            } catch (Exception ex) {
                return "git unavailable: " + ex.Message;
            }
        }

        /// <summary>
        /// Deterministic, offline-safe session compaction: condenses older user/assistant/tool turns
        /// into a structured summary block while keeping the most recent N turns intact.
        /// </summary>
        public static JObject BuildCompactionPayload(List<HarnessEvent> events, int keepRecentMessages = 2) {
            var msgEvents = events.Where(e => e.Type == "user_message" || e.Type == "assistant_message").ToList();
            if (msgEvents.Count <= keepRecentMessages) {
                return null;
            }

            int compactCount = msgEvents.Count - keepRecentMessages;
            long compactedUpToSeq = msgEvents[compactCount - 1].Seq;
            var sb = new StringBuilder();
            sb.AppendLine($"Compacted {compactCount} earlier messages (up to seq {compactedUpToSeq}):");
            int beforeChars = 0;

            for (int i = 0; i < compactCount; i++) {
                var e = msgEvents[i];
                string role = e.Type == "user_message" ? "User" : "Assistant";
                string content = e.Payload?["content"]?.Value<string>() ?? "";
                beforeChars += content.Length;
                string snippet = content.Replace("\r", " ").Replace("\n", " ").Trim();
                if (snippet.Length > 160) snippet = snippet.Substring(0, 160) + "...";
                sb.AppendLine($"- [{role}] {snippet}");
            }

            string summary = SecretsRedactor.Redact(sb.ToString().Trim());
            return new JObject {
                ["compactedUpToSeq"] = compactedUpToSeq,
                ["compactedMessageCount"] = compactCount,
                ["beforeChars"] = beforeChars,
                ["afterChars"] = summary.Length,
                ["summary"] = summary
            };
        }
    }
}
