using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Built-in workspace, shell, memory, vault, calculator, and datetime tools ported into the host harness.
    /// Every file/shell operation enforces PermissionEngine.ResolveToolPath and EvaluateCommandRule.
    /// </summary>
    public static class BuiltinTools {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);

        public static void RegisterAll(HarnessEngine engine, string appDataDir) {
            // 1. list_directory
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "list_directory",
                Description = "List files and directories inside the workspace.",
                Category = "files",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["path"] = new JObject { ["type"] = "string" } }
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string full = PermissionEngine.ResolveToolPath(ws, args["path"]?.Value<string>() ?? ".", allowRoot: true);
                    if (!Directory.Exists(full)) throw new DirectoryNotFoundException("Directory not found.");
                    var entries = new JArray();
                    foreach (string d in Directory.GetDirectories(full).Take(200)) {
                        entries.Add(new JObject { ["name"] = Path.GetFileName(d), ["type"] = "directory" });
                    }
                    foreach (string f in Directory.GetFiles(full).Take(200)) {
                        var fi = new FileInfo(f);
                        entries.Add(new JObject { ["name"] = fi.Name, ["type"] = "file", ["size"] = fi.Length });
                    }
                    return new JObject { ["entries"] = entries }.ToString(Formatting.None);
                }
            });

            // 2. read_file (wraps content in <untrusted_file_content>)
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "read_file",
                Description = "Read a UTF-8 text file inside the workspace.",
                Category = "files",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["path"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + rel);
                    string text = File.ReadAllText(full, Utf8NoBom);
                    return UntrustedContent.Wrap("file", rel, text);
                }
            });

            // 3. read_file_range
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "read_file_range",
                Description = "Read specific 1-based line range from a workspace file.",
                Category = "files",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["path"] = new JObject { ["type"] = "string" },
                        ["startLine"] = new JObject { ["type"] = "integer" },
                        ["endLine"] = new JObject { ["type"] = "integer" }
                    },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + rel);
                    string[] lines = File.ReadAllLines(full, Utf8NoBom);
                    int start = Math.Max(1, args["startLine"]?.Value<int>() ?? 1);
                    int end = Math.Min(lines.Length, args["endLine"]?.Value<int>() ?? Math.Min(lines.Length, start + 199));
                    var sb = new StringBuilder();
                    for (int i = start; i <= end; i++) sb.Append(i).Append(": ").AppendLine(lines[i - 1]);
                    return UntrustedContent.Wrap("file", $"{rel}:{start}-{end}", sb.ToString());
                }
            });

            // 4. search_files
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "search_files",
                Description = "Search text across files in the workspace.",
                Category = "files",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["query"] = new JObject { ["type"] = "string" },
                        ["path"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("query")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string query = args["query"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, args["path"]?.Value<string>() ?? ".", allowRoot: true);
                    var matches = new JArray();
                    foreach (string file in Directory.EnumerateFiles(full, "*", SearchOption.AllDirectories)) {
                        ct.ThrowIfCancellationRequested();
                        if (matches.Count >= 50) break;
                        if (file.Contains("\\.git\\") || file.Contains("\\node_modules\\")) continue;
                        try {
                            var fi = new FileInfo(file);
                            if (fi.Length > 512 * 1024) continue;
                            string[] lines = File.ReadAllLines(file, Utf8NoBom);
                            for (int i = 0; i < lines.Length && matches.Count < 50; i++) {
                                if (lines[i].IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0) {
                                    matches.Add(new JObject {
                                        ["path"] = file.Substring(Path.GetFullPath(ws).Length).TrimStart('\\', '/'),
                                        ["line"] = i + 1,
                                        ["snippet"] = lines[i].Length > 200 ? lines[i].Substring(0, 200) : lines[i]
                                    });
                                }
                            }
                        } catch { }
                    }
                    return new JObject { ["matches"] = matches }.ToString(Formatting.None);
                }
            });

            // 5. create_file
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "create_file",
                Description = "Create or overwrite a UTF-8 file inside the workspace.",
                Category = "files",
                Safety = "write",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["path"] = new JObject { ["type"] = "string" },
                        ["content"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("path", "content")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string content = args["content"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    Directory.CreateDirectory(Path.GetDirectoryName(full));
                    File.WriteAllText(full, content, Utf8NoBom);
                    return new JObject { ["created"] = rel, ["bytes"] = Utf8NoBom.GetByteCount(content) }.ToString(Formatting.None);
                }
            });

            // 6. edit_file
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "edit_file",
                Description = "Replace target text or overwrite a workspace file.",
                Category = "files",
                Safety = "write",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["path"] = new JObject { ["type"] = "string" },
                        ["oldText"] = new JObject { ["type"] = "string" },
                        ["newText"] = new JObject { ["type"] = "string" },
                        ["content"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    string oldText = args["oldText"]?.Value<string>();
                    string newText = args["newText"]?.Value<string>() ?? "";
                    if (!string.IsNullOrEmpty(oldText)) {
                        if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + rel);
                        string existing = File.ReadAllText(full, Utf8NoBom);
                        if (!existing.Contains(oldText)) throw new InvalidOperationException("oldText not found in file.");
                        File.WriteAllText(full, existing.Replace(oldText, newText), Utf8NoBom);
                    } else {
                        string content = args["content"]?.Value<string>() ?? newText;
                        Directory.CreateDirectory(Path.GetDirectoryName(full));
                        File.WriteAllText(full, content, Utf8NoBom);
                    }
                    return new JObject { ["edited"] = rel }.ToString(Formatting.None);
                }
            });

            // 7. create_directory
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "create_directory",
                Description = "Create a directory inside the workspace.",
                Category = "files",
                Safety = "write",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["path"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    Directory.CreateDirectory(full);
                    return new JObject { ["createdDirectory"] = rel }.ToString(Formatting.None);
                }
            });

            // 8. delete_path (moves to recoverable tool-trash)
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "delete_path",
                Description = "Move a workspace file or directory to recoverable tool-trash.",
                Category = "files",
                Safety = "destructive",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["path"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    string trashDir = Path.Combine(appDataDir, "tool-trash");
                    Directory.CreateDirectory(trashDir);
                    string dest = Path.Combine(trashDir, DateTime.UtcNow.ToString("yyyyMMddHHmmss") + "_" + Path.GetFileName(full));
                    if (File.Exists(full)) File.Move(full, dest);
                    else if (Directory.Exists(full)) Directory.Move(full, dest);
                    else throw new FileNotFoundException("Path not found: " + rel);
                    return new JObject { ["deleted"] = rel, ["recoverableAt"] = dest }.ToString(Formatting.None);
                }
            });

            // 9. present_file
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "present_file",
                Description = "Surface a workspace file in the viewer/artifacts panel.",
                Category = "files",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["path"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("path")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string rel = args["path"]?.Value<string>() ?? "";
                    string full = PermissionEngine.ResolveToolPath(ws, rel, allowRoot: false);
                    if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + rel);
                    return new JObject { ["presented"] = rel }.ToString(Formatting.None);
                }
            });

            // 10. run_command
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "run_command",
                Description = "Run a shell command inside the workspace (subject to host command rules).",
                Category = "shell",
                Safety = "exec",
                TimeoutMs = 30000,
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["command"] = new JObject { ["type"] = "string" },
                        ["cwd"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("command")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string cmd = args["command"]?.Value<string>() ?? "";
                    string cwd = PermissionEngine.ResolveToolPath(ws, args["cwd"]?.Value<string>() ?? ".", allowRoot: true);
                    int timeoutMs = Math.Max(1000, Math.Min(120000, args["timeoutMs"]?.Value<int>() ?? 30000));
                    const int maxOutChars = 65536;
                    const int maxErrChars = 32768;

                    var psi = new ProcessStartInfo {
                        FileName = "powershell.exe",
                        Arguments = "-NoProfile -NonInteractive -Command \"" + cmd.Replace("\"", "\\\"") + "\"",
                        WorkingDirectory = cwd,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    // Strip secret/token environment variables before spawning child shell
                    var keysToRemove = new List<string>();
                    foreach (System.Collections.DictionaryEntry kv in psi.EnvironmentVariables) {
                        string k = (kv.Key?.ToString() ?? "").ToUpperInvariant();
                        if (k.Contains("KEY") || k.Contains("TOKEN") || k.Contains("SECRET") ||
                            k.Contains("PASSWORD") || k.Contains("CREDENTIAL") ||
                            k.StartsWith("AWS_") || k.StartsWith("AZURE_") || k.StartsWith("GH_") || k.StartsWith("GITHUB_")) {
                            keysToRemove.Add(kv.Key.ToString());
                        }
                    }
                    foreach (string k in keysToRemove) {
                        try { psi.EnvironmentVariables.Remove(k); } catch { }
                    }
                    psi.EnvironmentVariables["OLLAMA_NO_CLOUD"] = "1";

                    var outSb = new StringBuilder();
                    var errSb = new StringBuilder();
                    bool outTruncated = false;
                    bool errTruncated = false;
                    bool timedOut = false;

                    using (var job = new ProcessJobObject(jobMemoryLimitBytes: 1024L * 1024 * 1024, activeProcessLimit: 16))
                    using (var proc = new Process { StartInfo = psi }) {
                        proc.OutputDataReceived += (s, e) => {
                            if (e.Data == null) return;
                            lock (outSb) {
                                if (outSb.Length < maxOutChars) outSb.AppendLine(e.Data);
                                else outTruncated = true;
                            }
                        };
                        proc.ErrorDataReceived += (s, e) => {
                            if (e.Data == null) return;
                            lock (errSb) {
                                if (errSb.Length < maxErrChars) errSb.AppendLine(e.Data);
                                else errTruncated = true;
                            }
                        };
                        proc.Start();
                        job.Assign(proc);
                        proc.BeginOutputReadLine();
                        proc.BeginErrorReadLine();
                        using (ct.Register(() => { try { if (!proc.HasExited) proc.Kill(); } catch { } })) {
                            if (!proc.WaitForExit(timeoutMs)) {
                                timedOut = true;
                                try { proc.Kill(); } catch { }
                            } else {
                                proc.WaitForExit();
                            }
                        }
                        ct.ThrowIfCancellationRequested();
                        string stdoutStr = outSb.ToString();
                        string stderrStr = errSb.ToString();
                        if (outTruncated) stdoutStr += "\n[stdout truncated at 64 KB]";
                        if (errTruncated) stderrStr += "\n[stderr truncated at 32 KB]";
                        return new JObject {
                            ["exitCode"] = timedOut ? -1 : proc.ExitCode,
                            ["timedOut"] = timedOut,
                            ["stdout"] = stdoutStr,
                            ["stderr"] = stderrStr
                        }.ToString(Formatting.None);
                    }
                }
            });

            // 11. memory_save & 12. memory_recall (backed by HostMemoryService with provenance & caps)
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "memory_save",
                Description = "Save a redacted durable fact to local host memory with provenance.",
                Category = "memory",
                Safety = "write",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["content"] = new JObject { ["type"] = "string" },
                        ["category"] = new JObject { ["type"] = "string" }
                    },
                    ["required"] = new JArray("content")
                },
                Execute = (args, ct) => {
                    string content = args["content"]?.Value<string>() ?? "";
                    string category = args["category"]?.Value<string>() ?? "fact";
                    string provenance = args["_provenance"]?.Value<string>() ?? "model-after-untrusted-content";
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    var entry = engine.Memory.Save(content, category, provenance, sid);
                    return entry.ToString(Formatting.None);
                }
            });

            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "memory_recall",
                Description = "Search saved durable facts from local host memory.",
                Category = "memory",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["query"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("query")
                },
                Execute = (args, ct) => {
                    string q = (args["query"]?.Value<string>() ?? "").Trim();
                    return new JObject { ["facts"] = engine.Memory.Recall(q) }.ToString(Formatting.None);
                }
            });

            // 13. vault_search
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "vault_search",
                Description = "Search local workspace/vault documents and return matching excerpts.",
                Category = "vault",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["query"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("query")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    string q = (args["query"]?.Value<string>() ?? "").Trim();
                    string root = PermissionEngine.ResolveToolPath(ws, ".", allowRoot: true);
                    var hits = new JArray();
                    foreach (string f in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)) {
                        ct.ThrowIfCancellationRequested();
                        if (hits.Count >= 10) break;
                        string ext = Path.GetExtension(f).ToLowerInvariant();
                        if (ext != ".md" && ext != ".txt" && ext != ".json" && ext != ".csv") continue;
                        try {
                            string text = File.ReadAllText(f, Utf8NoBom);
                            int idx = text.IndexOf(q, StringComparison.OrdinalIgnoreCase);
                            if (idx >= 0) {
                                int start = Math.Max(0, idx - 80);
                                int len = Math.Min(text.Length - start, 240);
                                hits.Add(new JObject {
                                    ["source"] = f.Substring(root.Length).TrimStart('\\', '/'),
                                    ["excerpt"] = text.Substring(start, len)
                                });
                            }
                        } catch { }
                    }
                    return new JObject { ["results"] = hits }.ToString(Formatting.None);
                }
            });

            // 14. calculator (safe recursive descent, zero eval)
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "calculator",
                Description = "Safely evaluate an arithmetic expression (+, -, *, /, %, ^, parentheses).",
                Category = "utility",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["expression"] = new JObject { ["type"] = "string" } },
                    ["required"] = new JArray("expression")
                },
                Execute = (args, ct) => {
                    string expr = args["expression"]?.Value<string>() ?? "";
                    double val = SafeMathEvaluate(expr);
                    return new JObject { ["expression"] = expr, ["result"] = val }.ToString(Formatting.None);
                }
            });

            // 15. datetime
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "datetime",
                Description = "Return current UTC and local date/time.",
                Category = "utility",
                Safety = "read",
                InputSchema = new JObject { ["type"] = "object", ["properties"] = new JObject() },
                Execute = (args, ct) => new JObject {
                    ["utc"] = DateTime.UtcNow.ToString("o"),
                    ["local"] = DateTime.Now.ToString("o")
                }.ToString(Formatting.None)
            });
        }

        public static double SafeMathEvaluate(string expr) {
            string s = (expr ?? "").Trim();
            if (string.IsNullOrEmpty(s)) throw new ArgumentException("Empty expression.");
            foreach (char c in s) {
                if (!char.IsDigit(c) && "+-*/().%^ \t".IndexOf(c) < 0) {
                    throw new ArgumentException("Disallowed character in math expression.");
                }
            }
            int pos = 0;
            void SkipWs() { while (pos < s.Length && char.IsWhiteSpace(s[pos])) pos++; }
            double ParseExpr(int d) {
                if (d > 64) throw new ArgumentException("Expression too deep.");
                double left = ParseTerm(d + 1);
                for (;;) {
                    SkipWs();
                    if (pos < s.Length && (s[pos] == '+' || s[pos] == '-')) {
                        char op = s[pos++];
                        double right = ParseTerm(d + 1);
                        left = op == '+' ? left + right : left - right;
                    } else break;
                }
                return left;
            }
            double ParseTerm(int d) {
                double left = ParseUnary(d + 1);
                for (;;) {
                    SkipWs();
                    if (pos < s.Length && (s[pos] == '*' || s[pos] == '/' || s[pos] == '%')) {
                        char op = s[pos++];
                        double right = ParseUnary(d + 1);
                        if (op == '*') left *= right;
                        else if (op == '/') { if (right == 0) throw new DivideByZeroException(); left /= right; }
                        else left %= right;
                    } else break;
                }
                return left;
            }
            double ParseUnary(int d) {
                if (d > 64) throw new ArgumentException("Expression too deep.");
                SkipWs();
                if (pos < s.Length && s[pos] == '+') { pos++; return ParseUnary(d + 1); }
                if (pos < s.Length && s[pos] == '-') { pos++; return -ParseUnary(d + 1); }
                return ParsePower(d + 1);
            }
            double ParsePower(int d) {
                double b = ParsePrimary(d + 1);
                SkipWs();
                if (pos < s.Length && s[pos] == '^') { pos++; return Math.Pow(b, ParseUnary(d + 1)); }
                return b;
            }
            double ParsePrimary(int d) {
                SkipWs();
                if (pos < s.Length && s[pos] == '(') {
                    pos++;
                    double v = ParseExpr(d + 1);
                    SkipWs();
                    if (pos >= s.Length || s[pos] != ')') throw new ArgumentException("Mismatched parentheses.");
                    pos++;
                    return v;
                }
                int start = pos;
                bool sawDot = false;
                while (pos < s.Length && (char.IsDigit(s[pos]) || (s[pos] == '.' && !sawDot))) {
                    if (s[pos] == '.') sawDot = true;
                    pos++;
                }
                if (pos == start) throw new ArgumentException("Unexpected token at " + pos);
                return double.Parse(s.Substring(start, pos - start), CultureInfo.InvariantCulture);
            }

            double result = ParseExpr(0);
            SkipWs();
            if (pos != s.Length || double.IsNaN(result) || double.IsInfinity(result)) {
                throw new ArgumentException("Invalid math expression.");
            }
            return result;
        }
    }
}
