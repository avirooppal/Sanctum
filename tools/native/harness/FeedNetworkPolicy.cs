using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class FeedPreset {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("name")] public string Name { get; set; } = "";
        [JsonProperty("startUrl")] public string StartUrl { get; set; } = "";
        [JsonProperty("allowedHosts")] public List<string> AllowedHosts { get; set; } = new List<string>();
        [JsonProperty("builtin")] public bool Builtin { get; set; }
    }

    public sealed class FeedPolicyDecision {
        public bool Allowed { get; set; }
        public string Code { get; set; } = "allowed";
        public string Reason { get; set; } = "";
        public string Host { get; set; } = "";

        public JObject ToJson() => new JObject {
            ["allowed"] = Allowed,
            ["code"] = Code,
            ["reason"] = Reason,
            ["host"] = Host
        };
    }

    /// <summary>
    /// Part B2: Host-side Feed Pane network isolation policy, preset registry, consent gate,
    /// Offline mode enforcement, profile management, and host-only egress ledger summaries.
    /// </summary>
    public sealed class FeedHostService {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _appDataDir;
        private readonly string _configPath;
        private readonly string _presetsPath;
        private readonly string _profileDir;
        private readonly HarnessAuditLog _audit;
        private readonly object _lock = new object();

        // Short-TTL DNS verification cache to guard against DNS rebinding to private/loopback IPs
        private readonly ConcurrentDictionary<string, (DateTime expiresUtc, bool isPublicOnly)> _dnsCache =
            new ConcurrentDictionary<string, (DateTime, bool)>(StringComparer.OrdinalIgnoreCase);

        private bool _enabled = false;
        private bool _consentAccepted = false;
        private string _activePresetId = "instagram";
        private bool _inPrivateMode = false;
        private int _idleDestroyMinutes = 10;
        private bool _debugLogBlocked = false;
        private List<FeedPreset> _presets = new List<FeedPreset>();

        public FeedHostService(string appDataDir, HarnessAuditLog audit = null) {
            _appDataDir = Path.GetFullPath(appDataDir);
            _configPath = Path.Combine(_appDataDir, "feed_config.json");
            _presetsPath = Path.Combine(_appDataDir, "feed_presets.json");
            _profileDir = Path.Combine(_appDataDir, "feed-profile");
            _audit = audit ?? new HarnessAuditLog(_appDataDir);
            LoadStateLocked();
        }

        public string FeedProfileDir => _profileDir;
        public bool IsEnabled { get { lock (_lock) return _enabled; } }
        public bool IsEffectiveEnabled { get { lock (_lock) return _enabled && !EgressHttpFactory.IsOfflineMode; } }
        public bool InPrivateMode { get { lock (_lock) return _inPrivateMode; } }
        public int IdleDestroyMinutes { get { lock (_lock) return _idleDestroyMinutes; } }
        public string ActivePresetId { get { lock (_lock) return _activePresetId; } }

        private static List<FeedPreset> DefaultPresets() => new List<FeedPreset> {
            new FeedPreset {
                Id = "instagram",
                Name = "Instagram",
                StartUrl = "https://www.instagram.com/",
                AllowedHosts = new List<string> {
                    "instagram.com", "cdninstagram.com", "fbcdn.net", "fbsbx.com"
                },
                Builtin = true
            },
            new FeedPreset {
                Id = "hackernews",
                Name = "Hacker News",
                StartUrl = "https://news.ycombinator.com/",
                AllowedHosts = new List<string> {
                    "news.ycombinator.com", "ycombinator.com"
                },
                Builtin = true
            },
            new FeedPreset {
                Id = "wikipedia",
                Name = "Wikipedia",
                StartUrl = "https://en.wikipedia.org/",
                AllowedHosts = new List<string> {
                    "wikipedia.org", "wikimedia.org"
                },
                Builtin = true
            }
        };

        private void LoadStateLocked() {
            _presets = DefaultPresets();
            if (File.Exists(_presetsPath)) {
                try {
                    var loaded = JsonConvert.DeserializeObject<List<FeedPreset>>(File.ReadAllText(_presetsPath, Utf8NoBom));
                    if (loaded != null && loaded.Count > 0) _presets = loaded;
                } catch { }
            }
            if (File.Exists(_configPath)) {
                try {
                    var obj = JObject.Parse(File.ReadAllText(_configPath, Utf8NoBom));
                    _enabled = obj["enabled"]?.Value<bool>() ?? false;
                    _consentAccepted = obj["consentAccepted"]?.Value<bool>() ?? false;
                    _activePresetId = obj["activePresetId"]?.Value<string>() ?? "instagram";
                    _inPrivateMode = obj["inPrivateMode"]?.Value<bool>() ?? false;
                    _idleDestroyMinutes = Math.Max(1, Math.Min(120, obj["idleDestroyMinutes"]?.Value<int>() ?? 10));
                    _debugLogBlocked = obj["debugLogBlocked"]?.Value<bool>() ?? false;
                } catch { }
            }
        }

        private void SaveConfigLocked() {
            Directory.CreateDirectory(_appDataDir);
            var obj = new JObject {
                ["enabled"] = _enabled,
                ["consentAccepted"] = _consentAccepted,
                ["activePresetId"] = _activePresetId,
                ["inPrivateMode"] = _inPrivateMode,
                ["idleDestroyMinutes"] = _idleDestroyMinutes,
                ["debugLogBlocked"] = _debugLogBlocked,
                ["updatedAt"] = DateTime.UtcNow.ToString("o")
            };
            File.WriteAllText(_configPath, obj.ToString(Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_configPath);
        }

        private void SavePresetsLocked() {
            Directory.CreateDirectory(_appDataDir);
            File.WriteAllText(_presetsPath, JsonConvert.SerializeObject(_presets, Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_presetsPath);
        }

        public JObject GetStatus() {
            lock (_lock) {
                bool offline = EgressHttpFactory.IsOfflineMode;
                var active = _presets.FirstOrDefault(p => string.Equals(p.Id, _activePresetId, StringComparison.OrdinalIgnoreCase))
                          ?? _presets.FirstOrDefault();
                return new JObject {
                    ["enabled"] = _enabled,
                    ["effectiveEnabled"] = _enabled && !offline,
                    ["offlineBlocked"] = offline,
                    ["consentAccepted"] = _consentAccepted,
                    ["activePresetId"] = active?.Id ?? "instagram",
                    ["activePreset"] = active != null ? JObject.FromObject(active) : null,
                    ["inPrivateMode"] = _inPrivateMode,
                    ["idleDestroyMinutes"] = _idleDestroyMinutes,
                    ["debugLogBlocked"] = _debugLogBlocked,
                    ["profileExists"] = Directory.Exists(_profileDir),
                    ["presets"] = JArray.FromObject(_presets)
                };
            }
        }

        public (int status, JObject body) EnableFeed(bool consentAccepted, bool viaTrustedChannel, bool? inPrivateMode = null, string presetId = null) {
            if (!consentAccepted) {
                return (400, new JObject {
                    ["error"] = "Explicit user consent acknowledging third-party tracking (e.g. Meta/Instagram) is required before enabling Feed Pane.",
                    ["code"] = "consent_required"
                });
            }
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Enabling the Feed Pane network feature requires trusted-channel approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            lock (_lock) {
                _consentAccepted = true;
                _enabled = true;
                if (inPrivateMode.HasValue) _inPrivateMode = inPrivateMode.Value;
                if (!string.IsNullOrWhiteSpace(presetId) &&
                    _presets.Any(p => string.Equals(p.Id, presetId.Trim(), StringComparison.OrdinalIgnoreCase))) {
                    _activePresetId = presetId.Trim().ToLowerInvariant();
                }
                SaveConfigLocked();
            }
            EgressHttpFactory.SetFeatureEnabled("feed_pane", true, viaTrustedChannel: true);
            _audit.Record("", "feed_pane", "feed_enabled", _activePresetId, "allowed", "User enabled Feed Pane via trusted channel", "trusted_channel");
            return (200, GetStatus());
        }

        public (int status, JObject body) DisableFeed() {
            lock (_lock) {
                _enabled = false;
                SaveConfigLocked();
            }
            EgressHttpFactory.SetFeatureEnabled("feed_pane", false, viaTrustedChannel: true);
            _audit.Record("", "feed_pane", "feed_disabled", "", "allowed", "User disabled Feed Pane", "user");
            return (200, GetStatus());
        }

        public (int status, JObject body) SelectPreset(string presetId, bool? inPrivateMode = null, int? idleMinutes = null, bool? debugLogBlocked = null) {
            lock (_lock) {
                if (!string.IsNullOrWhiteSpace(presetId)) {
                    var found = _presets.FirstOrDefault(p => string.Equals(p.Id, presetId.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (found == null) return (404, new JObject { ["error"] = "Preset not found: " + presetId });
                    _activePresetId = found.Id;
                }
                if (inPrivateMode.HasValue) _inPrivateMode = inPrivateMode.Value;
                if (idleMinutes.HasValue) _idleDestroyMinutes = Math.Max(1, Math.Min(120, idleMinutes.Value));
                if (debugLogBlocked.HasValue) _debugLogBlocked = debugLogBlocked.Value;
                SaveConfigLocked();
            }
            return (200, GetStatus());
        }

        public (int status, JObject body) AddCustomPresetOrDomain(JObject body, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Adding custom domains or presets to Feed Pane requires trusted-channel approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            string name = (body["name"]?.Value<string>() ?? "").Trim();
            string startUrl = (body["startUrl"]?.Value<string>() ?? "").Trim();
            var hostsArr = body["allowedHosts"] as JArray;
            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(startUrl) || !Uri.TryCreate(startUrl, UriKind.Absolute, out var uri) ||
                !string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase)) {
                return (400, new JObject { ["error"] = "name and an https:// startUrl are required." });
            }
            if (IsPrivateOrLocalHost(uri.Host)) {
                return (400, new JObject { ["error"] = "Loopback, link-local, and private network hosts are forbidden in Feed Pane." });
            }

            var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { uri.Host.ToLowerInvariant() };
            if (hostsArr != null) {
                foreach (var h in hostsArr) {
                    string hs = (h?.Value<string>() ?? "").Trim().ToLowerInvariant();
                    if (string.IsNullOrEmpty(hs) || IsPrivateOrLocalHost(hs)) continue;
                    hosts.Add(hs);
                }
            }

            string id = "custom_" + Guid.NewGuid().ToString("N").Substring(0, 8);
            var preset = new FeedPreset {
                Id = id,
                Name = name.Length > 60 ? name.Substring(0, 60) : name,
                StartUrl = startUrl,
                AllowedHosts = hosts.ToList(),
                Builtin = false
            };
            lock (_lock) {
                _presets.Add(preset);
                SavePresetsLocked();
            }
            _audit.Record("", "feed_pane", "feed_preset_added", id, "allowed", "Custom feed preset added via trusted channel", "trusted_channel");
            return (201, JObject.FromObject(preset));
        }

        public (int status, JObject body) ClearFeedProfile() {
            bool existed = Directory.Exists(_profileDir);
            if (existed) {
                try { Directory.Delete(_profileDir, true); } catch (Exception ex) {
                    return (500, new JObject { ["error"] = "Could not delete feed profile: " + ex.Message });
                }
            }
            _audit.Record("", "feed_pane", "feed_profile_cleared", "", "allowed", "User cleared feed profile data", "user");
            return (200, new JObject { ["ok"] = true, ["cleared"] = true, ["existed"] = existed });
        }

        public FeedPolicyDecision EvaluateRequest(string rawUrl, string presetId = null, bool skipDnsLookup = false) {
            if (EgressHttpFactory.IsOfflineMode) {
                return new FeedPolicyDecision { Allowed = false, Code = "offline_mode_active", Reason = "Global Offline mode blocks Feed Pane traffic." };
            }
            if (string.IsNullOrWhiteSpace(rawUrl) || !Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri)) {
                return new FeedPolicyDecision { Allowed = false, Code = "malformed_url", Reason = "Malformed URL blocked." };
            }
            string scheme = (uri.Scheme ?? "").ToLowerInvariant();
            if (scheme != "https") {
                return new FeedPolicyDecision {
                    Allowed = false,
                    Code = "scheme_blocked",
                    Reason = $"Scheme '{scheme}:' is blocked in Feed Pane (only https: allowed).",
                    Host = uri.Host ?? ""
                };
            }
            string host = (uri.Host ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(host) || IsPrivateOrLocalHost(host)) {
                return new FeedPolicyDecision {
                    Allowed = false,
                    Code = "private_or_loopback_blocked",
                    Reason = "Loopback, link-local, metadata, and private LAN hosts are strictly blocked in Feed Pane.",
                    Host = host
                };
            }

            // Preset allowlist check
            FeedPreset preset;
            lock (_lock) {
                string targetPreset = string.IsNullOrWhiteSpace(presetId) ? _activePresetId : presetId.Trim();
                preset = _presets.FirstOrDefault(p => string.Equals(p.Id, targetPreset, StringComparison.OrdinalIgnoreCase))
                      ?? _presets.FirstOrDefault();
            }
            bool hostAllowed = preset != null && preset.AllowedHosts.Any(allowed =>
                host.Equals(allowed, StringComparison.OrdinalIgnoreCase) ||
                host.EndsWith("." + allowed, StringComparison.OrdinalIgnoreCase));
            if (!hostAllowed) {
                if (_debugLogBlocked) {
                    EgressHttpFactory.RecordFeedHostSummary(host, 0, "blocked");
                }
                return new FeedPolicyDecision {
                    Allowed = false,
                    Code = "host_not_allowlisted",
                    Reason = $"Host '{host}' is not in active preset '{preset?.Name}' allowlist.",
                    Host = host
                };
            }

            // DNS rebinding guard: verify resolved IPs are public (short 30s TTL)
            if (!skipDnsLookup && !VerifyDnsPublicOnly(host)) {
                return new FeedPolicyDecision {
                    Allowed = false,
                    Code = "dns_rebinding_blocked",
                    Reason = $"Host '{host}' resolved to a loopback, link-local, or private IP address.",
                    Host = host
                };
            }

            return new FeedPolicyDecision { Allowed = true, Code = "allowed", Host = host };
        }

        public void RecordHostTransfer(string host, long approxBytes) {
            if (!string.IsNullOrWhiteSpace(host)) {
                EgressHttpFactory.RecordFeedHostSummary(host, approxBytes, "allowed");
            }
        }

        private bool VerifyDnsPublicOnly(string host) {
            DateTime now = DateTime.UtcNow;
            if (_dnsCache.TryGetValue(host, out var cached) && cached.expiresUtc > now) {
                return cached.isPublicOnly;
            }
            try {
                var addrs = Dns.GetHostAddresses(host);
                if (addrs == null || addrs.Length == 0) return false;
                foreach (var ip in addrs) {
                    if (IsPrivateOrLoopbackIp(ip)) {
                        _dnsCache[host] = (now.AddSeconds(30), false);
                        return false;
                    }
                }
                _dnsCache[host] = (now.AddSeconds(30), true);
                return true;
            } catch {
                // Fail closed if DNS cannot be verified
                return false;
            }
        }

        public static bool IsPrivateOrLocalHost(string host) {
            string h = (host ?? "").Trim().Trim('[', ']').ToLowerInvariant();
            if (string.IsNullOrEmpty(h)) return true;
            if (h == "localhost" || h.EndsWith(".localhost") || h.EndsWith(".local") || h == "0.0.0.0" || h == "::1") {
                return true;
            }
            if (IPAddress.TryParse(h, out var ip)) {
                return IsPrivateOrLoopbackIp(ip);
            }
            return false;
        }

        public static bool IsPrivateOrLoopbackIp(IPAddress ip) {
            if (ip == null) return true;
            if (IPAddress.IsLoopback(ip)) return true;
            if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
            byte[] b = ip.GetAddressBytes();
            if (ip.AddressFamily == AddressFamily.InterNetwork && b.Length == 4) {
                if (b[0] == 0) return true;                                  // 0.0.0.0/8
                if (b[0] == 10) return true;                                 // 10.0.0.0/8
                if (b[0] == 127) return true;                                // 127.0.0.0/8
                if (b[0] == 169 && b[1] == 254) return true;                 // 169.254.0.0/16 (link-local + AWS/GCP/Azure metadata)
                if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;    // 172.16.0.0/12
                if (b[0] == 192 && b[1] == 168) return true;                 // 192.168.0.0/16
                if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;   // 100.64.0.0/10 (CGNAT)
                return false;
            }
            if (ip.AddressFamily == AddressFamily.InterNetworkV6 && b.Length == 16) {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast) return true;
                if ((b[0] & 0xFE) == 0xFC) return true; // fc00::/7 Unique Local
                return false;
            }
            return true;
        }
    }
}
