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

        private readonly string _memPath;
        private readonly object _lock = new object();

        public HostMemoryService(string appDataDir) {
            _memPath = Path.Combine(appDataDir, "memory.json");
        }

        private JObject LoadRootLocked() {
            if (!File.Exists(_memPath)) {
                return new JObject { ["enabled"] = true, ["facts"] = new JArray(), ["episodes"] = new JArray() };
            }
            try {
                var obj = CanonicalJson.ParseObject(DataAtRestCrypto.ReadTextFile(_memPath));
                if (!(obj["facts"] is JArray)) obj["facts"] = new JArray();
                return obj;
            } catch {
                return new JObject { ["enabled"] = true, ["facts"] = new JArray(), ["episodes"] = new JArray() };
            }
        }

        private void SaveRootLocked(JObject root) {
            DataAtRestCrypto.WriteTextFile(_memPath, root.ToString(Formatting.Indented));
        }

        public JObject ListAll() {
            lock (_lock) {
                var root = LoadRootLocked();
                var facts = root["facts"] as JArray ?? new JArray();
                return new JObject {
                    ["facts"] = facts,
                    ["count"] = facts.Count,
                    ["maxCount"] = MaxMemoryCount,
                    ["maxChars"] = MaxMemoryChars
                };
            }
        }

        public JArray Recall(string query) {
            string q = (query ?? "").Trim();
            lock (_lock) {
                var root = LoadRootLocked();
                var results = new JArray();
                if (root["facts"] is JArray facts) {
                    foreach (JObject f in facts) {
                        string c = f["content"]?.Value<string>() ?? "";
                        if (string.IsNullOrEmpty(q) || c.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0) {
                            results.Add(f);
                        }
                    }
                }
                return results;
            }
        }

        public JObject Save(string rawContent, string category, string provenance, string sessionId = "", bool pinned = false) {
            string clean = SecretsRedactor.Redact((rawContent ?? "").Trim());
            if (string.IsNullOrEmpty(clean)) {
                throw new ArgumentException("Memory content cannot be empty.");
            }
            if (clean.Length > MaxMemoryChars) {
                throw new ArgumentException($"Memory content exceeds maximum length of {MaxMemoryChars} characters.");
            }
            string prov = NormalizeProvenance(provenance);

            lock (_lock) {
                var root = LoadRootLocked();
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
                    ["sessionId"] = sessionId ?? "",
                    ["createdAt"] = now,
                    ["updatedAt"] = now
                };
                facts.Add(entry);
                root["facts"] = facts;
                SaveRootLocked(root);
                return entry;
            }
        }

        public (int status, JObject body) Update(string id, JObject patch) {
            lock (_lock) {
                var root = LoadRootLocked();
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
                        SaveRootLocked(root);
                        return (200, f);
                    }
                }
                return (404, new JObject { ["error"] = "Memory not found: " + id });
            }
        }

        public (int status, JObject body) Delete(string id) {
            lock (_lock) {
                var root = LoadRootLocked();
                var facts = root["facts"] as JArray ?? new JArray();
                for (int i = 0; i < facts.Count; i++) {
                    if (string.Equals(facts[i]?["id"]?.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) {
                        facts.RemoveAt(i);
                        SaveRootLocked(root);
                        return (200, new JObject { ["deleted"] = id });
                    }
                }
                return (404, new JObject { ["error"] = "Memory not found: " + id });
            }
        }

        public string ExportJson() {
            lock (_lock) {
                return LoadRootLocked().ToString(Formatting.Indented);
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
