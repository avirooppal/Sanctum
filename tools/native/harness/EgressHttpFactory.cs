using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public enum EgressFeature {
        Loopback = 0,
        ModelDownload = 1,
        ManualUpdate = 2,
        BrowserAgent = 3,
        WebFetch = 4,
        RemoteMcp = 5,
        FeedPane = 6
    }

    public sealed class EgressBlockedException : UnauthorizedAccessException {
        public string Host { get; }
        public EgressFeature Feature { get; }

        public EgressBlockedException(string message, string host, EgressFeature feature) : base(message) {
            Host = host ?? "";
            Feature = feature;
        }
    }

    /// <summary>
    /// Single host-level outbound HTTP factory with deny-by-default allowlist,
    /// global Offline mode kill-switch, and append-only redacted egress ledger.
    /// All outbound HTTP requests in C# must flow through EgressHttpFactory.CreateRequest.
    /// </summary>
    public static class EgressHttpFactory {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private static readonly object PolicyLock = new object();
        private static readonly object LedgerLock = new object();
        private static readonly Regex SecretPattern = new Regex(
            @"(?:sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static string _appDataDir = "";
        private static bool _offlineMode = false;
        private static bool _allowModelDownloads = true;   // User-initiated downloads only
        private static bool _allowManualUpdate = true;     // User-initiated update check only
        private static bool _allowBrowserAgent = false;    // Off by default
        private static bool _allowWebFetch = false;        // Off by default
        private static bool _allowRemoteMcp = false;       // Off by default
        private static bool _allowFeedPane = false;        // Off by default

        private static readonly string[] ModelDownloadHosts = new[] {
            "ollama.com",
            "registry.ollama.ai",
            "huggingface.co",
            "hf.co",
            "github.com",
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com"
        };

        private static readonly string[] ManualUpdateHosts = new[] {
            "api.github.com",
            "raw.githubusercontent.com",
            "github.com",
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com"
        };

        public static void Initialize(string appDataDir) {
            lock (PolicyLock) {
                _appDataDir = appDataDir ?? "";
                LoadPolicyLocked();
                string envOffline = Environment.GetEnvironmentVariable("SANCTUM_OFFLINE_MODE");
                if (string.Equals(envOffline, "1", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(envOffline, "true", StringComparison.OrdinalIgnoreCase)) {
                    _offlineMode = true;
                }
            }
        }

        private static string PolicyPath => string.IsNullOrEmpty(_appDataDir) ? "" : Path.Combine(_appDataDir, "network_policy.json");
        private static string LedgerPath => string.IsNullOrEmpty(_appDataDir) ? "" : Path.Combine(_appDataDir, "egress_ledger.jsonl");

        private static void LoadPolicyLocked() {
            try {
                if (string.IsNullOrEmpty(PolicyPath) || !File.Exists(PolicyPath)) return;
                var obj = CanonicalJson.ParseObject(File.ReadAllText(PolicyPath, Utf8NoBom));
                if (obj["offlineMode"] != null) _offlineMode = obj["offlineMode"].Value<bool>();
                if (obj["allowModelDownloads"] != null) _allowModelDownloads = obj["allowModelDownloads"].Value<bool>();
                if (obj["allowManualUpdate"] != null) _allowManualUpdate = obj["allowManualUpdate"].Value<bool>();
                if (obj["allowBrowserAgent"] != null) _allowBrowserAgent = obj["allowBrowserAgent"].Value<bool>();
                if (obj["allowWebFetch"] != null) _allowWebFetch = obj["allowWebFetch"].Value<bool>();
                if (obj["allowRemoteMcp"] != null) _allowRemoteMcp = obj["allowRemoteMcp"].Value<bool>();
                if (obj["allowFeedPane"] != null) _allowFeedPane = obj["allowFeedPane"].Value<bool>();
            } catch { }
        }

        private static void SavePolicyLocked() {
            try {
                if (string.IsNullOrEmpty(PolicyPath)) return;
                Directory.CreateDirectory(Path.GetDirectoryName(PolicyPath));
                var doc = GetPolicySnapshotLocked();
                File.WriteAllText(PolicyPath, doc.ToString(Formatting.Indented), Utf8NoBom);
                WindowsAclHelper.ApplyUserOnlyFileAcl(PolicyPath);
            } catch { }
        }

        private static JObject GetPolicySnapshotLocked() {
            return new JObject {
                ["offlineMode"] = _offlineMode,
                ["allowModelDownloads"] = _allowModelDownloads,
                ["allowManualUpdate"] = _allowManualUpdate,
                ["allowBrowserAgent"] = _allowBrowserAgent,
                ["allowWebFetch"] = _allowWebFetch,
                ["allowRemoteMcp"] = _allowRemoteMcp,
                ["updatedAt"] = DateTime.UtcNow.ToString("o")
            };
        }

        public static JObject GetPolicy() {
            lock (PolicyLock) {
                return GetPolicySnapshotLocked();
            }
        }

        public static bool IsOfflineMode {
            get { lock (PolicyLock) return _offlineMode; }
        }

        public static (int status, JObject body) SetOfflineMode(bool offline, bool viaTrustedChannel) {
            lock (PolicyLock) {
                // Turning Offline mode OFF requires trusted channel / explicit host approval.
                // Turning Offline mode ON is always allowed immediately (fail-closed).
                if (!offline && _offlineMode && !viaTrustedChannel) {
                    return (403, new JObject {
                        ["error"] = "Disabling Offline mode requires explicit trusted-channel approval.",
                        ["code"] = "trusted_channel_required"
                    });
                }
                _offlineMode = offline;
                SavePolicyLocked();
                return (200, GetPolicySnapshotLocked());
            }
        }

        public static (int status, JObject body) SetFeatureEnabled(string featureName, bool enabled, bool viaTrustedChannel) {
            lock (PolicyLock) {
                // Enabling any network feature requires trusted channel; disabling is always allowed.
                if (enabled && !viaTrustedChannel) {
                    return (403, new JObject {
                        ["error"] = $"Enabling network feature '{featureName}' requires explicit trusted-channel approval.",
                        ["code"] = "trusted_channel_required"
                    });
                }
                string f = (featureName ?? "").Trim().ToLowerInvariant();
                if (f == "modeldownloads" || f == "model_downloads") _allowModelDownloads = enabled;
                else if (f == "manualupdate" || f == "manual_update") _allowManualUpdate = enabled;
                else if (f == "browseragent" || f == "browser_agent") _allowBrowserAgent = enabled;
                else if (f == "webfetch" || f == "web_fetch" || f == "webtools" || f == "web_tools") _allowWebFetch = enabled;
                else if (f == "remotemcp" || f == "remote_mcp") _allowRemoteMcp = enabled;
                else if (f == "feedpane" || f == "feed_pane") _allowFeedPane = enabled;
                else return (400, new JObject { ["error"] = "Unknown network feature: " + featureName });

                SavePolicyLocked();
                return (200, GetPolicySnapshotLocked());
            }
        }

        public static bool IsLoopbackUri(Uri uri) {
            if (uri == null) return false;
            if (!string.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase)) {
                return false;
            }
            string host = (uri.Host ?? "").Trim().ToLowerInvariant();
            return uri.IsLoopback && (host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]");
        }

        public static string RedactUrl(Uri uri) {
            if (uri == null) return "";
            var builder = new UriBuilder(uri) {
                UserName = "",
                Password = "",
                Query = "",
                Fragment = ""
            };
            string cleaned = builder.Uri.GetLeftPart(UriPartial.Path);
            return SecretPattern.Replace(cleaned, "[REDACTED]");
        }

        private static bool HostMatchesAllowlist(string host, string[] allowedSuffixes) {
            string h = (host ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(h)) return false;
            foreach (string allowed in allowedSuffixes) {
                if (h == allowed || h.EndsWith("." + allowed, StringComparison.OrdinalIgnoreCase)) {
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// Part B2: Records a host-level summary for the Feed Pane with ZERO URLs, paths, or content.
        /// </summary>
        public static void RecordFeedHostSummary(string host, long approxBytes, string outcome = "allowed") {
            string cleanHost = (host ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(cleanHost)) return;
            RecordLedgerEntry(EgressFeature.FeedPane, cleanHost, "", outcome, "host-summary-only", 0, Math.Max(0, approxBytes), "");
        }

        public static void CheckAllowed(string url, EgressFeature feature, string sessionId = "", long bytesSent = 0) {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri)) {
                RecordLedgerEntry(feature, "invalid", "", "blocked", "Malformed URL", bytesSent, 0, sessionId);
                throw new EgressBlockedException("Blocked malformed outbound URL.", "", feature);
            }
            if (!string.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase)) {
                RecordLedgerEntry(feature, uri.Host, RedactUrl(uri), "blocked", "Disallowed URL scheme: " + uri.Scheme, bytesSent, 0, sessionId);
                throw new EgressBlockedException("Blocked non-HTTP(S) outbound scheme: " + uri.Scheme, uri.Host, feature);
            }

            if (IsLoopbackUri(uri)) {
                return;
            }

            string host = (uri.Host ?? "").ToLowerInvariant();
            string redacted = RedactUrl(uri);

            bool offline;
            bool featureAllowed;
            lock (PolicyLock) {
                offline = _offlineMode;
                featureAllowed = feature == EgressFeature.ModelDownload ? _allowModelDownloads
                    : feature == EgressFeature.ManualUpdate ? _allowManualUpdate
                    : feature == EgressFeature.BrowserAgent ? _allowBrowserAgent
                    : feature == EgressFeature.WebFetch ? _allowWebFetch
                    : feature == EgressFeature.RemoteMcp ? _allowRemoteMcp
                    : false;
            }

            if (offline) {
                RecordLedgerEntry(feature, host, redacted, "blocked", "Offline mode is enabled", bytesSent, 0, sessionId);
                throw new EgressBlockedException($"Outbound request to '{host}' blocked: Offline mode is active.", host, feature);
            }

            if (feature == EgressFeature.Loopback) {
                RecordLedgerEntry(feature, host, redacted, "blocked", "Non-loopback destination rejected for loopback-only feature", bytesSent, 0, sessionId);
                throw new EgressBlockedException($"Non-loopback destination '{host}' blocked for local-only service.", host, feature);
            }

            if (!featureAllowed) {
                RecordLedgerEntry(feature, host, redacted, "blocked", $"Feature '{feature}' is disabled", bytesSent, 0, sessionId);
                throw new EgressBlockedException($"Outbound request to '{host}' blocked: feature '{feature}' is disabled.", host, feature);
            }

            if (feature == EgressFeature.ModelDownload && !HostMatchesAllowlist(host, ModelDownloadHosts)) {
                RecordLedgerEntry(feature, host, redacted, "blocked", "Host not in ModelDownload allowlist", bytesSent, 0, sessionId);
                throw new EgressBlockedException($"Host '{host}' is not allowed for model downloads.", host, feature);
            }

            if (feature == EgressFeature.ManualUpdate && !HostMatchesAllowlist(host, ManualUpdateHosts)) {
                RecordLedgerEntry(feature, host, redacted, "blocked", "Host not in ManualUpdate allowlist", bytesSent, 0, sessionId);
                throw new EgressBlockedException($"Host '{host}' is not allowed for update checks.", host, feature);
            }

            RecordLedgerEntry(feature, host, redacted, "allowed", "Allowed by host egress policy", bytesSent, 0, sessionId);
        }

        public static HttpWebRequest CreateRequest(string url, EgressFeature feature, string sessionId = "", long bytesSent = 0) {
            CheckAllowed(url, feature, sessionId, bytesSent);
            var uri = new Uri(url);
            var req = (HttpWebRequest)WebRequest.Create(uri);
            if (IsLoopbackUri(uri)) {
                req.Proxy = null;
            }
            return req;
        }

        public static void RecordBytesReceived(string url, EgressFeature feature, long bytesSent, long bytesReceived, string sessionId = "") {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri)) return;
            if (IsLoopbackUri(uri)) return;
            RecordLedgerEntry(feature, uri.Host.ToLowerInvariant(), RedactUrl(uri), "completed", "Transfer completed", bytesSent, bytesReceived, sessionId);
        }

        private static void RecordLedgerEntry(
            EgressFeature feature,
            string host,
            string urlRedacted,
            string status,
            string reason,
            long bytesSent,
            long bytesReceived,
            string sessionId) {
            lock (LedgerLock) {
                try {
                    if (string.IsNullOrEmpty(LedgerPath)) return;
                    Directory.CreateDirectory(Path.GetDirectoryName(LedgerPath));
                    var entry = new JObject {
                        ["timestamp"] = DateTime.UtcNow.ToString("o"),
                        ["feature"] = feature.ToString(),
                        ["host"] = host ?? "",
                        ["url"] = urlRedacted ?? "",
                        ["status"] = status ?? "",
                        ["reason"] = reason ?? "",
                        ["bytesSent"] = Math.Max(0, bytesSent),
                        ["bytesReceived"] = Math.Max(0, bytesReceived),
                        ["sessionId"] = sessionId ?? ""
                    };
                    string line = CanonicalJson.Serialize(entry) + "\n";
                    File.AppendAllText(LedgerPath, line, Utf8NoBom);
                    WindowsAclHelper.ApplyUserOnlyFileAcl(LedgerPath);
                } catch { }
            }
        }

        public static JArray ReadLedger(int limit = 200) {
            var arr = new JArray();
            lock (LedgerLock) {
                try {
                    if (string.IsNullOrEmpty(LedgerPath) || !File.Exists(LedgerPath)) return arr;
                    string[] lines = File.ReadAllLines(LedgerPath, Utf8NoBom);
                    int start = Math.Max(0, lines.Length - Math.Max(1, limit));
                    for (int i = start; i < lines.Length; i++) {
                        if (string.IsNullOrWhiteSpace(lines[i])) continue;
                        try { arr.Add(CanonicalJson.ParseObject(lines[i])); } catch { }
                    }
                } catch { }
            }
            return arr;
        }

        public static string ExportLedgerJsonl() {
            lock (LedgerLock) {
                try {
                    if (string.IsNullOrEmpty(LedgerPath) || !File.Exists(LedgerPath)) return "";
                    return File.ReadAllText(LedgerPath, Utf8NoBom);
                } catch {
                    return "";
                }
            }
        }
    }
}
