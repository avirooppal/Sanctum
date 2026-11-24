using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class FeedAttentionReason {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("trigger")] public string Trigger { get; set; } = "";
        [JsonProperty("sessionId")] public string SessionId { get; set; } = "";
        [JsonProperty("workspaceId")] public string WorkspaceId { get; set; } = "";
        [JsonProperty("workspaceName")] public string WorkspaceName { get; set; } = "";
        [JsonProperty("summary")] public string Summary { get; set; } = "";
        [JsonProperty("createdAt")] public string CreatedAt { get; set; } = "";
    }

    /// <summary>
    /// Part B3: Host-side Feed Pane Attention & Pause Engine.
    /// Subscribes directly to the harness event bus (never depends on page JS).
    /// State machine: Off | Active | PausedAttention(reasons[]) | PausedByUser | Suspended.
    /// </summary>
    public sealed class FeedAttentionEngine {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private readonly string _appDataDir;
        private readonly string _settingsPath;
        private readonly string _wellbeingPath;
        private readonly FeedHostService _feed;
        private readonly HarnessAuditLog _audit;
        private readonly object _lock = new object();

        // State machine
        private string _state = "Off"; // Off | Active | PausedAttention | PausedByUser | Suspended
        private string _suspendReason = "";
        private readonly List<FeedAttentionReason> _reasons = new List<FeedAttentionReason>();
        private readonly Queue<DateTime> _recentPauseTimestamps = new Queue<DateTime>();
        private int _coalescedCount = 0;

        // Configurable trigger defaults
        private bool _trigApproval = true;
        private bool _trigPlanReady = true;
        private bool _trigUserInput = true;
        private bool _trigPresentFile = true;
        private bool _trigA2uiInput = true;
        private bool _trigRunFinished = false;
        private bool _trigRunError = false;
        private bool _approvalsOnlyMode = false;
        private bool _autoResume = true;
        private int _autoResumeGraceMs = 1500;
        private int _maxPausesPerMinute = 4;
        private bool _flashTaskbar = true;
        private bool _playChime = false;

        // Optional local-only wellbeing controls (all OFF by default, aggregate minutes only)
        private bool _showTimer = false;
        private int _reminderMinutes = 0;
        private int _dailyCapMinutes = 0;
        private string _wellbeingDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        private double _todayActiveMinutes = 0;

        public event Action<string, JObject> OnStateChanged;

        public FeedAttentionEngine(string appDataDir, FeedHostService feed, HarnessAuditLog audit) {
            _appDataDir = Path.GetFullPath(appDataDir);
            _settingsPath = Path.Combine(_appDataDir, "feed_attention_settings.json");
            _wellbeingPath = Path.Combine(_appDataDir, "feed_wellbeing.json");
            _feed = feed;
            _audit = audit;
            LoadLocked();
            RecomputeStateLocked(emitAudit: false);
        }

        private void LoadLocked() {
            if (File.Exists(_settingsPath)) {
                try {
                    var o = JObject.Parse(File.ReadAllText(_settingsPath, Utf8NoBom));
                    _trigApproval = o["trigApproval"]?.Value<bool>() ?? true;
                    _trigPlanReady = o["trigPlanReady"]?.Value<bool>() ?? true;
                    _trigUserInput = o["trigUserInput"]?.Value<bool>() ?? true;
                    _trigPresentFile = o["trigPresentFile"]?.Value<bool>() ?? true;
                    _trigA2uiInput = o["trigA2uiInput"]?.Value<bool>() ?? true;
                    _trigRunFinished = o["trigRunFinished"]?.Value<bool>() ?? false;
                    _trigRunError = o["trigRunError"]?.Value<bool>() ?? false;
                    _approvalsOnlyMode = o["approvalsOnlyMode"]?.Value<bool>() ?? false;
                    _autoResume = o["autoResume"]?.Value<bool>() ?? true;
                    _autoResumeGraceMs = Math.Max(0, Math.Min(10000, o["autoResumeGraceMs"]?.Value<int>() ?? 1500));
                    _maxPausesPerMinute = Math.Max(1, Math.Min(60, o["maxPausesPerMinute"]?.Value<int>() ?? 4));
                    _flashTaskbar = o["flashTaskbar"]?.Value<bool>() ?? true;
                    _playChime = o["playChime"]?.Value<bool>() ?? false;
                    _showTimer = o["showTimer"]?.Value<bool>() ?? false;
                    _reminderMinutes = Math.Max(0, o["reminderMinutes"]?.Value<int>() ?? 0);
                    _dailyCapMinutes = Math.Max(0, o["dailyCapMinutes"]?.Value<int>() ?? 0);
                } catch { }
            }
            if (File.Exists(_wellbeingPath)) {
                try {
                    var w = JObject.Parse(File.ReadAllText(_wellbeingPath, Utf8NoBom));
                    string today = DateTime.UtcNow.ToString("yyyy-MM-dd");
                    if (string.Equals(w["date"]?.Value<string>(), today, StringComparison.Ordinal)) {
                        _wellbeingDate = today;
                        _todayActiveMinutes = Math.Max(0, w["activeMinutes"]?.Value<double>() ?? 0);
                    }
                } catch { }
            }
        }

        private void SaveSettingsLocked() {
            Directory.CreateDirectory(_appDataDir);
            var o = new JObject {
                ["trigApproval"] = _trigApproval,
                ["trigPlanReady"] = _trigPlanReady,
                ["trigUserInput"] = _trigUserInput,
                ["trigPresentFile"] = _trigPresentFile,
                ["trigA2uiInput"] = _trigA2uiInput,
                ["trigRunFinished"] = _trigRunFinished,
                ["trigRunError"] = _trigRunError,
                ["approvalsOnlyMode"] = _approvalsOnlyMode,
                ["autoResume"] = _autoResume,
                ["autoResumeGraceMs"] = _autoResumeGraceMs,
                ["maxPausesPerMinute"] = _maxPausesPerMinute,
                ["flashTaskbar"] = _flashTaskbar,
                ["playChime"] = _playChime,
                ["showTimer"] = _showTimer,
                ["reminderMinutes"] = _reminderMinutes,
                ["dailyCapMinutes"] = _dailyCapMinutes
            };
            File.WriteAllText(_settingsPath, o.ToString(Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_settingsPath);
        }

        private void SaveWellbeingLocked() {
            Directory.CreateDirectory(_appDataDir);
            var w = new JObject {
                ["date"] = _wellbeingDate,
                ["activeMinutes"] = Math.Round(_todayActiveMinutes, 2)
            };
            File.WriteAllText(_wellbeingPath, w.ToString(Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(_wellbeingPath);
        }

        private bool IsTriggerEnabledLocked(string trigger) {
            string t = (trigger ?? "").Trim().ToLowerInvariant();
            if (_approvalsOnlyMode && t != "approval_requested") return false;
            switch (t) {
                case "approval_requested": return _trigApproval;
                case "plan_ready": return _trigPlanReady;
                case "user_input_requested": return _trigUserInput;
                case "present_file": return _trigPresentFile;
                case "a2ui_input_needed": return _trigA2uiInput;
                case "run_finished": return _trigRunFinished;
                case "run_error": return _trigRunError;
                default: return false;
            }
        }

        public void OnHarnessEvent(HarnessEvent evt, SessionSummary summary, string workspaceName) {
            if (evt == null) return;
            string wsId = summary?.WorkspaceId ?? "";
            string wsName = !string.IsNullOrWhiteSpace(workspaceName) ? workspaceName : "Default";
            switch (evt.Type) {
                case "approval_requested": {
                    string id = evt.Payload?["approvalId"]?.Value<string>() ?? ("appr_" + evt.Seq);
                    string tool = evt.Payload?["tool"]?.Value<string>() ?? "tool";
                    string evWsId = evt.Payload?["workspaceId"]?.Value<string>() ?? wsId;
                    string evWsName = evt.Payload?["workspaceName"]?.Value<string>() ?? wsName;
                    TriggerAttention(id, "approval_requested", evt.SessionId, evWsId, evWsName, $"Waiting for your approval ({tool})");
                    break;
                }
                case "approval_resolved": {
                    string id = evt.Payload?["approvalId"]?.Value<string>() ?? "";
                    if (!string.IsNullOrEmpty(id)) ClearAttention(id);
                    break;
                }
                case "plan_updated": {
                    TriggerAttention("plan_" + evt.SessionId + "_" + evt.Seq, "plan_ready", evt.SessionId, wsId, wsName, "Plan is ready for your review");
                    break;
                }
                case "user_input_requested": {
                    string id = evt.Payload?["requestId"]?.Value<string>() ?? ("input_" + evt.Seq);
                    string prompt = evt.Payload?["prompt"]?.Value<string>() ?? "Assistant asked a question";
                    TriggerAttention(id, "user_input_requested", evt.SessionId, wsId, wsName, prompt);
                    break;
                }
                case "a2ui_surface": {
                    if (evt.Payload?["valid"]?.Value<bool>() == true && evt.Payload?["needsInput"]?.Value<bool>() == true) {
                        string sid = evt.Payload?["surfaceId"]?.Value<string>() ?? ("a2ui_" + evt.Seq);
                        TriggerAttention(sid, "a2ui_input_needed", evt.SessionId, wsId, wsName, "Interactive reply needs your input");
                    }
                    break;
                }
                case "run_finished": {
                    string stop = evt.Payload?["stopReason"]?.Value<string>() ?? "completed";
                    if (stop == "error") {
                        TriggerAttention("err_" + evt.SessionId + "_" + evt.Seq, "run_error", evt.SessionId, wsId, wsName, "Run stopped with an error");
                    } else {
                        TriggerAttention("done_" + evt.SessionId + "_" + evt.Seq, "run_finished", evt.SessionId, wsId, wsName, "Run finished");
                    }
                    break;
                }
            }
        }

        public JObject TriggerAttention(string id, string trigger, string sessionId, string workspaceId, string workspaceName, string summary) {
            JObject snap = null;
            string newState = "";
            bool stateChanged = false;
            lock (_lock) {
                if (!_feed.IsEnabled) return GetSnapshotLocked();
                if (!IsTriggerEnabledLocked(trigger)) return GetSnapshotLocked();

                // Rate-limit non-approval triggers to prevent looping models from making the feed unusable
                DateTime now = DateTime.UtcNow;
                while (_recentPauseTimestamps.Count > 0 && (now - _recentPauseTimestamps.Peek()).TotalSeconds > 60) {
                    _recentPauseTimestamps.Dequeue();
                }
                if (trigger != "approval_requested" && _recentPauseTimestamps.Count >= _maxPausesPerMinute) {
                    _coalescedCount++;
                    var existingCoalesced = _reasons.FirstOrDefault(r => r.Id == "coalesced");
                    if (existingCoalesced == null) {
                        _reasons.Add(new FeedAttentionReason {
                            Id = "coalesced",
                            Trigger = "coalesced",
                            SessionId = sessionId ?? "",
                            WorkspaceId = workspaceId ?? "",
                            WorkspaceName = workspaceName ?? "Default",
                            Summary = $"Multiple updates paused ({_coalescedCount} coalesced)",
                            CreatedAt = now.ToString("o")
                        });
                    } else {
                        existingCoalesced.Summary = $"Multiple updates paused ({_coalescedCount} coalesced)";
                    }
                } else {
                    _recentPauseTimestamps.Enqueue(now);
                    if (!_reasons.Any(r => string.Equals(r.Id, id, StringComparison.OrdinalIgnoreCase))) {
                        _reasons.Add(new FeedAttentionReason {
                            Id = id,
                            Trigger = trigger,
                            SessionId = sessionId ?? "",
                            WorkspaceId = workspaceId ?? "",
                            WorkspaceName = workspaceName ?? "Default",
                            Summary = (summary ?? "").Length > 140 ? summary.Substring(0, 140) : (summary ?? ""),
                            CreatedAt = now.ToString("o")
                        });
                    }
                }

                string prev = _state;
                RecomputeStateLocked(emitAudit: true);
                stateChanged = prev != _state;
                newState = _state;
                snap = GetSnapshotLocked();
            }
            if (stateChanged) {
                try { OnStateChanged?.Invoke(newState, snap); } catch { }
            }
            return snap;
        }

        public JObject ClearAttention(string id) {
            JObject snap;
            bool stateChanged;
            string newState;
            lock (_lock) {
                if (string.IsNullOrWhiteSpace(id) || id == "*") {
                    _reasons.Clear();
                    _coalescedCount = 0;
                } else {
                    _reasons.RemoveAll(r => string.Equals(r.Id, id, StringComparison.OrdinalIgnoreCase));
                }
                string prev = _state;
                RecomputeStateLocked(emitAudit: true);
                stateChanged = prev != _state;
                newState = _state;
                snap = GetSnapshotLocked();
            }
            if (stateChanged) {
                try { OnStateChanged?.Invoke(newState, snap); } catch { }
            }
            return snap;
        }

        public JObject PauseByUser() {
            JObject snap;
            string newState;
            lock (_lock) {
                if (_feed.IsEnabled) {
                    _state = "PausedByUser";
                    _audit.Record("", "feed_pane", "feed_paused", "user", "allowed", "User paused feed", "user");
                }
                newState = _state;
                snap = GetSnapshotLocked();
            }
            try { OnStateChanged?.Invoke(newState, snap); } catch { }
            return snap;
        }

        public JObject ResumeByUser() {
            JObject snap;
            string newState;
            lock (_lock) {
                _reasons.Clear();
                _coalescedCount = 0;
                if (_state == "PausedByUser" || _state == "PausedAttention") {
                    _state = _feed.IsEffectiveEnabled ? "Active" : (_feed.IsEnabled ? "Suspended" : "Off");
                    _audit.Record("", "feed_pane", "feed_resumed", "user", "allowed", "User resumed feed", "user");
                }
                newState = _state;
                snap = GetSnapshotLocked();
            }
            try { OnStateChanged?.Invoke(newState, snap); } catch { }
            return snap;
        }

        public JObject SetSuspended(bool suspended, string reason = "window_hidden") {
            JObject snap;
            string newState;
            lock (_lock) {
                _suspendReason = suspended ? (reason ?? "window_hidden") : "";
                RecomputeStateLocked(emitAudit: true);
                newState = _state;
                snap = GetSnapshotLocked();
            }
            try { OnStateChanged?.Invoke(newState, snap); } catch { }
            return snap;
        }

        public JObject UpdateSettings(JObject patch) {
            lock (_lock) {
                if (patch["trigApproval"] != null) _trigApproval = patch["trigApproval"].Value<bool>();
                if (patch["trigPlanReady"] != null) _trigPlanReady = patch["trigPlanReady"].Value<bool>();
                if (patch["trigUserInput"] != null) _trigUserInput = patch["trigUserInput"].Value<bool>();
                if (patch["trigPresentFile"] != null) _trigPresentFile = patch["trigPresentFile"].Value<bool>();
                if (patch["trigA2uiInput"] != null) _trigA2uiInput = patch["trigA2uiInput"].Value<bool>();
                if (patch["trigRunFinished"] != null) _trigRunFinished = patch["trigRunFinished"].Value<bool>();
                if (patch["trigRunError"] != null) _trigRunError = patch["trigRunError"].Value<bool>();
                if (patch["approvalsOnlyMode"] != null) _approvalsOnlyMode = patch["approvalsOnlyMode"].Value<bool>();
                if (patch["autoResume"] != null) _autoResume = patch["autoResume"].Value<bool>();
                if (patch["autoResumeGraceMs"] != null) _autoResumeGraceMs = Math.Max(0, Math.Min(10000, patch["autoResumeGraceMs"].Value<int>()));
                if (patch["maxPausesPerMinute"] != null) _maxPausesPerMinute = Math.Max(1, Math.Min(60, patch["maxPausesPerMinute"].Value<int>()));
                if (patch["flashTaskbar"] != null) _flashTaskbar = patch["flashTaskbar"].Value<bool>();
                if (patch["playChime"] != null) _playChime = patch["playChime"].Value<bool>();
                if (patch["showTimer"] != null) _showTimer = patch["showTimer"].Value<bool>();
                if (patch["reminderMinutes"] != null) _reminderMinutes = Math.Max(0, patch["reminderMinutes"].Value<int>());
                if (patch["dailyCapMinutes"] != null) _dailyCapMinutes = Math.Max(0, patch["dailyCapMinutes"].Value<int>());
                SaveSettingsLocked();
                return GetSnapshotLocked();
            }
        }

        public JObject RecordWellbeingMinutes(double deltaMinutes) {
            lock (_lock) {
                string today = DateTime.UtcNow.ToString("yyyy-MM-dd");
                if (_wellbeingDate != today) {
                    _wellbeingDate = today;
                    _todayActiveMinutes = 0;
                }
                if (deltaMinutes > 0 && deltaMinutes <= 60) {
                    _todayActiveMinutes += deltaMinutes;
                    SaveWellbeingLocked();
                }
                return GetSnapshotLocked();
            }
        }

        public JObject ClearWellbeing() {
            lock (_lock) {
                _todayActiveMinutes = 0;
                if (File.Exists(_wellbeingPath)) {
                    try { File.Delete(_wellbeingPath); } catch { }
                }
                return new JObject { ["ok"] = true, ["cleared"] = true };
            }
        }

        public JObject GetSnapshot() {
            lock (_lock) {
                RecomputeStateLocked(emitAudit: false);
                return GetSnapshotLocked();
            }
        }

        private void RecomputeStateLocked(bool emitAudit) {
            string prev = _state;
            if (!_feed.IsEnabled) {
                _state = "Off";
            } else if (EgressHttpFactory.IsOfflineMode || !string.IsNullOrEmpty(_suspendReason)) {
                _state = "Suspended";
            } else if (_reasons.Count > 0) {
                _state = "PausedAttention";
            } else if (_state == "PausedByUser") {
                // Stay PausedByUser until user explicitly resumes
            } else if (_state == "PausedAttention" && !_autoResume) {
                // Stay PausedByUser if autoResume is off
                _state = "PausedByUser";
            } else {
                _state = "Active";
            }

            if (emitAudit && prev != _state) {
                if (_state == "PausedAttention" || _state == "Suspended") {
                    _audit.Record("", "feed_pane", "feed_paused", _state, "allowed", $"Feed transitioned {prev} -> {_state}", "host_attention_engine");
                } else if (_state == "Active" && (prev == "PausedAttention" || prev == "Suspended" || prev == "PausedByUser")) {
                    _audit.Record("", "feed_pane", "feed_resumed", _state, "allowed", $"Feed transitioned {prev} -> {_state}", "host_attention_engine");
                }
            }
        }

        private JObject GetSnapshotLocked() => new JObject {
            ["state"] = _state,
            ["suspendReason"] = EgressHttpFactory.IsOfflineMode ? "offline_mode" : _suspendReason,
            ["reasons"] = JArray.FromObject(_reasons),
            ["coalescedCount"] = _coalescedCount,
            ["settings"] = new JObject {
                ["trigApproval"] = _trigApproval,
                ["trigPlanReady"] = _trigPlanReady,
                ["trigUserInput"] = _trigUserInput,
                ["trigPresentFile"] = _trigPresentFile,
                ["trigA2uiInput"] = _trigA2uiInput,
                ["trigRunFinished"] = _trigRunFinished,
                ["trigRunError"] = _trigRunError,
                ["approvalsOnlyMode"] = _approvalsOnlyMode,
                ["autoResume"] = _autoResume,
                ["autoResumeGraceMs"] = _autoResumeGraceMs,
                ["maxPausesPerMinute"] = _maxPausesPerMinute,
                ["flashTaskbar"] = _flashTaskbar,
                ["playChime"] = _playChime
            },
            ["wellbeing"] = new JObject {
                ["showTimer"] = _showTimer,
                ["reminderMinutes"] = _reminderMinutes,
                ["dailyCapMinutes"] = _dailyCapMinutes,
                ["date"] = _wellbeingDate,
                ["todayActiveMinutes"] = Math.Round(_todayActiveMinutes, 2),
                ["capReached"] = _dailyCapMinutes > 0 && _todayActiveMinutes >= _dailyCapMinutes
            }
        };
    }
}
