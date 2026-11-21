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
    /// Host-side Git Worktree Manager for isolated parallel agent/subagent workspaces.
    /// </summary>
    public sealed class WorktreeManager {
        private readonly string _worktreesRoot;
        private readonly ConcurrentDictionary<string, string> _sessionWorktrees = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public WorktreeManager(string appDataDir) {
            _worktreesRoot = Path.Combine(appDataDir, "worktrees");
            WindowsAclHelper.ApplyUserOnlyDirectoryAcl(_worktreesRoot);
        }

        public string GetWorktreePath(string sessionId) {
            return _sessionWorktrees.TryGetValue(sessionId ?? "", out var p) ? p : null;
        }

        public JObject CreateWorktree(string repoRoot, string sessionId) {
            if (string.IsNullOrWhiteSpace(repoRoot) || !Directory.Exists(repoRoot)) {
                throw new ArgumentException("Repository workspace does not exist.");
            }
            string safeId = sessionId.Replace("/", "").Replace("\\", "").Replace("..", "");
            string wtDir = Path.Combine(_worktreesRoot, safeId);
            string branch = "sanctum/wt-" + safeId;

            var (code, stdout, stderr) = RunGit(repoRoot, $"worktree add -b \"{branch}\" \"{wtDir}\" HEAD");
            if (code != 0) {
                throw new InvalidOperationException("git worktree add failed: " + (string.IsNullOrWhiteSpace(stderr) ? stdout : stderr).Trim());
            }
            _sessionWorktrees[sessionId] = wtDir;
            return new JObject {
                ["sessionId"] = sessionId,
                ["branch"] = branch,
                ["worktreePath"] = wtDir
            };
        }

        public JObject RemoveWorktree(string repoRoot, string sessionId) {
            if (!_sessionWorktrees.TryRemove(sessionId, out var wtDir)) {
                wtDir = Path.Combine(_worktreesRoot, sessionId);
            }
            if (Directory.Exists(wtDir)) {
                RunGit(repoRoot, $"worktree remove --force \"{wtDir}\"");
                if (Directory.Exists(wtDir)) {
                    try { Directory.Delete(wtDir, true); } catch { }
                }
            }
            string branch = "sanctum/wt-" + sessionId;
            RunGit(repoRoot, $"branch -D \"{branch}\"");
            return new JObject { ["sessionId"] = sessionId, ["removed"] = true };
        }

        public JArray ListWorktrees() {
            var arr = new JArray();
            foreach (var kv in _sessionWorktrees) {
                arr.Add(new JObject {
                    ["sessionId"] = kv.Key,
                    ["worktreePath"] = kv.Value,
                    ["exists"] = Directory.Exists(kv.Value)
                });
            }
            return arr;
        }

        private static (int code, string stdout, string stderr) RunGit(string cwd, string args) {
            var psi = new ProcessStartInfo {
                FileName = "git",
                Arguments = args,
                WorkingDirectory = cwd,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (var p = Process.Start(psi)) {
                string o = p.StandardOutput.ReadToEnd();
                string e = p.StandardError.ReadToEnd();
                p.WaitForExit(15000);
                return (p.ExitCode, o, e);
            }
        }
    }

    /// <summary>
    /// Registers Phase 3 orchestration tools: todo_write, todo_read, spawn_subagent, and repo_map.
    /// </summary>
    public static class OrchestrationTools {
        public static void RegisterAll(HarnessEngine engine) {
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "todo_write",
                Description = "Replace the current session's structured todo list.",
                Category = "planning",
                Safety = "read", // session-scoped metadata only, never mutates workspace files
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["items"] = new JObject { ["type"] = "array" }
                    },
                    ["required"] = new JArray("items")
                },
                Execute = (args, ct) => {
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    var items = args["items"] as JArray ?? new JArray();
                    engine.UpdateTodos(sid, items);
                    return new JObject { ["ok"] = true, ["count"] = items.Count }.ToString(Formatting.None);
                }
            });

            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "todo_read",
                Description = "Read the current session's todo list.",
                Category = "planning",
                Safety = "read",
                InputSchema = new JObject { ["type"] = "object", ["properties"] = new JObject() },
                Execute = (args, ct) => {
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    return new JObject { ["items"] = engine.GetTodos(sid) }.ToString(Formatting.None);
                }
            });

            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "repo_map",
                Description = "Generate a compact file and top-level symbol map of the workspace.",
                Category = "context",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject { ["maxFiles"] = new JObject { ["type"] = "integer" } }
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? Environment.CurrentDirectory;
                    int maxFiles = Math.Min(300, Math.Max(10, args["maxFiles"]?.Value<int>() ?? 120));
                    return ContextEngine.BuildRepoMap(ws, maxFiles).ToString(Formatting.None);
                }
            });

            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "spawn_subagent",
                Description = "Run a scoped child subagent session and return its summary.",
                Category = "agents",
                Safety = "read", // child session enforces its own PermissionEngine rules
                TimeoutMs = 60000,
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["role"] = new JObject { ["type"] = "string" },
                        ["prompt"] = new JObject { ["type"] = "string" },
                        ["model"] = new JObject { ["type"] = "string" },
                        ["mode"] = new JObject { ["type"] = "string" },
                        ["worktree"] = new JObject { ["type"] = "boolean" }
                    },
                    ["required"] = new JArray("prompt")
                },
                Execute = (args, ct) => {
                    string parentSid = args["_sessionId"]?.Value<string>() ?? "";
                    string role = args["role"]?.Value<string>() ?? "worker";
                    string prompt = args["prompt"]?.Value<string>() ?? "";
                    string model = args["model"]?.Value<string>();
                    string mode = args["mode"]?.Value<string>() ?? "build";
                    bool useWorktree = args["worktree"]?.Value<bool>() ?? false;
                    var res = engine.SpawnSubagentAndWait(parentSid, role, prompt, model, mode, useWorktree, ct);
                    return res.ToString(Formatting.None);
                }
            });
        }
    }
}
