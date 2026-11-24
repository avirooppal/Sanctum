using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Part A2: Host-layer workspace-isolated Document Vault storage.
    /// Each workspace stores its own vault under %APPDATA%\Sanctum\workspaces\<workspaceId>\vault\vault.json.
    /// </summary>
    public sealed class HostVaultService {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly WorkspaceManager _workspaces;
        private readonly object _lock = new object();

        public HostVaultService(WorkspaceManager workspaces) {
            _workspaces = workspaces;
        }

        private string GetVaultFile(string workspaceId) {
            string wsDir = _workspaces.GetWorkspaceDataDir(workspaceId);
            string vaultDir = Path.Combine(wsDir, "vault");
            Directory.CreateDirectory(vaultDir);
            return Path.Combine(vaultDir, "vault.json");
        }

        private JObject LoadRootLocked(string workspaceId) {
            string path = GetVaultFile(workspaceId);
            if (!File.Exists(path)) {
                return new JObject {
                    ["workspaceId"] = workspaceId,
                    ["collections"] = new JArray("General"),
                    ["documents"] = new JArray()
                };
            }
            try {
                var obj = JObject.Parse(DataAtRestCrypto.ReadTextFile(path));
                if (!(obj["documents"] is JArray)) obj["documents"] = new JArray();
                if (!(obj["collections"] is JArray)) obj["collections"] = new JArray("General");
                return obj;
            } catch {
                return new JObject {
                    ["workspaceId"] = workspaceId,
                    ["collections"] = new JArray("General"),
                    ["documents"] = new JArray()
                };
            }
        }

        private void SaveRootLocked(string workspaceId, JObject root) {
            string path = GetVaultFile(workspaceId);
            DataAtRestCrypto.WriteTextFile(path, root.ToString(Formatting.Indented));
        }

        public JObject List(string workspaceId) {
            lock (_lock) {
                return LoadRootLocked(workspaceId);
            }
        }

        public (int status, JObject body) AddDocument(string workspaceId, string title, string collection, string content) {
            if (_workspaces.GetById(workspaceId) == null) {
                return (404, new JObject { ["error"] = "Workspace not found." });
            }
            string cleanTitle = (title ?? "").Trim();
            string cleanContent = SecretsRedactor.Redact((content ?? "").Trim());
            if (string.IsNullOrEmpty(cleanTitle) || string.IsNullOrEmpty(cleanContent)) {
                return (400, new JObject { ["error"] = "title and content are required." });
            }
            string col = string.IsNullOrWhiteSpace(collection) ? "General" : collection.Trim();
            lock (_lock) {
                var root = LoadRootLocked(workspaceId);
                var docs = (JArray)root["documents"];
                var cols = (JArray)root["collections"];
                if (!cols.Any(c => string.Equals(c.Value<string>(), col, StringComparison.OrdinalIgnoreCase))) {
                    cols.Add(col);
                }
                var doc = new JObject {
                    ["id"] = "vdoc_" + Guid.NewGuid().ToString("N").Substring(0, 10),
                    ["workspaceId"] = workspaceId,
                    ["title"] = cleanTitle,
                    ["collection"] = col,
                    ["content"] = cleanContent,
                    ["createdAt"] = DateTime.UtcNow.ToString("o")
                };
                docs.Add(doc);
                SaveRootLocked(workspaceId, root);
                return (201, doc);
            }
        }

        public (int status, JObject body) DeleteDocument(string workspaceId, string docId) {
            if (_workspaces.GetById(workspaceId) == null) {
                return (404, new JObject { ["error"] = "Workspace not found." });
            }
            lock (_lock) {
                var root = LoadRootLocked(workspaceId);
                var docs = (JArray)root["documents"];
                for (int i = 0; i < docs.Count; i++) {
                    if (string.Equals(docs[i]["id"]?.Value<string>(), docId, StringComparison.OrdinalIgnoreCase)) {
                        docs.RemoveAt(i);
                        SaveRootLocked(workspaceId, root);
                        return (200, new JObject { ["ok"] = true, ["deletedId"] = docId });
                    }
                }
                return (404, new JObject { ["error"] = "Vault document not found." });
            }
        }

        public JArray Search(string workspaceId, string query, int limit = 10) {
            var hits = new JArray();
            if (string.IsNullOrWhiteSpace(workspaceId) || _workspaces.GetById(workspaceId) == null) return hits;
            string q = (query ?? "").Trim();
            lock (_lock) {
                var root = LoadRootLocked(workspaceId);
                if (root["documents"] is JArray docs) {
                    foreach (JObject doc in docs) {
                        if (hits.Count >= limit) break;
                        string content = doc["content"]?.Value<string>() ?? "";
                        string title = doc["title"]?.Value<string>() ?? "";
                        int idx = string.IsNullOrEmpty(q) ? 0 : content.IndexOf(q, StringComparison.OrdinalIgnoreCase);
                        bool titleMatch = !string.IsNullOrEmpty(q) && title.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0;
                        if (idx >= 0 || titleMatch) {
                            int start = idx >= 0 ? Math.Max(0, idx - 80) : 0;
                            int len = Math.Min(content.Length - start, 240);
                            hits.Add(new JObject {
                                ["id"] = doc["id"],
                                ["workspaceId"] = workspaceId,
                                ["collection"] = doc["collection"],
                                ["source"] = "vault:" + title,
                                ["excerpt"] = len > 0 ? content.Substring(start, len) : ""
                            });
                        }
                    }
                }
            }
            return hits;
        }
    }
}
