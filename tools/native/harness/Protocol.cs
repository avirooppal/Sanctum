using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public static class ProtocolConstants {
        public const int Version = 1;
        public const string HarnessVersion = "1.0.0-harness.1a";
        public const int MaxClientBuffer = 256;
        public const int IdempotencyCacheSize = 512;
        public const int BlobThresholdBytes = 16 * 1024;
        public const int MaxBlobBytes = 4 * 1024 * 1024;
    }

    public sealed class HarnessEvent {
        [JsonProperty("v")] public int V { get; set; } = ProtocolConstants.Version;
        [JsonProperty("seq")] public long Seq { get; set; }
        [JsonProperty("ts")] public string Ts { get; set; } = "";
        [JsonProperty("sessionId")] public string SessionId { get; set; } = "";
        [JsonProperty("runId", NullValueHandling = NullValueHandling.Ignore)] public string RunId { get; set; }
        [JsonProperty("type")] public string Type { get; set; } = "";
        [JsonProperty("payload")] public JObject Payload { get; set; } = new JObject();
        [JsonProperty("sha256", NullValueHandling = NullValueHandling.Ignore)] public string Sha256 { get; set; }
    }

    public sealed class SessionSummary {
        [JsonProperty("sessionId")] public string SessionId { get; set; } = "";
        [JsonProperty("title")] public string Title { get; set; } = "New Session";
        [JsonProperty("workspace")] public string Workspace { get; set; } = "";
        [JsonProperty("mode")] public string Mode { get; set; } = "build";
        [JsonProperty("autonomy")] public string Autonomy { get; set; } = "auto_reads";
        [JsonProperty("model")] public string Model { get; set; } = "mock";
        [JsonProperty("parentSessionId", NullValueHandling = NullValueHandling.Ignore)] public string ParentSessionId { get; set; }
        [JsonProperty("forkAfterSeq", NullValueHandling = NullValueHandling.Ignore)] public long? ForkAfterSeq { get; set; }
        [JsonProperty("lastSeq")] public long LastSeq { get; set; }
        [JsonProperty("activeRunId", NullValueHandling = NullValueHandling.Ignore)] public string ActiveRunId { get; set; }
        [JsonProperty("createdAt")] public string CreatedAt { get; set; } = "";
        [JsonProperty("updatedAt")] public string UpdatedAt { get; set; } = "";
    }

    public sealed class RuntimeInfo {
        [JsonProperty("pid")] public int Pid { get; set; }
        [JsonProperty("pipeName")] public string PipeName { get; set; } = "";
        [JsonProperty("httpPort")] public int HttpPort { get; set; }
        [JsonProperty("token")] public string Token { get; set; } = "";
        [JsonProperty("startedAt")] public string StartedAt { get; set; } = "";
        [JsonProperty("protocolVersion")] public int ProtocolVersion { get; set; } = ProtocolConstants.Version;
    }

    public sealed class RunBudgets {
        [JsonProperty("maxSteps")] public int MaxSteps { get; set; } = 20;
        [JsonProperty("maxTokens")] public int MaxTokens { get; set; } = 32000;
        [JsonProperty("maxWallTimeMs")] public int MaxWallTimeMs { get; set; } = 300000;
        [JsonProperty("toolTimeoutMs")] public int ToolTimeoutMs { get; set; } = 30000;
    }

    public static class CanonicalJson {
        public static JObject ParseObject(string json) {
            using (var sr = new StringReader(json ?? ""))
            using (var jr = new JsonTextReader(sr) { DateParseHandling = DateParseHandling.None }) {
                return JObject.Load(jr);
            }
        }

        public static JToken SortKeys(JToken token) {
            if (token == null) return JValue.CreateNull();
            if (token is JObject obj) {
                var sorted = new JObject();
                foreach (var prop in obj.Properties().OrderBy(p => p.Name, StringComparer.Ordinal)) {
                    sorted.Add(prop.Name, SortKeys(prop.Value));
                }
                return sorted;
            }
            if (token is JArray arr) {
                var next = new JArray();
                foreach (var item in arr) next.Add(SortKeys(item));
                return next;
            }
            return token.DeepClone();
        }

        public static string Serialize(JToken token) {
            var sorted = SortKeys(token);
            return sorted.ToString(Formatting.None);
        }

        public static string SerializeObject(object obj) {
            var token = JToken.FromObject(obj);
            return Serialize(token);
        }

        public static string Sha256Hex(string input) {
            using (var sha = SHA256.Create()) {
                byte[] bytes = Encoding.UTF8.GetBytes(input ?? "");
                byte[] hash = sha.ComputeHash(bytes);
                var sb = new StringBuilder(64);
                for (int i = 0; i < hash.Length; i++) sb.Append(hash[i].ToString("x2"));
                return sb.ToString();
            }
        }

        public static string Sha256HexBytes(byte[] data) {
            using (var sha = SHA256.Create()) {
                byte[] hash = sha.ComputeHash(data ?? new byte[0]);
                var sb = new StringBuilder(64);
                for (int i = 0; i < hash.Length; i++) sb.Append(hash[i].ToString("x2"));
                return sb.ToString();
            }
        }
    }

    public static class SecretsRedactor {
        private static readonly Regex[] Patterns = new[] {
            new Regex(@"\bsk-[A-Za-z0-9_-]{20,}\b", RegexOptions.Compiled),
            new Regex(@"\bgh[pousr]_[A-Za-z0-9]{20,}\b", RegexOptions.Compiled),
            new Regex(@"\bAIza[0-9A-Za-z_-]{35}\b", RegexOptions.Compiled),
            new Regex(@"\bAKIA[0-9A-Z]{16}\b", RegexOptions.Compiled),
            new Regex(@"\bxox[baprs]-[A-Za-z0-9-]{10,}\b", RegexOptions.Compiled),
            new Regex(@"(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}", RegexOptions.Compiled | RegexOptions.IgnoreCase)
        };

        public static string Redact(string input) {
            if (string.IsNullOrEmpty(input)) return input ?? "";
            string s = input;
            for (int i = 0; i < Patterns.Length; i++) {
                var rx = Patterns[i];
                s = rx.Replace(s, m => m.Groups.Count > 1 && m.Groups[1].Success
                    ? m.Groups[1].Value + "[REDACTED_SECRET]"
                    : "[REDACTED_SECRET]");
            }
            return s;
        }

        public static JToken RedactToken(JToken token) {
            if (token == null) return JValue.CreateNull();
            if (token.Type == JTokenType.String) {
                return new JValue(Redact(token.Value<string>()));
            }
            if (token is JObject obj) {
                var next = new JObject();
                foreach (var prop in obj.Properties()) {
                    next[prop.Name] = RedactToken(prop.Value);
                }
                return next;
            }
            if (token is JArray arr) {
                var next = new JArray();
                foreach (var item in arr) next.Add(RedactToken(item));
                return next;
            }
            return token.DeepClone();
        }
    }

    public static class WindowsAclHelper {
        public static void ApplyUserOnlyDirectoryAcl(string dirPath) {
            try {
                Directory.CreateDirectory(dirPath);
                var identity = WindowsIdentity.GetCurrent();
                if (identity?.User == null) return;
                var sec = new DirectorySecurity();
                sec.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
                sec.AddAccessRule(new FileSystemAccessRule(
                    identity.User,
                    FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None,
                    AccessControlType.Allow));
                Directory.SetAccessControl(dirPath, sec);
            } catch {
                // Best-effort on non-NTFS / restricted test volumes
            }
        }

        public static void ApplyUserOnlyFileAcl(string filePath) {
            try {
                var identity = WindowsIdentity.GetCurrent();
                if (identity?.User == null) return;
                var sec = new FileSecurity();
                sec.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
                sec.AddAccessRule(new FileSystemAccessRule(
                    identity.User,
                    FileSystemRights.FullControl,
                    AccessControlType.Allow));
                File.SetAccessControl(filePath, sec);
            } catch {
                // Best-effort on non-NTFS volumes
            }
        }
    }
}
