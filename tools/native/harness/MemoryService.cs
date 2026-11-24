using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 2.3: Host-owned memory store with provenance tracking, secret redaction,
    /// and strict count/size caps.
    /// </summary>
    public sealed class HostMemoryService {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        public const int MaxMemoryCount = 200;
        public const int MaxMemoryChars = 2048;

        private readonly string _appDataDir;
        private readonly string _memPath;
        private readonly object _lock = new object();

        public HostMemoryService(string appDataDir) {
            _appDataDir = Path.GetFullPath(appDataDir);
            _memPath = Path.Combine(_appDataDir, "memory.json");
        }

        private string ResolveMemoryPath(string workspaceId, string scope = null) {
            bool isGlobal = string.IsNullOrWhiteSpace(workspaceId)
                         || string.Equals(scope, "global", StringComparison.OrdinalIgnoreCase);
            if (isGlobal) return _memPath;
            string safe = workspaceId.Trim();
            if (safe.IndexOfAny(new[] { '\\', '/', ':', '*', '?', '"', '<', '>', '|' }) >= 0 || safe.Contains("..")) {
                throw new ArgumentException("Invalid workspaceId.");
            }
            string dir = Path.Combine(_appDataDir, "workspaces", safe);
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "memory.json");
        }

        private JObject LoadRootLocked(string path = null) {
            string p = path ?? _memPath;
            if (!File.Exists(p)) {
                return new JObject { ["enabled"] = true, ["facts"] = new JArray(), ["episodes"] = new JArray() };
            }
            try {
                var obj = CanonicalJson.ParseObject(DataAtRestCrypto.ReadTextFile(p));
                if (!(obj["facts"] is JArray)) obj["facts"] = new JArray();
                return obj;
            } catch {
                return new JObject { ["enabled"] = true, ["facts"] = new JArray(), ["episodes"] = new JArray() };
            }
        }

        private void SaveRootLocked(JObject root, string path = null) {
            DataAtRestCrypto.WriteTextFile(path ?? _memPath, root.ToString(Formatting.Indented));
        }

        public JObject ListAll(string workspaceId = null, bool includeGlobal = false) {
            lock (_lock) {
                string targetPath = ResolveMemoryPath(workspaceId);
                bool isWs = !string.IsNullOrWhiteSpace(workspaceId);
                var facts = new JArray();
                var root = LoadRootLocked(targetPath);
                if (root["facts"] is JArray primary) {
                    foreach (JObject f in primary) {
                        var clone = (JObject)f.DeepClone();
                        clone["scope"] = isWs ? "workspace" : "global";
                        if (isWs) clone["workspaceId"] = workspaceId;
                        facts.Add(clone);
                    }
                }
                if (isWs && includeGlobal) {
                    var globalRoot = LoadRootLocked(_memPath);
                    if (globalRoot["facts"] is JArray gFacts) {
                        foreach (JObject f in gFacts) {
                            var clone = (JObject)f.DeepClone();
                            clone["scope"] = "global";
                            facts.Add(clone);
                        }
                    }
                }
                return new JObject {
                    ["workspaceId"] = workspaceId ?? "",
                    ["scope"] = isWs ? "workspace" : "global",
                    ["facts"] = facts,
                    ["count"] = facts.Count,
                    ["maxCount"] = MaxMemoryCount,
                    ["maxChars"] = MaxMemoryChars
                };
            }
        }

        public JArray Recall(string query, string workspaceId = null) {
            string q = (query ?? "").Trim();
            lock (_lock) {
                var results = new JArray();
                if (!string.IsNullOrWhiteSpace(workspaceId)) {
                    var wsRoot = LoadRootLocked(ResolveMemoryPath(workspaceId));
                    if (wsRoot["facts"] is JArray wsFacts) {
                        foreach (JObject f in wsFacts) {
                            string c = f["content"]?.Value<string>() ?? "";
                            if (string.IsNullOrEmpty(q) || c.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0) {
                                var clone = (JObject)f.DeepClone();
                                clone["scope"] = "workspace";
                                clone["workspaceId"] = workspaceId;
                                results.Add(clone);
                            }
                        }
                    }
                }
                // Also include explicit global memory tier (never other workspaces)
                var globalRoot = LoadRootLocked(_memPath);
                if (globalRoot["facts"] is JArray gFacts) {
                    foreach (JObject f in gFacts) {
                        string c = f["content"]?.Value<string>() ?? "";
                        if (string.IsNullOrEmpty(q) || c.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0) {
                            var clone = (JObject)f.DeepClone();
                            clone["scope"] = "global";
                            results.Add(clone);
                        }
                    }
                }
                return results;
            }
        }

        public JObject Save(string rawContent, string category, string provenance, string sessionId = "", bool pinned = false, string workspaceId = null, string scope = null) {
            string clean = SecretsRedactor.Redact((rawContent ?? "").Trim());
            if (string.IsNullOrEmpty(clean)) {
                throw new ArgumentException("Memory content cannot be empty.");
            }
            if (clean.Length > MaxMemoryChars) {
                throw new ArgumentException($"Memory content exceeds maximum length of {MaxMemoryChars} characters.");
            }
            string prov = NormalizeProvenance(provenance);
            string targetPath = ResolveMemoryPath(workspaceId, scope);
            bool isGlobal = targetPath == _memPath;

            lock (_lock) {
                var root = LoadRootLocked(targetPath);
                var facts = root["facts"] as JArray ?? new JArray();
                if (facts.Count >= MaxMemoryCount) {
                    throw new InvalidOperationException($"Memory store reached maximum capacity ({MaxMemoryCount} entries). Delete older memories first.");
                }
                string now = DateTime.UtcNow.ToString("o");
                var entry = new JObject {
                    ["id"] = "mem_" + Guid.NewGuid().ToString("N").Substring(0, 10),
                    ["content"] = clean,
                    ["category"] = string.IsNullOrWhiteSpace(category) ? "fact" : category.Trim(),
                    ["provenance"] = prov,
                    ["pinned"] = pinned,
                    ["scope"] = isGlobal ? "global" : "workspace",
                    ["workspaceId"] = isGlobal ? "" : (workspaceId ?? ""),
                    ["sessionId"] = sessionId ?? "",
                    ["createdAt"] = now,
                    ["updatedAt"] = now
                };
                facts.Add(entry);
                root["facts"] = facts;
                SaveRootLocked(root, targetPath);
                return entry;
            }
        }

        public (int status, JObject body) Update(string id, JObject patch, string workspaceId = null) {
            lock (_lock) {
                string targetPath = ResolveMemoryPath(workspaceId, patch?["scope"]?.Value<string>());
                var root = LoadRootLocked(targetPath);
                var facts = root["facts"] as JArray ?? new JArray();
                foreach (JObject f in facts) {
                    if (string.Equals(f["id"]?.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) {
                        if (patch["content"] != null) {
                            string clean = SecretsRedactor.Redact((patch["content"].Value<string>() ?? "").Trim());
                            if (string.IsNullOrEmpty(clean)) return (400, new JObject { ["error"] = "Memory content cannot be empty." });
                            if (clean.Length > MaxMemoryChars) return (400, new JObject { ["error"] = $"Memory exceeds {MaxMemoryChars} chars." });
                            f["content"] = clean;
                        }
                        if (patch["category"] != null) f["category"] = patch["category"].Value<string>() ?? "fact";
                        if (patch["pinned"] != null) f["pinned"] = patch["pinned"].Value<bool>();
                        f["updatedAt"] = DateTime.UtcNow.ToString("o");
                        SaveRootLocked(root, targetPath);
                        return (200, f);
                    }
                }
                return (404, new JObject { ["error"] = "Memory not found: " + id });
            }
        }

        public (int status, JObject body) Delete(string id, string workspaceId = null, string scope = null) {
            lock (_lock) {
                string targetPath = ResolveMemoryPath(workspaceId, scope);
                var root = LoadRootLocked(targetPath);
                var facts = root["facts"] as JArray ?? new JArray();
                for (int i = 0; i < facts.Count; i++) {
                    if (string.Equals(facts[i]?["id"]?.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) {
                        facts.RemoveAt(i);
                        SaveRootLocked(root, targetPath);
                        return (200, new JObject { ["deleted"] = id });
                    }
                }
                return (404, new JObject { ["error"] = "Memory not found: " + id });
            }
        }

        public string ExportJson(string workspaceId = null) {
            lock (_lock) {
                return LoadRootLocked(ResolveMemoryPath(workspaceId)).ToString(Formatting.Indented);
            }
        }

        private static string NormalizeProvenance(string raw) {
            switch ((raw ?? "").Trim().ToLowerInvariant()) {
                case "user": return "user";
                case "model-after-user-prompt": return "model-after-user-prompt";
                case "model-after-untrusted-content": return "model-after-untrusted-content";
                case "tool": return "tool";
                default: return "model-after-untrusted-content";
            }
        }
    }
}
