using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
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

    /// <summary>
    /// Phase 1.2: One-time & idempotent cloud-removal migration.
    /// - Overwrites (zeros) and deletes cloud_providers.json if present.
    /// - Records a one-time user-facing notice in migration_notices.json.
    /// - Rewrites cloud model IDs in threads.json and sessions/*.jsonl to default local model without losing history.
    /// - Scrubs sk-* / AIza* API key patterns from migrated threads, sessions, logs, and exports.
    /// </summary>
    public static class CloudRemovalMigration {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
        private static readonly Regex CloudKeyRegex = new Regex(
            @"\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-or-v1-[A-Za-z0-9_-]{8,}|sk-proj-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})\b",
            RegexOptions.Compiled);

        public static bool IsCloudModelId(string modelId) {
            if (string.IsNullOrWhiteSpace(modelId)) return false;
            string m = modelId.Trim().ToLowerInvariant();
            return m.StartsWith("anthropic:") ||
                   m.StartsWith("openai:") ||
                   m.StartsWith("gemini:") ||
                   m.StartsWith("openrouter:");
        }

        public static string ScrubSecrets(string text) {
            if (string.IsNullOrEmpty(text)) return text;
            return CloudKeyRegex.Replace(text, "[REDACTED_CLOUD_KEY]");
        }

        private static JToken ScrubToken(JToken tok) {
            if (tok == null) return null;
            if (tok.Type == JTokenType.String) {
                string s = tok.Value<string>() ?? "";
                string cleaned = ScrubSecrets(s);
                return cleaned == s ? tok : new JValue(cleaned);
            }
            if (tok is JObject obj) {
                foreach (var prop in new List<JProperty>(obj.Properties())) {
                    prop.Value = ScrubToken(prop.Value);
                }
                return obj;
            }
            if (tok is JArray arr) {
                for (int i = 0; i < arr.Count; i++) {
                    arr[i] = ScrubToken(arr[i]);
                }
                return arr;
            }
            return tok;
        }

        public static JObject RunIfNeeded(string appDataDir, SessionLogStore store, string defaultLocalModel = "qwen3:1.7b") {
            if (string.IsNullOrWhiteSpace(appDataDir)) return new JObject { ["status"] = "skipped" };
            bool wipedCloudFile = false;
            int threadsUpdated = 0;
            int sessionsUpdated = 0;
            int logsScrubbed = 0;

            // 1. Overwrite with zeros and delete cloud_providers.json
            string cloudFile = Path.Combine(appDataDir, "cloud_providers.json");
            if (File.Exists(cloudFile)) {
                try {
                    long len = new FileInfo(cloudFile).Length;
                    if (len > 0) {
                        using (var fs = new FileStream(cloudFile, FileMode.Open, FileAccess.Write, FileShare.None)) {
                            byte[] zeros = new byte[Math.Min(len, 65536)];
                            long remaining = len;
                            while (remaining > 0) {
                                int chunk = (int)Math.Min(remaining, zeros.Length);
                                fs.Write(zeros, 0, chunk);
                                remaining -= chunk;
                            }
                            fs.Flush(true);
                        }
                    }
                    File.Delete(cloudFile);
                    wipedCloudFile = true;
                } catch {
                    try { File.Delete(cloudFile); wipedCloudFile = true; } catch { }
                }
            }

            // 2. Rewrite threads.json (strip cloud model IDs + scrub keys without losing history)
            string threadsPath = Path.Combine(appDataDir, "threads.json");
            if (File.Exists(threadsPath)) {
                try {
                    string raw = File.ReadAllText(threadsPath, Utf8NoBom);
                    string scrubbedRaw = ScrubSecrets(raw);
                    bool changed = !string.Equals(raw, scrubbedRaw, StringComparison.Ordinal);
                    var parsed = JToken.Parse(string.IsNullOrWhiteSpace(scrubbedRaw) ? "[]" : scrubbedRaw);
                    var arr = parsed as JArray ?? (parsed["threads"] as JArray);
                    if (arr != null) {
                        foreach (var item in arr) {
                            if (item is JObject t) {
                                string mid = t["modelId"]?.Value<string>();
                                if (IsCloudModelId(mid)) {
                                    t["modelId"] = defaultLocalModel;
                                    threadsUpdated++;
                                    changed = true;
                                }
                                string m2 = t["model"]?.Value<string>();
                                if (IsCloudModelId(m2)) {
                                    t["model"] = defaultLocalModel;
                                    threadsUpdated++;
                                    changed = true;
                                }
                            }
                        }
                    }
                    if (changed) {
                        File.WriteAllText(threadsPath, parsed.ToString(Formatting.Indented), Utf8NoBom);
                        WindowsAclHelper.ApplyUserOnlyFileAcl(threadsPath);
                    }
                } catch { }
            }

            // 3. Rewrite sessions/*.jsonl (strip cloud model IDs, scrub keys, rebuild hash chain)
            if (store != null && Directory.Exists(store.SessionsDir)) {
                foreach (string sessionFile in Directory.GetFiles(store.SessionsDir, "*.jsonl")) {
                    try {
                        string[] lines = File.ReadAllLines(sessionFile, Utf8NoBom);
                        bool fileChanged = false;
                        var rebuilt = new List<string>(lines.Length);
                        string prevHash = GenesisHash;

                        foreach (string rawLine in lines) {
                            if (string.IsNullOrWhiteSpace(rawLine)) continue;
                            string scrubbedLine = ScrubSecrets(rawLine);
                            if (!string.Equals(scrubbedLine, rawLine, StringComparison.Ordinal)) {
                                fileChanged = true;
                            }
                            JObject evtObj;
                            try {
                                evtObj = CanonicalJson.ParseObject(scrubbedLine);
                            } catch {
                                rebuilt.Add(scrubbedLine);
                                continue;
                            }

                            var payload = evtObj["payload"] as JObject;
                            if (payload != null) {
                                string model = payload["model"]?.Value<string>();
                                if (IsCloudModelId(model)) {
                                    payload["model"] = defaultLocalModel;
                                    fileChanged = true;
                                }
                                ScrubToken(payload);
                            }

                            evtObj.Remove("sha256");
                            string canonical = CanonicalJson.Serialize(evtObj);
                            string chainHash = CanonicalJson.Sha256Hex(prevHash + "\n" + canonical);
                            evtObj["sha256"] = chainHash;
                            prevHash = chainHash;
                            rebuilt.Add(CanonicalJson.Serialize(evtObj));
                        }

                        if (fileChanged) {
                            File.WriteAllText(sessionFile, string.Join("\n", rebuilt) + "\n", Utf8NoBom);
                            WindowsAclHelper.ApplyUserOnlyFileAcl(sessionFile);
                            sessionsUpdated++;
                        }
                    } catch { }
                }
            }

            // 4. Scrub sk-* / AIza* keys from logs, audit, backups, and exports
            var scrubDirs = new[] {
                appDataDir,
                Path.Combine(appDataDir, "logs"),
                Path.Combine(appDataDir, "exports"),
                Path.Combine(appDataDir, "backups"),
                store != null ? store.BlobsDir : ""
            };
            foreach (string dir in scrubDirs) {
                if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;
                foreach (string file in Directory.GetFiles(dir)) {
                    string ext = Path.GetExtension(file).ToLowerInvariant();
                    string name = Path.GetFileName(file).ToLowerInvariant();
                    if (ext != ".jsonl" && ext != ".json" && ext != ".log" && ext != ".txt") continue;
                    if (name == "runtime.json" || name == "migration_notices.json") continue;
                    try {
                        string content = File.ReadAllText(file, Utf8NoBom);
                        string cleaned = ScrubSecrets(content);
                        if (!string.Equals(content, cleaned, StringComparison.Ordinal)) {
                            File.WriteAllText(file, cleaned, Utf8NoBom);
                            logsScrubbed++;
                        }
                    } catch { }
                }
            }

            // 5. Record one-time user notice if cloud data was removed
            if (wipedCloudFile || threadsUpdated > 0 || sessionsUpdated > 0) {
                RecordOneTimeNotice(appDataDir, "cloud_providers_removed",
                    "Cloud model providers were removed. Sanctum is now strictly local-only; saved cloud keys were wiped and previous cloud threads now fall back to your default local model without losing history.");
            }

            return new JObject {
                ["wipedCloudFile"] = wipedCloudFile,
                ["threadsUpdated"] = threadsUpdated,
                ["sessionsUpdated"] = sessionsUpdated,
                ["logsScrubbed"] = logsScrubbed
            };
        }

        private static string GetNoticesPath(string appDataDir) => Path.Combine(appDataDir, "migration_notices.json");

        public static void RecordOneTimeNotice(string appDataDir, string id, string message) {
            try {
                string path = GetNoticesPath(appDataDir);
                JObject doc = File.Exists(path) ? CanonicalJson.ParseObject(File.ReadAllText(path, Utf8NoBom)) : new JObject();
                var dismissed = doc["dismissed"] as JArray ?? new JArray();
                foreach (var d in dismissed) {
                    if (string.Equals(d.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) return;
                }
                var active = doc["notices"] as JArray ?? new JArray();
                foreach (JObject n in active) {
                    if (string.Equals(n["id"]?.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) return;
                }
                active.Add(new JObject {
                    ["id"] = id,
                    ["message"] = message,
                    ["createdAt"] = DateTime.UtcNow.ToString("o")
                });
                doc["notices"] = active;
                doc["dismissed"] = dismissed;
                File.WriteAllText(path, doc.ToString(Formatting.Indented), Utf8NoBom);
                WindowsAclHelper.ApplyUserOnlyFileAcl(path);
            } catch { }
        }

        public static JArray GetActiveNotices(string appDataDir) {
            try {
                string path = GetNoticesPath(appDataDir);
                if (!File.Exists(path)) return new JArray();
                var doc = CanonicalJson.ParseObject(File.ReadAllText(path, Utf8NoBom));
                return doc["notices"] as JArray ?? new JArray();
            } catch {
                return new JArray();
            }
        }

        public static bool DismissNotice(string appDataDir, string id) {
            try {
                string path = GetNoticesPath(appDataDir);
                if (!File.Exists(path)) return false;
                var doc = CanonicalJson.ParseObject(File.ReadAllText(path, Utf8NoBom));
                var active = doc["notices"] as JArray ?? new JArray();
                var dismissed = doc["dismissed"] as JArray ?? new JArray();
                var remaining = new JArray();
                bool found = false;
                foreach (JObject n in active) {
                    if (string.Equals(n["id"]?.Value<string>(), id, StringComparison.OrdinalIgnoreCase)) {
                        found = true;
                        continue;
                    }
                    remaining.Add(n);
                }
                if (found) {
                    dismissed.Add(id);
                    doc["notices"] = remaining;
                    doc["dismissed"] = dismissed;
                    File.WriteAllText(path, doc.ToString(Formatting.Indented), Utf8NoBom);
                    WindowsAclHelper.ApplyUserOnlyFileAcl(path);
                }
                return found;
            } catch {
                return false;
            }
        }
    }
}
