using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// One-time, idempotent, reversible migration of legacy threads.json into the host
    /// append-only JSONL session store. Creates a timestamped backup before importing.
    /// </summary>
    public static class ThreadMigration {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);

        public static JObject MigrateLegacyThreadsIfNeeded(string appDataDir, SessionLogStore store) {
            string markerPath = Path.Combine(store.SessionsDir, ".migrated_threads_v1");
            if (File.Exists(markerPath)) {
                return new JObject { ["status"] = "already_migrated" };
            }

            string legacyPath = Path.Combine(appDataDir, "threads.json");
            if (!File.Exists(legacyPath)) {
                return new JObject { ["status"] = "no_legacy_threads" };
            }

            string raw;
            try {
                raw = File.ReadAllText(legacyPath, Utf8NoBom);
            } catch {
                return new JObject { ["status"] = "unreadable" };
            }

            JArray threads;
            try {
                var parsed = JToken.Parse(string.IsNullOrWhiteSpace(raw) ? "[]" : raw);
                threads = parsed as JArray ?? (parsed["threads"] as JArray) ?? new JArray();
            } catch {
                return new JObject { ["status"] = "invalid_json" };
            }

            // 1. Always create an untouched timestamped backup first (reversible migration)
            string backupDir = Path.Combine(appDataDir, "backups");
            WindowsAclHelper.ApplyUserOnlyDirectoryAcl(backupDir);
            string backupPath = Path.Combine(backupDir, "threads-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + ".json");
            File.Copy(legacyPath, backupPath, overwrite: true);
            WindowsAclHelper.ApplyUserOnlyFileAcl(backupPath);

            int importedCount = 0;
            foreach (var item in threads) {
                if (!(item is JObject t)) continue;
                string rawId = t["id"]?.Value<string>() ?? ("legacy_" + Guid.NewGuid().ToString("N").Substring(0, 10));
                string safeId = SanitizeLegacyId(rawId);
                if (store.SessionExists(safeId)) continue;

                string title = t["title"]?.Value<string>() ?? "Imported Chat";
                string model = t["modelId"]?.Value<string>() ?? "qwen3:1.7b";

                store.Append(safeId, "session_started", new JObject {
                    ["title"] = title,
                    ["workspace"] = "",
                    ["mode"] = "build",
                    ["autonomy"] = "auto_reads",
                    ["model"] = model,
                    ["migratedFrom"] = "threads.json"
                }, durableFlush: false);

                if (t["messages"] is JArray msgs) {
                    foreach (var mTok in msgs) {
                        if (!(mTok is JObject m)) continue;
                        string role = (m["role"]?.Value<string>() ?? "user").ToLowerInvariant();
                        string content = m["content"]?.Value<string>() ?? "";
                        if (string.IsNullOrEmpty(content)) continue;
                        if (role == "assistant") {
                            store.Append(safeId, "assistant_message", new JObject {
                                ["role"] = "assistant",
                                ["content"] = content,
                                ["reasoning"] = ""
                            }, durableFlush: false);
                        } else {
                            store.Append(safeId, "user_message", new JObject {
                                ["role"] = "user",
                                ["content"] = content
                            }, durableFlush: false);
                        }
                    }
                }
                importedCount++;
            }

            var meta = new JObject {
                ["version"] = 1,
                ["migratedAt"] = DateTime.UtcNow.ToString("o"),
                ["backupPath"] = backupPath,
                ["importedCount"] = importedCount
            };
            File.WriteAllText(markerPath, meta.ToString(Formatting.Indented), Utf8NoBom);
            return meta;
        }

        private static string SanitizeLegacyId(string raw) {
            var sb = new StringBuilder();
            foreach (char c in raw ?? "") {
                if (char.IsLetterOrDigit(c) || c == '_' || c == '-') sb.Append(c);
                else sb.Append('_');
            }
            string s = sb.ToString();
            if (string.IsNullOrEmpty(s)) s = "legacy_" + Guid.NewGuid().ToString("N").Substring(0, 8);
            if (!s.StartsWith("s_") && !s.StartsWith("chat") && !s.StartsWith("legacy_")) s = "s_" + s;
            return s;
        }
    }
}
