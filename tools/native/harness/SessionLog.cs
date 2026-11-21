using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Append-only JSONL session store with canonical-JSON hash chains (detects corruption/truncation,
    /// not local tampering), secret redaction, large-output blob offloading, user-only Windows ACLs,
    /// crash recovery, and O(1) reference-based forking.
    /// </summary>
    public sealed class SessionLogStore {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

        private readonly string _sessionsDir;
        private readonly string _blobsDir;
        private readonly object _storeLock = new object();
        private readonly Dictionary<string, object> _sessionLocks = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _lastHashBySession = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, long> _lastSeqBySession = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        public SessionLogStore(string appDataDir) {
            _sessionsDir = Path.Combine(appDataDir, "sessions");
            _blobsDir = Path.Combine(_sessionsDir, "blobs");
            WindowsAclHelper.ApplyUserOnlyDirectoryAcl(_sessionsDir);
            WindowsAclHelper.ApplyUserOnlyDirectoryAcl(_blobsDir);
        }

        public string SessionsDir => _sessionsDir;
        public string BlobsDir => _blobsDir;

        private object GetSessionLock(string sessionId) {
            lock (_storeLock) {
                if (!_sessionLocks.TryGetValue(sessionId, out var lk)) {
                    lk = new object();
                    _sessionLocks[sessionId] = lk;
                }
                return lk;
            }
        }

        public string GetLogPath(string sessionId) {
            string safe = SanitizeSessionId(sessionId);
            return Path.Combine(_sessionsDir, safe + ".jsonl");
        }

        public static string SanitizeSessionId(string sessionId) {
            if (string.IsNullOrWhiteSpace(sessionId)) throw new ArgumentException("Invalid sessionId");
            foreach (char c in sessionId) {
                if (!char.IsLetterOrDigit(c) && c != '_' && c != '-') {
                    throw new ArgumentException("Invalid characters in sessionId");
                }
            }
            return sessionId;
        }

        public bool SessionExists(string sessionId) {
            try { return File.Exists(GetLogPath(sessionId)); } catch { return false; }
        }

        public JObject StoreBlobIfLarge(string rawOutput) {
            string redacted = SecretsRedactor.Redact(rawOutput ?? "");
            byte[] bytes = Utf8NoBom.GetBytes(redacted);
            if (bytes.Length <= ProtocolConstants.BlobThresholdBytes) {
                return new JObject {
                    ["inline"] = redacted,
                    ["bytes"] = bytes.Length,
                    ["truncated"] = false
                };
            }

            bool truncated = false;
            if (bytes.Length > ProtocolConstants.MaxBlobBytes) {
                var capped = new byte[ProtocolConstants.MaxBlobBytes];
                Buffer.BlockCopy(bytes, 0, capped, 0, ProtocolConstants.MaxBlobBytes);
                bytes = capped;
                truncated = true;
            }

            string sha = CanonicalJson.Sha256HexBytes(bytes);
            string blobPath = Path.Combine(_blobsDir, sha + ".bin");
            if (!File.Exists(blobPath)) {
                string tmp = blobPath + ".tmp." + Guid.NewGuid().ToString("N");
                File.WriteAllBytes(tmp, bytes);
                try {
                    if (!File.Exists(blobPath)) File.Move(tmp, blobPath);
                    else File.Delete(tmp);
                } catch {
                    try { if (File.Exists(tmp)) File.Delete(tmp); } catch { }
                }
            }

            string preview = redacted.Length > 1024 ? redacted.Substring(0, 1024) + "\n...[stored in blob]..." : redacted;
            return new JObject {
                ["blobRef"] = sha,
                ["bytes"] = bytes.Length,
                ["truncated"] = truncated,
                ["preview"] = preview
            };
        }

        public string ReadBlob(string blobRef) {
            if (string.IsNullOrWhiteSpace(blobRef) || blobRef.Length != 64) return null;
            foreach (char c in blobRef) {
                if (!Uri.IsHexDigit(c)) return null;
            }
            string path = Path.Combine(_blobsDir, blobRef + ".bin");
            if (!File.Exists(path)) return null;
            return File.ReadAllText(path, Utf8NoBom);
        }

        public void SeedForkSequence(string childSessionId, long forkAfterSeq) {
            string safe = SanitizeSessionId(childSessionId);
            object lk = GetSessionLock(safe);
            lock (lk) {
                _lastSeqBySession[safe] = forkAfterSeq;
                _lastHashBySession[safe] = GenesisHash;
            }
        }

        public HarnessEvent Append(string sessionId, string type, JObject payload, string runId = null, bool durableFlush = true) {
            string safe = SanitizeSessionId(sessionId);
            object lk = GetSessionLock(safe);
            lock (lk) {
                EnsureSessionStateLoaded(safe);
                long nextSeq = _lastSeqBySession.TryGetValue(safe, out var s) ? s + 1 : 1;
                string prevHash = _lastHashBySession.TryGetValue(safe, out var h) ? h : GenesisHash;

                var redactedPayload = payload != null
                    ? (JObject)SecretsRedactor.RedactToken(payload)
                    : new JObject();

                var evt = new HarnessEvent {
                    V = ProtocolConstants.Version,
                    Seq = nextSeq,
                    Ts = DateTime.UtcNow.ToString("o"),
                    SessionId = safe,
                    RunId = runId,
                    Type = type,
                    Payload = redactedPayload
                };

                var bodyObj = JObject.FromObject(evt);
                bodyObj.Remove("sha256");
                string canonical = CanonicalJson.Serialize(bodyObj);
                string chainHash = CanonicalJson.Sha256Hex(prevHash + "\n" + canonical);
                evt.Sha256 = chainHash;
                bodyObj["sha256"] = chainHash;

                string line = CanonicalJson.Serialize(bodyObj) + "\n";
                byte[] bytes = Utf8NoBom.GetBytes(line);
                string logPath = GetLogPath(safe);
                using (var fs = new FileStream(logPath, FileMode.Append, FileAccess.Write, FileShare.Read)) {
                    fs.Write(bytes, 0, bytes.Length);
                    fs.Flush(durableFlush);
                }

                _lastSeqBySession[safe] = nextSeq;
                _lastHashBySession[safe] = chainHash;
                return evt;
            }
        }

        private void EnsureSessionStateLoaded(string safeId) {
            if (_lastSeqBySession.ContainsKey(safeId)) return;
            string logPath = GetLogPath(safeId);
            if (!File.Exists(logPath)) {
                _lastSeqBySession[safeId] = 0;
                _lastHashBySession[safeId] = GenesisHash;
                return;
            }
            var recovered = RecoverAndReadOwnFile(safeId, out var lastSeq, out var lastHash);
            _lastSeqBySession[safeId] = lastSeq;
            _lastHashBySession[safeId] = lastHash;
            _ = recovered;
        }

        /// <summary>
        /// Reads and validates a single session's own JSONL file, quarantining any corrupt or
        /// partial trailing line to a .corrupt.bak sidecar and truncating the log to the last valid record.
        /// </summary>
        public List<HarnessEvent> RecoverAndReadOwnFile(string sessionId, out long lastSeq, out string lastHash) {
            string safe = SanitizeSessionId(sessionId);
            string logPath = GetLogPath(safe);
            var events = new List<HarnessEvent>();
            lastSeq = 0;
            lastHash = GenesisHash;

            if (!File.Exists(logPath)) return events;

            string[] rawLines = File.ReadAllLines(logPath, Utf8NoBom);
            var validRawLines = new List<string>(rawLines.Length);
            bool foundCorruption = false;

            for (int i = 0; i < rawLines.Length; i++) {
                string line = rawLines[i];
                if (string.IsNullOrWhiteSpace(line)) continue;
                try {
                    var obj = JObject.Parse(line);
                    string storedHash = obj["sha256"]?.Value<string>();
                    if (string.IsNullOrEmpty(storedHash)) throw new InvalidDataException("Missing sha256");

                    var verifyObj = (JObject)obj.DeepClone();
                    verifyObj.Remove("sha256");
                    string expectedHash = CanonicalJson.Sha256Hex(lastHash + "\n" + CanonicalJson.Serialize(verifyObj));
                    if (!string.Equals(storedHash, expectedHash, StringComparison.OrdinalIgnoreCase)) {
                        throw new InvalidDataException("Hash chain mismatch");
                    }

                    var evt = obj.ToObject<HarnessEvent>();
                    if (evt == null || evt.Seq <= lastSeq) throw new InvalidDataException("Invalid sequence");
                    events.Add(evt);
                    validRawLines.Add(line);
                    lastSeq = evt.Seq;
                    lastHash = storedHash;
                } catch {
                    foundCorruption = true;
                    break;
                }
            }

            if (foundCorruption) {
                try {
                    string backupPath = logPath + ".corrupt." + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + ".bak";
                    File.Copy(logPath, backupPath, true);
                    string tmp = logPath + ".recovered.tmp";
                    File.WriteAllLines(tmp, validRawLines.ToArray(), Utf8NoBom);
                    File.Delete(logPath);
                    File.Move(tmp, logPath);
                } catch { }
            }

            return events;
        }

        /// <summary>
        /// Reads full logical event stream for a session (resolving reference-based parent fork chain)
        /// filtered to events with seq > afterSeq.
        /// </summary>
        public List<HarnessEvent> ReadEvents(string sessionId, long afterSeq = 0, int maxDepth = 16) {
            if (maxDepth <= 0) return new List<HarnessEvent>();
            string safe = SanitizeSessionId(sessionId);
            object lk = GetSessionLock(safe);
            List<HarnessEvent> own;
            lock (lk) {
                own = RecoverAndReadOwnFile(safe, out var lastSeq, out var lastHash);
                _lastSeqBySession[safe] = lastSeq;
                _lastHashBySession[safe] = lastHash;
            }

            if (own.Count == 0) return new List<HarnessEvent>();

            var result = new List<HarnessEvent>();
            var first = own[0];
            string parentId = first.Type == "session_started" ? first.Payload?["parentSessionId"]?.Value<string>() : null;
            long? forkAfter = first.Type == "session_started" ? first.Payload?["forkAfterSeq"]?.Value<long?>() : null;

            if (!string.IsNullOrEmpty(parentId) && forkAfter.HasValue && forkAfter.Value > 0 && SessionExists(parentId)) {
                var parentEvents = ReadEvents(parentId, 0, maxDepth - 1);
                foreach (var pe in parentEvents) {
                    if (pe.Seq <= forkAfter.Value && pe.Seq > afterSeq) {
                        result.Add(pe);
                    }
                }
            }

            foreach (var e in own) {
                if (e.Seq > afterSeq) result.Add(e);
            }
            return result;
        }

        /// <summary>
        /// Startup crash recovery: scans all session logs, repairs any partial trailing line,
        /// and closes any unclosed run with a synthetic run_finished(stopReason: "interrupted").
        /// </summary>
        public List<string> RecoverAllSessionsOnStartup() {
            var interruptedSessions = new List<string>();
            if (!Directory.Exists(_sessionsDir)) return interruptedSessions;

            foreach (string file in Directory.GetFiles(_sessionsDir, "*.jsonl")) {
                string sessionId = Path.GetFileNameWithoutExtension(file);
                try {
                    object lk = GetSessionLock(sessionId);
                    string unclosedRunId = null;
                    lock (lk) {
                        var events = RecoverAndReadOwnFile(sessionId, out var lastSeq, out var lastHash);
                        _lastSeqBySession[sessionId] = lastSeq;
                        _lastHashBySession[sessionId] = lastHash;

                        foreach (var e in events) {
                            if (e.Type == "run_started" || (e.Type == "message_delta" && !string.IsNullOrEmpty(e.RunId))) {
                                if (!string.IsNullOrEmpty(e.RunId)) unclosedRunId = e.RunId;
                            }
                            if (e.Type == "run_finished" && e.RunId == unclosedRunId) {
                                unclosedRunId = null;
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(unclosedRunId)) {
                        Append(sessionId, "run_finished", new JObject {
                            ["stopReason"] = "interrupted",
                            ["recoveredAfterCrash"] = true
                        }, unclosedRunId, durableFlush: true);
                        interruptedSessions.Add(sessionId);
                    }
                } catch { }
            }
            return interruptedSessions;
        }

        public List<SessionSummary> ListSessions() {
            var list = new List<SessionSummary>();
            if (!Directory.Exists(_sessionsDir)) return list;
            foreach (string file in Directory.GetFiles(_sessionsDir, "*.jsonl")) {
                string id = Path.GetFileNameWithoutExtension(file);
                try {
                    var summary = BuildSummary(id);
                    if (summary != null) list.Add(summary);
                } catch { }
            }
            return list.OrderByDescending(s => s.UpdatedAt, StringComparer.Ordinal).ToList();
        }

        public SessionSummary BuildSummary(string sessionId) {
            if (!SessionExists(sessionId)) return null;
            var events = ReadEvents(sessionId, 0);
            if (events.Count == 0) return null;

            var summary = new SessionSummary {
                SessionId = sessionId,
                CreatedAt = events[0].Ts,
                UpdatedAt = events[events.Count - 1].Ts,
                LastSeq = events[events.Count - 1].Seq
            };

            foreach (var e in events) {
                summary.UpdatedAt = e.Ts;
                if (e.Seq > summary.LastSeq) summary.LastSeq = e.Seq;
                if (e.Type == "session_started" && e.SessionId == sessionId) {
                    summary.Title = e.Payload?["title"]?.Value<string>() ?? summary.Title;
                    summary.Workspace = e.Payload?["workspace"]?.Value<string>() ?? summary.Workspace;
                    summary.Mode = e.Payload?["mode"]?.Value<string>() ?? summary.Mode;
                    summary.Autonomy = e.Payload?["autonomy"]?.Value<string>() ?? summary.Autonomy;
                    summary.Model = e.Payload?["model"]?.Value<string>() ?? summary.Model;
                    summary.ParentSessionId = e.Payload?["parentSessionId"]?.Value<string>();
                    summary.ForkAfterSeq = e.Payload?["forkAfterSeq"]?.Value<long?>();
                } else if (e.Type == "mode_changed") {
                    summary.Mode = e.Payload?["mode"]?.Value<string>() ?? summary.Mode;
                } else if (e.Type == "autonomy_changed") {
                    summary.Autonomy = e.Payload?["autonomy"]?.Value<string>() ?? summary.Autonomy;
                } else if (e.Type == "model_changed") {
                    summary.Model = e.Payload?["model"]?.Value<string>() ?? summary.Model;
                }
            }
            return summary;
        }
    }
}
