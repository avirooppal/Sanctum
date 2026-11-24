using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 2.2: Content-hashed workspace trust store.
    /// Everything shipped inside a workspace (.sanctum/hooks.json, mcp.json, agents, skills,
    /// commands, AGENTS.md, .sanctum/rules/*.md, packs) is untrusted by default until explicitly
    /// approved over the trusted channel for the exact content hash. Any file modification
    /// invalidates trust and triggers a re-prompt.
    /// </summary>
    public sealed class WorkspaceTrustManager {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _trustFilePath;
        private readonly object _lock = new object();
        private Dictionary<string, JObject> _trusted = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);

        public WorkspaceTrustManager(string appDataDir) {
            _trustFilePath = Path.Combine(appDataDir, "workspace_trust.json");
            Load();
        }

        private void Load() {
            lock (_lock) {
                _trusted.Clear();
                if (!File.Exists(_trustFilePath)) return;
                try {
                    var parsed = JsonConvert.DeserializeObject<Dictionary<string, JObject>>(File.ReadAllText(_trustFilePath, Utf8NoBom));
                    if (parsed != null) _trusted = new Dictionary<string, JObject>(parsed, StringComparer.OrdinalIgnoreCase);
                } catch { }
            }
        }

        private void SaveLocked() {
            Directory.CreateDirectory(Path.GetDirectoryName(_trustFilePath));
            File.WriteAllText(_trustFilePath, JsonConvert.SerializeObject(_trusted, Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_trustFilePath);
        }

        private static string NormalizeWorkspace(string workspaceRoot) {
            if (string.IsNullOrWhiteSpace(workspaceRoot)) return "";
            return Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
        }

        private static List<(string relPath, string kind, string sha256)> ScanTrustItems(string workspaceRoot) {
            var items = new List<(string relPath, string kind, string sha256)>();
            if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot)) return items;

            void TryAddFile(string relPath, string kind) {
                try {
                    string full = PermissionEngine.ResolveToolPath(workspaceRoot, relPath, allowRoot: false);
                    if (!File.Exists(full)) return;
                    string hash = CanonicalJson.Sha256HexBytes(File.ReadAllBytes(full));
                    items.Add((relPath.Replace('\\', '/'), kind, hash));
                } catch { }
            }

            void TryAddGlob(string relDir, string pattern, string kind, SearchOption opt = SearchOption.TopDirectoryOnly) {
                try {
                    string fullDir = PermissionEngine.ResolveToolPath(workspaceRoot, relDir, allowRoot: false);
                    if (!Directory.Exists(fullDir)) return;
                    string root = NormalizeWorkspace(workspaceRoot);
                    foreach (string f in Directory.GetFiles(fullDir, pattern, opt).OrderBy(x => x, StringComparer.OrdinalIgnoreCase)) {
                        string rel = f.Substring(root.Length).TrimStart(Path.DirectorySeparatorChar).Replace('\\', '/');
                        string hash = CanonicalJson.Sha256HexBytes(File.ReadAllBytes(f));
                        items.Add((rel, kind, hash));
                    }
                } catch { }
            }

            TryAddFile("AGENTS.md", "instructions");
            TryAddFile(".sanctum/AGENTS.md", "instructions");
            TryAddFile(".sanctum/hooks.json", "hooks");
            TryAddFile(".sanctum/mcp.json", "mcp");
            TryAddFile("mcp.json", "mcp");
            TryAddGlob(".sanctum/rules", "*.md", "rules");
            TryAddGlob(".sanctum/agents", "*.md", "agents");
            TryAddGlob(".sanctum/skills", "SKILL.md", "skills", SearchOption.AllDirectories);
            TryAddGlob(".sanctum/commands", "*.md", "commands");
            TryAddGlob("packs", "manifest.json", "packs", SearchOption.AllDirectories);

            items.Sort((a, b) => string.Compare(a.relPath, b.relPath, StringComparison.OrdinalIgnoreCase));
            return items;
        }

        private static string ComputeAggregateHash(List<(string relPath, string kind, string sha256)> items) {
            if (items.Count == 0) return "";
            var sb = new StringBuilder();
            foreach (var it in items) {
                sb.Append(it.relPath).Append(':').Append(it.kind).Append(':').Append(it.sha256).Append('\n');
            }
            return CanonicalJson.Sha256Hex(sb.ToString());
        }

        public JObject GetTrustStatus(string workspaceRoot) {
            string norm = NormalizeWorkspace(workspaceRoot);
            if (string.IsNullOrEmpty(norm) || !Directory.Exists(norm)) {
                return new JObject {
                    ["workspace"] = norm,
                    ["hasTrustItems"] = false,
                    ["trusted"] = true,
                    ["requiresPrompt"] = false,
                    ["reason"] = "no_workspace",
                    ["contentHash"] = "",
                    ["items"] = new JArray()
                };
            }

            var items = ScanTrustItems(norm);
            string hash = ComputeAggregateHash(items);
            var itemsArr = new JArray();
            foreach (var it in items) {
                itemsArr.Add(new JObject {
                    ["path"] = it.relPath,
                    ["kind"] = it.kind,
                    ["sha256"] = it.sha256
                });
            }

            if (items.Count == 0) {
                return new JObject {
                    ["workspace"] = norm,
                    ["hasTrustItems"] = false,
                    ["trusted"] = true,
                    ["requiresPrompt"] = false,
                    ["reason"] = "no_trust_items",
                    ["contentHash"] = "",
                    ["items"] = itemsArr
                };
            }

            lock (_lock) {
                if (_trusted.TryGetValue(norm, out var rec)) {
                    string savedHash = rec["contentHash"]?.Value<string>() ?? "";
                    if (string.Equals(savedHash, hash, StringComparison.OrdinalIgnoreCase)) {
                        return new JObject {
                            ["workspace"] = norm,
                            ["hasTrustItems"] = true,
                            ["trusted"] = true,
                            ["requiresPrompt"] = false,
                            ["reason"] = "trusted",
                            ["contentHash"] = hash,
                            ["trustedAt"] = rec["trustedAt"]?.Value<string>() ?? "",
                            ["items"] = itemsArr
                        };
                    }
                    return new JObject {
                        ["workspace"] = norm,
                        ["hasTrustItems"] = true,
                        ["trusted"] = false,
                        ["requiresPrompt"] = true,
                        ["reason"] = "hash_changed",
                        ["contentHash"] = hash,
                        ["previousHash"] = savedHash,
                        ["items"] = itemsArr
                    };
                }
            }

            return new JObject {
                ["workspace"] = norm,
                ["hasTrustItems"] = true,
                ["trusted"] = false,
                ["requiresPrompt"] = true,
                ["reason"] = "untrusted",
                ["contentHash"] = hash,
                ["items"] = itemsArr
            };
        }

        public bool IsWorkspaceTrusted(string workspaceRoot) {
            var st = GetTrustStatus(workspaceRoot);
            return st["trusted"]?.Value<bool>() ?? false;
        }

        public (int status, JObject body) TrustWorkspace(string workspaceRoot, string expectedHash, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Trusting a workspace requires explicit trusted-channel approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            string norm = NormalizeWorkspace(workspaceRoot);
            if (string.IsNullOrEmpty(norm) || !Directory.Exists(norm)) {
                return (400, new JObject { ["error"] = "Workspace directory does not exist." });
            }

            var current = GetTrustStatus(norm);
            string currentHash = current["contentHash"]?.Value<string>() ?? "";
            if (!string.IsNullOrEmpty(currentHash) &&
                !string.Equals(expectedHash ?? "", currentHash, StringComparison.OrdinalIgnoreCase)) {
                return (409, new JObject {
                    ["error"] = "Workspace trust items changed since prompt was displayed (hash mismatch). Re-inspect and approve again.",
                    ["code"] = "hash_mismatch",
                    ["expectedHash"] = currentHash
                });
            }

            lock (_lock) {
                _trusted[norm] = new JObject {
                    ["contentHash"] = currentHash,
                    ["trustedAt"] = DateTime.UtcNow.ToString("o"),
                    ["items"] = current["items"]
                };
                SaveLocked();
            }

            return (200, GetTrustStatus(norm));
        }

        public JObject RevokeTrust(string workspaceRoot) {
            string norm = NormalizeWorkspace(workspaceRoot);
            lock (_lock) {
                _trusted.Remove(norm);
                SaveLocked();
            }
            return GetTrustStatus(norm);
        }
    }
}
