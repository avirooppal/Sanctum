using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 4.2 & 4.3: Real project verification command discovery (package.json, pyproject.toml,
    /// Cargo.toml, *.csproj, Makefile, or .sanctum/verify.json), honest verified/not_verified/failed
    /// reporting, and editable Plan artifact verification.
    /// </summary>
    public static class ProjectVerifier {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        public const int MaxRepairAttempts = 3;

        public static JObject DiscoverCommands(string workspaceRoot) {
            var cmds = new JArray();
            if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot)) {
                return new JObject { ["commands"] = cmds, ["status"] = "not_verified", ["reason"] = "Workspace does not exist." };
            }

            // 1. User-configured .sanctum/verify.json (only if workspace is trusted, caller checks trust)
            string customCfg = Path.Combine(workspaceRoot, ".sanctum", "verify.json");
            if (File.Exists(customCfg)) {
                try {
                    var cfg = CanonicalJson.ParseObject(File.ReadAllText(customCfg, Utf8NoBom));
                    if (cfg["commands"] is JArray arr) {
                        foreach (var c in arr) {
                            string cmd = c.Type == JTokenType.String ? c.Value<string>() : c["command"]?.Value<string>();
                            string kind = c.Type == JTokenType.Object ? (c["kind"]?.Value<string>() ?? "custom") : "custom";
                            if (!string.IsNullOrWhiteSpace(cmd)) {
                                cmds.Add(new JObject { ["kind"] = kind, ["command"] = cmd.Trim(), ["source"] = ".sanctum/verify.json" });
                            }
                        }
                    }
                } catch { }
            }

            // 2. package.json scripts
            string pkgPath = Path.Combine(workspaceRoot, "package.json");
            if (File.Exists(pkgPath)) {
                try {
                    var pkg = CanonicalJson.ParseObject(File.ReadAllText(pkgPath, Utf8NoBom));
                    if (pkg["scripts"] is JObject scripts) {
                        foreach (string sName in new[] { "typecheck", "lint", "test", "build" }) {
                            if (scripts[sName] != null && !string.IsNullOrWhiteSpace(scripts[sName].Value<string>())) {
                                cmds.Add(new JObject {
                                    ["kind"] = sName,
                                    ["command"] = "npm run " + sName,
                                    ["source"] = "package.json"
                                });
                            }
                        }
                    }
                } catch { }
            }

            // 3. pyproject.toml / pytest.ini
            if (File.Exists(Path.Combine(workspaceRoot, "pyproject.toml")) || File.Exists(Path.Combine(workspaceRoot, "pytest.ini"))) {
                cmds.Add(new JObject { ["kind"] = "test", ["command"] = "pytest", ["source"] = "pyproject.toml" });
            }

            // 4. Cargo.toml
            if (File.Exists(Path.Combine(workspaceRoot, "Cargo.toml"))) {
                cmds.Add(new JObject { ["kind"] = "test", ["command"] = "cargo test", ["source"] = "Cargo.toml" });
            }

            // 5. .NET csproj/sln
            try {
                if (Directory.GetFiles(workspaceRoot, "*.csproj").Length > 0 || Directory.GetFiles(workspaceRoot, "*.sln").Length > 0) {
                    cmds.Add(new JObject { ["kind"] = "build", ["command"] = "dotnet build", ["source"] = "*.csproj" });
                }
            } catch { }

            // 6. Makefile
            string makePath = Path.Combine(workspaceRoot, "Makefile");
            if (File.Exists(makePath)) {
                try {
                    string mk = File.ReadAllText(makePath, Utf8NoBom);
                    if (Regex.IsMatch(mk, @"^test\s*:", RegexOptions.Multiline)) {
                        cmds.Add(new JObject { ["kind"] = "test", ["command"] = "make test", ["source"] = "Makefile" });
                    }
                } catch { }
            }

            return new JObject {
                ["commands"] = cmds,
                ["discoveredCount"] = cmds.Count,
                ["maxRepairAttempts"] = MaxRepairAttempts
            };
        }

        public static JObject VerifyPlanAgainstChanges(string planMarkdown, IEnumerable<string> changedFiles) {
            string text = planMarkdown ?? "";
            var checklist = new List<(bool done, string item)>();
            foreach (Match m in Regex.Matches(text, @"^\s*-\s*\[([ xX])\]\s*(.+)$", RegexOptions.Multiline)) {
                checklist.Add((m.Groups[1].Value.Trim().ToLowerInvariant() == "x", m.Groups[2].Value.Trim()));
            }
            var changed = new HashSet<string>(changedFiles ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            int completed = checklist.Count(c => c.done);
            var remaining = new JArray(checklist.Where(c => !c.done).Select(c => c.item));
            string status = checklist.Count == 0
                ? (changed.Count > 0 ? "verified_no_checklist" : "not_verified")
                : (remaining.Count == 0 ? "verified" : "partial");

            return new JObject {
                ["status"] = status,
                ["totalChecklistItems"] = checklist.Count,
                ["completedItems"] = completed,
                ["remainingItems"] = remaining,
                ["changedFileCount"] = changed.Count
            };
        }

        /// <summary>
        /// Phase 4.4: Permission ceiling helper — child subagent can NEVER exceed parent autonomy.
        /// </summary>
        public static string CapChildAutonomy(string parentAutonomy, string requestedChildAutonomy) {
            int Rank(string a) {
                switch ((a ?? "ask_all").Trim().ToLowerInvariant()) {
                    case "full_auto": return 2;
                    case "auto_reads": return 1;
                    default: return 0;
                }
            }
            int pRank = Rank(parentAutonomy);
            int cRank = Rank(requestedChildAutonomy);
            int effective = Math.Min(pRank, cRank);
            return effective == 2 ? "full_auto" : (effective == 1 ? "auto_reads" : "ask_all");
        }
    }
}
