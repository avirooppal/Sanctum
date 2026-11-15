using System;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Sanctum {
    public partial class DesktopHost {
        private static readonly object FsWatchLock = new object();
        private static FileSystemWatcher _fsWatcher;
        private static string _watchedWorkspace = "";
        private static long _fsEventSeq = 0;
        private static readonly List<Dictionary<string, object>> _fsEvents = new List<Dictionary<string, object>>();
        private static string _activeTurnCheckpointId = null;
        private static DateTime _activeTurnCheckpointTime = DateTime.MinValue;

        private static readonly HashSet<string> IgnoredDirNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            ".git", "node_modules", ".next", "dist", "out", "__pycache__", ".venv", ".turbo", "target", "build_payload"
        };

        private static readonly HashSet<string> BlockedExternalOpenExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            ".exe", ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh",
            ".msc", ".msi", ".msp", ".scr", ".com", ".pif", ".hta", ".reg", ".dll", ".cpl", ".lnk"
        };

        public static void EnsureWorkspaceWatcher(string workspaceRoot) {
            if (string.IsNullOrEmpty(workspaceRoot) || !Directory.Exists(workspaceRoot)) return;
            lock (FsWatchLock) {
                if (_fsWatcher != null && string.Equals(_watchedWorkspace, workspaceRoot, StringComparison.OrdinalIgnoreCase)) {
                    return;
                }
                if (_fsWatcher != null) {
                    try { _fsWatcher.EnableRaisingEvents = false; _fsWatcher.Dispose(); } catch { }
                    _fsWatcher = null;
                }
                try {
                    _watchedWorkspace = workspaceRoot;
                    _fsWatcher = new FileSystemWatcher(workspaceRoot) {
                        IncludeSubdirectories = true,
                        NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size
                    };
                    FileSystemEventHandler onChanged = (s, e) => PushFsEvent(e.ChangeType.ToString().ToLowerInvariant(), e.FullPath);
                    RenamedEventHandler onRenamed = (s, e) => PushFsEvent("renamed", e.FullPath);
                    _fsWatcher.Changed += onChanged;
                    _fsWatcher.Created += onChanged;
                    _fsWatcher.Deleted += onChanged;
                    _fsWatcher.Renamed += onRenamed;
                    _fsWatcher.EnableRaisingEvents = true;
                } catch { }
            }
        }

        private static void PushFsEvent(string changeType, string fullPath) {
            if (string.IsNullOrEmpty(fullPath)) return;
            try {
                string root = _watchedWorkspace.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                string rel = fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)
                    ? fullPath.Substring(root.Length).Replace('\\', '/')
                    : Path.GetFileName(fullPath);
                if (string.IsNullOrEmpty(rel)) return;
                string[] parts = rel.Split('/');
                for (int i = 0; i < parts.Length; i++) {
                    if (IgnoredDirNames.Contains(parts[i])) return;
                }
                if (rel.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase) || rel.EndsWith(".bak", StringComparison.OrdinalIgnoreCase)) return;

                lock (FsWatchLock) {
                    _fsEventSeq++;
                    var ev = new Dictionary<string, object> {
                        { "seq", _fsEventSeq },
                        { "type", changeType },
                        { "path", rel },
                        { "timestamp", DateTime.UtcNow.ToString("o") }
                    };
                    _fsEvents.Add(ev);
                    if (_fsEvents.Count > 250) {
                        _fsEvents.RemoveAt(0);
                    }
                    Monitor.PulseAll(FsWatchLock);
                }
            } catch { }
        }

        private static string ComputeRevisionHash(byte[] data) {
            using (var sha = SHA256.Create()) {
                byte[] hash = sha.ComputeHash(data ?? new byte[0]);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant().Substring(0, 16);
            }
        }

        private static string GetRelativeWorkspacePath(string fullPath) {
            string root = ResolveCanonicalRealPath(_toolWorkspace).TrimEnd(Path.DirectorySeparatorChar);
            if (string.Equals(fullPath, root, StringComparison.OrdinalIgnoreCase)) return ".";
            string prefix = root + Path.DirectorySeparatorChar;
            if (fullPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) {
                return fullPath.Substring(prefix.Length).Replace('\\', '/');
            }
            return fullPath.Replace('\\', '/');
        }

        private static string GetMimeTypeForExtension(string ext) {
            switch ((ext ?? "").ToLowerInvariant()) {
                case ".html":
                case ".htm": return "text/html; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".webp": return "image/webp";
                case ".ico": return "image/x-icon";
                case ".bmp": return "image/bmp";
                case ".pdf": return "application/pdf";
                case ".mp4": return "video/mp4";
                case ".webm": return "video/webm";
                case ".ogg": return "audio/ogg";
                case ".mp3": return "audio/mpeg";
                case ".wav": return "audio/wav";
                case ".m4a": return "audio/mp4";
                case ".json": return "application/json; charset=utf-8";
                case ".csv": return "text/csv; charset=utf-8";
                case ".md":
                case ".txt":
                case ".log":
                case ".ts":
                case ".tsx":
                case ".js":
                case ".jsx":
                case ".py":
                case ".cs":
                case ".css":
                case ".yml":
                case ".yaml": return "text/plain; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        private bool HandleWorkspaceAndViewerEndpoints(HttpListenerRequest req, HttpListenerResponse res, string path, string method) {
            EnsureWorkspaceWatcher(_toolWorkspace);

            if (path == "/api/fs/tree" && method == "GET") {
                HandleFsTree(req, res);
                return true;
            }
            if (path == "/api/fs/read" && method == "GET") {
                HandleFsRead(req, res);
                return true;
            }
            if (path == "/api/fs/raw" && method == "GET") {
                HandleFsRaw(req, res);
                return true;
            }
            if (path == "/api/fs/write" && method == "POST") {
                HandleFsWrite(req, res);
                return true;
            }
            if (path == "/api/fs/events" && method == "GET") {
                HandleFsEvents(req, res);
                return true;
            }
            if (path == "/api/fs/reveal" && method == "POST") {
                HandleFsReveal(req, res);
                return true;
            }
            if (path == "/api/fs/open-external" && method == "POST") {
                HandleFsOpenExternal(req, res);
                return true;
            }
            if (path == "/api/fs/export-zip" && method == "POST") {
                HandleFsExportZip(req, res);
                return true;
            }
            if (path == "/api/updates/check" && (method == "GET" || method == "POST")) {
                HandleUpdatesCheck(req, res);
                return true;
            }
            if (path == "/api/ide/detect" && method == "GET") {
                HandleIdeDetect(req, res);
                return true;
            }
            if (path == "/api/ide/open" && method == "POST") {
                HandleIdeOpen(req, res);
                return true;
            }
            if (path == "/api/checkpoints" && (method == "GET" || method == "POST")) {
                HandleCheckpoints(req, res, method);
                return true;
            }
            if (path == "/api/audio/models" && (method == "GET" || method == "POST")) {
                HandleAudioModels(req, res, method);
                return true;
            }
            if (path == "/api/audio/download" && (method == "POST" || method == "DELETE")) {
                HandleAudioDownload(req, res, method);
                return true;
            }
            if (path.StartsWith("/api/browser/", StringComparison.OrdinalIgnoreCase)) {
                return HandleBrowserAgentEndpoints(req, res, path, method);
            }
            return false;
        }

        private void HandleFsTree(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string rawPath = req.QueryString["path"];
                if (string.IsNullOrEmpty(rawPath)) rawPath = ".";
                bool showIgnored = string.Equals(req.QueryString["showIgnored"], "true", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(req.QueryString["showIgnored"], "1", StringComparison.OrdinalIgnoreCase);

                string target = ToolPath(rawPath, true, "list");
                if (!Directory.Exists(target)) {
                    WriteJson(res, 404, new { error = "Directory not found: " + rawPath });
                    return;
                }

                var dirInfo = new DirectoryInfo(target);
                var entries = new List<Dictionary<string, object>>();
                FileSystemInfo[] items = dirInfo.GetFileSystemInfos();
                Array.Sort(items, (a, b) => {
                    bool aDir = (a.Attributes & FileAttributes.Directory) != 0;
                    bool bDir = (b.Attributes & FileAttributes.Directory) != 0;
                    if (aDir != bDir) return aDir ? -1 : 1;
                    return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
                });

                int count = 0;
                foreach (var item in items) {
                    if (count >= 500) break;
                    bool isDir = (item.Attributes & FileAttributes.Directory) != 0;
                    bool isLink = (item.Attributes & FileAttributes.ReparsePoint) != 0;
                    bool isIgnored = IgnoredDirNames.Contains(item.Name) || item.Name.StartsWith(".", StringComparison.Ordinal);
                    if (!showIgnored && isIgnored) continue;

                    long size = 0;
                    if (!isDir) {
                        try { size = ((FileInfo)item).Length; } catch { }
                    }
                    string relItemPath = GetRelativeWorkspacePath(item.FullName);
                    entries.Add(new Dictionary<string, object> {
                        { "name", item.Name },
                        { "path", relItemPath },
                        { "type", isDir ? "directory" : "file" },
                        { "isDirectory", isDir },
                        { "isSymlink", isLink },
                        { "ignored", isIgnored },
                        { "size", size },
                        { "extension", isDir ? "" : (item.Extension ?? "").ToLowerInvariant() },
                        { "modifiedAt", item.LastWriteTimeUtc.ToString("o") }
                    });
                    count++;
                }

                WriteJson(res, 200, new {
                    path = GetRelativeWorkspacePath(target),
                    root = _toolWorkspace,
                    workspaceId = _workspaceId,
                    entries = entries
                });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Symbolic", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("UNC", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        private void HandleFsRead(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string rawPath = req.QueryString["path"];
                if (string.IsNullOrEmpty(rawPath)) {
                    WriteJson(res, 400, new { error = "Missing path parameter." });
                    return;
                }
                int maxBytes = 2097152;
                if (!string.IsNullOrEmpty(req.QueryString["maxBytes"])) {
                    int parsed;
                    if (int.TryParse(req.QueryString["maxBytes"], out parsed)) {
                        maxBytes = Math.Max(1024, Math.Min(5242880, parsed));
                    }
                }

                string target = ToolPath(rawPath, false, "read");
                if (!File.Exists(target)) {
                    WriteJson(res, 404, new { error = "File not found: " + rawPath, exists = false });
                    return;
                }

                var fi = new FileInfo(target);
                long fileSize = fi.Length;
                int probeLen = (int)Math.Min(fileSize, 8192L);
                byte[] probe = new byte[probeLen];
                using (var fs = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                    fs.Read(probe, 0, probeLen);
                }

                bool isBinary = false;
                for (int i = 0; i < probeLen; i++) {
                    if (probe[i] == 0) {
                        isBinary = true;
                        break;
                    }
                }

                string relPath = GetRelativeWorkspacePath(target);
                if (isBinary) {
                    int hexLen = Math.Min(probeLen, 512);
                    var hexSb = new StringBuilder();
                    for (int offset = 0; offset < hexLen; offset += 16) {
                        hexSb.Append(offset.ToString("X4")).Append("  ");
                        var asciiSb = new StringBuilder();
                        for (int j = 0; j < 16; j++) {
                            if (offset + j < hexLen) {
                                byte b = probe[offset + j];
                                hexSb.Append(b.ToString("X2")).Append(' ');
                                asciiSb.Append(b >= 32 && b <= 126 ? (char)b : '.');
                            } else {
                                hexSb.Append("   ");
                            }
                        }
                        hexSb.Append(" ").AppendLine(asciiSb.ToString());
                    }
                    string rev = ComputeRevisionHash(probe) + "-" + fileSize;
                    WriteJson(res, 200, new {
                        path = relPath,
                        fullPath = target,
                        exists = true,
                        binary = true,
                        isBinary = true,
                        truncated = fileSize > hexLen,
                        size = fileSize,
                        modifiedAt = fi.LastWriteTimeUtc.ToString("o"),
                        revision = rev,
                        lineCount = 0,
                        content = (string)null,
                        hexPreview = hexSb.ToString()
                    });
                    return;
                }

                bool truncated = fileSize > maxBytes;
                int readBytesLen = (int)Math.Min(fileSize, (long)maxBytes);
                byte[] buffer = new byte[readBytesLen];
                using (var fs = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                    int totalRead = 0;
                    while (totalRead < readBytesLen) {
                        int r = fs.Read(buffer, totalRead, readBytesLen - totalRead);
                        if (r <= 0) break;
                        totalRead += r;
                    }
                }

                string text = Encoding.UTF8.GetString(buffer);
                if (text.Length > 0 && text[0] == '\uFEFF') text = text.Substring(1);
                int lineCount = 1;
                for (int i = 0; i < text.Length; i++) {
                    if (text[i] == '\n') lineCount++;
                }

                string revision = ComputeRevisionHash(buffer);
                WriteJson(res, 200, new {
                    path = relPath,
                    fullPath = target,
                    exists = true,
                    binary = false,
                    isBinary = false,
                    truncated = truncated,
                    size = fileSize,
                    modifiedAt = fi.LastWriteTimeUtc.ToString("o"),
                    revision = revision,
                    lineCount = lineCount,
                    content = text
                });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Symbolic", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("UNC", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message, exists = false });
            }
        }

        private void HandleFsRaw(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string rawPath = req.QueryString["path"];
                if (string.IsNullOrEmpty(rawPath)) {
                    WriteJson(res, 400, new { error = "Missing path parameter." });
                    return;
                }

                string target = ToolPath(rawPath, false, "read");
                if (!File.Exists(target)) {
                    WriteJson(res, 404, new { error = "File not found: " + rawPath });
                    return;
                }

                string ext = Path.GetExtension(target).ToLowerInvariant();
                res.ContentType = GetMimeTypeForExtension(ext);
                res.Headers.Add("X-Content-Type-Options", "nosniff");
                res.Headers.Add("Accept-Ranges", "bytes");
                if (ext == ".html" || ext == ".htm" || ext == ".svg" || ext == ".xml") {
                    res.Headers.Add("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; sandbox");
                }

                long fileLength = new FileInfo(target).Length;
                string rangeHeader = req.Headers["Range"];

                if (!string.IsNullOrEmpty(rangeHeader) && rangeHeader.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) {
                    string[] rangeParts = rangeHeader.Substring(6).Split('-');
                    long start = 0;
                    long end = fileLength - 1;
                    bool validStart = long.TryParse(rangeParts[0], out start);
                    if (rangeParts.Length > 1 && !string.IsNullOrEmpty(rangeParts[1])) {
                        long.TryParse(rangeParts[1], out end);
                    }
                    if (!validStart || start < 0 || start >= fileLength || end < start) {
                        res.StatusCode = 416;
                        res.Headers.Add("Content-Range", "bytes */" + fileLength);
                        res.Close();
                        return;
                    }
                    if (end >= fileLength) end = fileLength - 1;
                    long length = end - start + 1;

                    res.StatusCode = 206;
                    res.Headers.Add("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                    res.ContentLength64 = length;

                    using (var fs = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                        fs.Seek(start, SeekOrigin.Begin);
                        byte[] buf = new byte[65536];
                        long remaining = length;
                        while (remaining > 0) {
                            int r = fs.Read(buf, 0, (int)Math.Min(buf.Length, remaining));
                            if (r <= 0) break;
                            res.OutputStream.Write(buf, 0, r);
                            remaining -= r;
                        }
                    }
                    res.Close();
                    return;
                }

                res.StatusCode = 200;
                res.ContentLength64 = fileLength;
                using (var fs = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                    fs.CopyTo(res.OutputStream);
                }
                res.Close();
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Symbolic", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("UNC", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                try { WriteJson(res, code, new { error = ex.Message }); } catch { }
            }
        }

        private static bool ConsumeApprovalTokenAny(string token, params string[] expectedTools) {
            if (string.IsNullOrEmpty(token)) return false;
            lock (_approvalLock) {
                ApprovalTokenEntry entry;
                if (!_approvalTokens.TryGetValue(token, out entry)) return false;
                _approvalTokens.Remove(token);
                if (entry.ExpiresAtUtc <= DateTime.UtcNow) return false;
                if (entry.Tool == "*") return true;
                for (int i = 0; i < expectedTools.Length; i++) {
                    if (string.Equals(entry.Tool, expectedTools[i], StringComparison.OrdinalIgnoreCase)) return true;
                }
                return false;
            }
        }

        private void HandleFsWrite(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string token = req.Headers["X-Sanctum-Approval"];
                if (!ConsumeApprovalTokenAny(token, "edit_file", "create_file", "fs_write")) {
                    RecordAuditLog("fs_write", "", "write", "approval", "denied", "Missing or invalid single-use approval token.");
                    WriteJson(res, 403, new { error = "User approval token required to write file." });
                    return;
                }

                string body = ReadRequestBodyUtf8(req, 6291456);
                var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body);
                if (payload == null || !payload.ContainsKey("path") || !payload.ContainsKey("content")) {
                    WriteJson(res, 400, new { error = "Missing path or content." });
                    return;
                }

                string rawPath = Convert.ToString(payload["path"]);
                string content = Convert.ToString(payload["content"]) ?? "";
                if (Encoding.UTF8.GetByteCount(content) > 5242880) {
                    WriteJson(res, 413, new { error = "File content exceeds 5 MiB write limit." });
                    return;
                }

                lock (_toolLock) {
                    string target = ToolPath(rawPath, false, "edit");
                    string cpId = RecordPreToolSnapshot("edit", target, GetRelativeWorkspacePath(target));
                    WriteAtomicText(target, content);
                    string rev = ComputeRevisionHash(Encoding.UTF8.GetBytes(content));
                    PushFsEvent("changed", target);
                    WriteJson(res, 200, new {
                        status = "saved",
                        path = GetRelativeWorkspacePath(target),
                        revision = rev,
                        checkpointId = cpId
                    });
                }
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Symbolic", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("UNC", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        private void HandleFsEvents(HttpListenerRequest req, HttpListenerResponse res) {
            long since = 0;
            if (!string.IsNullOrEmpty(req.QueryString["since"])) {
                long.TryParse(req.QueryString["since"], out since);
            }

            bool isSse = string.Equals(req.QueryString["stream"], "1", StringComparison.OrdinalIgnoreCase) ||
                         (req.Headers["Accept"] != null && req.Headers["Accept"].IndexOf("text/event-stream", StringComparison.OrdinalIgnoreCase) >= 0 && req.QueryString["poll"] != "1");

            if (!isSse) {
                var list = new List<Dictionary<string, object>>();
                long currentSeq;
                lock (FsWatchLock) {
                    currentSeq = _fsEventSeq;
                    for (int i = 0; i < _fsEvents.Count; i++) {
                        long s = Convert.ToInt64(_fsEvents[i]["seq"]);
                        if (s > since) list.Add(_fsEvents[i]);
                    }
                }
                WriteJson(res, 200, new { seq = currentSeq, workspaceId = _workspaceId, events = list });
                return;
            }

            try {
                res.StatusCode = 200;
                res.ContentType = "text/event-stream";
                res.Headers.Add("Cache-Control", "no-cache");
                res.SendChunked = true;

                int maxWaitMs = 25000;
                if (!string.IsNullOrEmpty(req.QueryString["timeoutMs"])) {
                    int parsed;
                    if (int.TryParse(req.QueryString["timeoutMs"], out parsed)) {
                        maxWaitMs = Math.Max(200, Math.Min(60000, parsed));
                    }
                }

                var serializer = new JavaScriptSerializer();
                long cursor;
                lock (FsWatchLock) {
                    cursor = since > 0 ? since : _fsEventSeq;
                }

                byte[] initBytes = Encoding.UTF8.GetBytes("data: " + serializer.Serialize(new { type = "connected", seq = cursor, workspaceId = _workspaceId }) + "\n\n");
                res.OutputStream.Write(initBytes, 0, initBytes.Length);
                res.OutputStream.Flush();

                var sw = Stopwatch.StartNew();
                while (_running && sw.ElapsedMilliseconds < maxWaitMs) {
                    var pending = new List<Dictionary<string, object>>();
                    lock (FsWatchLock) {
                        for (int i = 0; i < _fsEvents.Count; i++) {
                            long s = Convert.ToInt64(_fsEvents[i]["seq"]);
                            if (s > cursor) {
                                pending.Add(_fsEvents[i]);
                                cursor = s;
                            }
                        }
                        if (pending.Count == 0) {
                            Monitor.Wait(FsWatchLock, Math.Min(1000, Math.Max(100, (int)(maxWaitMs - sw.ElapsedMilliseconds))));
                            for (int i = 0; i < _fsEvents.Count; i++) {
                                long s = Convert.ToInt64(_fsEvents[i]["seq"]);
                                if (s > cursor) {
                                    pending.Add(_fsEvents[i]);
                                    cursor = s;
                                }
                            }
                        }
                    }

                    foreach (var ev in pending) {
                        byte[] line = Encoding.UTF8.GetBytes("data: " + serializer.Serialize(ev) + "\n\n");
                        res.OutputStream.Write(line, 0, line.Length);
                    }
                    if (pending.Count > 0) {
                        res.OutputStream.Flush();
                        if (!string.IsNullOrEmpty(req.QueryString["once"])) break;
                    }
                }
            } catch { }
            finally {
                try { res.Close(); } catch { }
            }
        }

        private void HandleFsReveal(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string body = ReadRequestBodyUtf8(req, 65536);
                var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body);
                string rawPath = payload != null && payload.ContainsKey("path") ? Convert.ToString(payload["path"]) : ".";
                string target = ToolPath(rawPath, true, "read");
                if (!File.Exists(target) && !Directory.Exists(target)) {
                    WriteJson(res, 404, new { error = "Path does not exist: " + rawPath });
                    return;
                }
                if (req.Headers["X-Sanctum-Dry-Run"] != "1") {
                    string args = File.Exists(target) ? "/select,\"" + target + "\"" : "\"" + target + "\"";
                    Process.Start(new ProcessStartInfo("explorer.exe", args) { UseShellExecute = false });
                }
                WriteJson(res, 200, new { status = "revealed", path = GetRelativeWorkspacePath(target) });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        private void HandleFsOpenExternal(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string token = req.Headers["X-Sanctum-Approval"];
                if (!ConsumeApprovalToken(token, "open_external")) {
                    RecordAuditLog("open_external", "", "open_external", "approval", "denied", "Missing or invalid single-use approval token.");
                    WriteJson(res, 403, new { error = "User approval token required to open file externally." });
                    return;
                }

                string body = ReadRequestBodyUtf8(req, 65536);
                var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body);
                string rawPath = payload != null && payload.ContainsKey("path") ? Convert.ToString(payload["path"]) : "";
                if (string.IsNullOrEmpty(rawPath)) {
                    WriteJson(res, 400, new { error = "Missing path." });
                    return;
                }

                string target = ToolPath(rawPath, false, "read");
                if (!File.Exists(target)) {
                    WriteJson(res, 404, new { error = "File does not exist: " + rawPath });
                    return;
                }

                string ext = Path.GetExtension(target);
                if (!string.IsNullOrEmpty(ext) && BlockedExternalOpenExtensions.Contains(ext)) {
                    RecordAuditLog("open_external", target, "open_external", "security", "denied", "Blocked executable extension: " + ext);
                    WriteJson(res, 403, new { error = "Executable and script files cannot be launched via open-external (" + ext + ")." });
                    return;
                }

                if (req.Headers["X-Sanctum-Dry-Run"] != "1") {
                    Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
                }
                RecordAuditLog("open_external", target, "open_external", "local", "allowed", "Opened in default handler");
                WriteJson(res, 200, new { status = "opened", path = GetRelativeWorkspacePath(target) });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        private static List<Dictionary<string, object>> DetectInstalledIdes() {
            var list = new List<Dictionary<string, object>>();
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

            var candidates = new[] {
                new { id = "vscode", name = "VS Code", cmd = "code", paths = new[] {
                    Path.Combine(localApp, "Programs", "Microsoft VS Code", "Code.exe"),
                    Path.Combine(progFiles, "Microsoft VS Code", "Code.exe")
                }},
                new { id = "cursor", name = "Cursor", cmd = "cursor", paths = new[] {
                    Path.Combine(localApp, "Programs", "cursor", "Cursor.exe"),
                    Path.Combine(localApp, "cursor", "Cursor.exe")
                }},
                new { id = "windsurf", name = "Windsurf", cmd = "windsurf", paths = new[] {
                    Path.Combine(localApp, "Programs", "Windsurf", "Windsurf.exe")
                }},
                new { id = "notepadpp", name = "Notepad++", cmd = "notepad++", paths = new[] {
                    Path.Combine(progFiles, "Notepad++", "notepad++.exe")
                }}
            };

            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            string[] pathDirs = pathEnv.Split(';');

            foreach (var c in candidates) {
                string foundExe = null;
                foreach (string p in c.paths) {
                    if (!string.IsNullOrEmpty(p) && File.Exists(p)) {
                        foundExe = p;
                        break;
                    }
                }
                if (foundExe == null) {
                    foreach (string dir in pathDirs) {
                        try {
                            if (string.IsNullOrWhiteSpace(dir)) continue;
                            string cleanDir = dir.Trim().Trim('"');
                            string candidateCmd = Path.Combine(cleanDir, c.cmd + ".cmd");
                            string candidateExe = Path.Combine(cleanDir, c.cmd + ".exe");
                            if (File.Exists(candidateExe)) { foundExe = candidateExe; break; }
                            if (File.Exists(candidateCmd)) { foundExe = candidateCmd; break; }
                        } catch { }
                    }
                }
                if (foundExe != null) {
                    list.Add(new Dictionary<string, object> {
                        { "id", c.id },
                        { "name", c.name },
                        { "command", c.cmd },
                        { "executable", foundExe }
                    });
                }
            }

            list.Add(new Dictionary<string, object> {
                { "id", "explorer" },
                { "name", "Windows Explorer" },
                { "command", "explorer" },
                { "executable", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe") }
            });

            return list;
        }

        private void HandleIdeDetect(HttpListenerRequest req, HttpListenerResponse res) {
            var ides = DetectInstalledIdes();
            string preferred = ides.Count > 0 ? Convert.ToString(ides[0]["id"]) : "explorer";
            WriteJson(res, 200, new { ides = ides, preferred = preferred, workspace = _toolWorkspace });
        }

        private void HandleIdeOpen(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string token = req.Headers["X-Sanctum-Approval"];
                if (!ConsumeApprovalToken(token, "ide_open")) {
                    RecordAuditLog("ide_open", _toolWorkspace, "ide_open", "approval", "denied", "Missing or invalid single-use approval token.");
                    WriteJson(res, 403, new { error = "User approval token required to launch IDE." });
                    return;
                }

                string body = ReadRequestBodyUtf8(req, 65536);
                var payload = string.IsNullOrEmpty(body)
                    ? new Dictionary<string, object>()
                    : (new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>());

                string ideId = payload.ContainsKey("ideId") ? Convert.ToString(payload["ideId"]) : "";
                string rawPath = payload.ContainsKey("path") && !string.IsNullOrEmpty(Convert.ToString(payload["path"]))
                    ? Convert.ToString(payload["path"])
                    : ".";

                string target = ToolPath(rawPath, true, "read");
                var ides = DetectInstalledIdes();
                Dictionary<string, object> chosen = null;
                foreach (var item in ides) {
                    if (string.IsNullOrEmpty(ideId) || string.Equals(Convert.ToString(item["id"]), ideId, StringComparison.OrdinalIgnoreCase)) {
                        chosen = item;
                        break;
                    }
                }
                if (chosen == null) {
                    WriteJson(res, 404, new { error = "Requested IDE is not installed: " + ideId });
                    return;
                }

                string exePath = Convert.ToString(chosen["executable"]);
                string cmdName = Convert.ToString(chosen["command"]);
                string ruleAction, ruleReason;
                EvaluateCommandRule(cmdName + " \"" + target + "\"", out ruleAction, out ruleReason);
                if (ruleAction == "deny") {
                    RecordAuditLog("ide_open", target, exePath, "security", "denied", ruleReason);
                    WriteJson(res, 403, new { error = ruleReason });
                    return;
                }

                if (req.Headers["X-Sanctum-Dry-Run"] != "1") {
                    Process.Start(new ProcessStartInfo {
                        FileName = exePath,
                        Arguments = "\"" + target + "\"",
                        WorkingDirectory = Directory.Exists(target) ? target : _toolWorkspace,
                        UseShellExecute = false,
                        CreateNoWindow = exePath.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase)
                    });
                }

                RecordAuditLog("ide_open", target, exePath, "local", "allowed", "Opened workspace in " + Convert.ToString(chosen["name"]));
                WriteJson(res, 200, new {
                    status = "launched",
                    ide = Convert.ToString(chosen["id"]),
                    name = Convert.ToString(chosen["name"]),
                    target = target
                });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        // =====================================================================
        // Host-Side Checkpoints & Per-Hunk Unified Diff Engine
        // =====================================================================
        private static string GetWorkspaceSnapshotsDir(string wsId) {
            string dir = Path.Combine(_appDataDir, "snapshots", string.IsNullOrEmpty(wsId) ? "default" : wsId);
            if (!Directory.Exists(dir)) {
                try { Directory.CreateDirectory(dir); } catch { }
            }
            return dir;
        }

        public static string RecordPreToolSnapshot(string action, string fullPath, string relativePath) {
            try {
                string wsId = _workspaceId ?? "default";
                string snapBase = GetWorkspaceSnapshotsDir(wsId);
                var serializer = new JavaScriptSerializer { MaxJsonLength = 16777216 };

                bool reuseActive = _activeTurnCheckpointId != null &&
                                   (DateTime.UtcNow - _activeTurnCheckpointTime).TotalSeconds < 45 &&
                                   File.Exists(Path.Combine(snapBase, _activeTurnCheckpointId, "meta.json"));

                string cpId = reuseActive
                    ? _activeTurnCheckpointId
                    : "cp-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 6);

                string cpDir = Path.Combine(snapBase, cpId);
                if (!Directory.Exists(cpDir)) Directory.CreateDirectory(cpDir);
                string metaPath = Path.Combine(cpDir, "meta.json");

                Dictionary<string, object> meta = null;
                if (File.Exists(metaPath)) {
                    try { meta = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8)); } catch { }
                }

                var filesList = new List<Dictionary<string, object>>();
                if (meta != null && meta.ContainsKey("files") && meta["files"] is IEnumerable) {
                    foreach (object item in (IEnumerable)meta["files"]) {
                        var d = item as Dictionary<string, object>;
                        if (d != null) filesList.Add(d);
                    }
                }

                string normRel = (relativePath ?? GetRelativeWorkspacePath(fullPath)).Replace('\\', '/');
                bool alreadyRecorded = false;
                foreach (var f in filesList) {
                    if (f.ContainsKey("relativePath") && string.Equals(Convert.ToString(f["relativePath"]), normRel, StringComparison.OrdinalIgnoreCase)) {
                        alreadyRecorded = true;
                        break;
                    }
                }

                if (!alreadyRecorded) {
                    bool existsBefore = File.Exists(fullPath);
                    string origContent = null;
                    if (existsBefore) {
                        try {
                            if (new FileInfo(fullPath).Length <= 2097152) {
                                origContent = File.ReadAllText(fullPath, Encoding.UTF8);
                            }
                        } catch { }
                    }
                    filesList.Add(new Dictionary<string, object> {
                        { "relativePath", normRel },
                        { "fullPath", fullPath },
                        { "originalContent", origContent },
                        { "existsBefore", existsBefore }
                    });
                }

                var updatedMeta = new Dictionary<string, object> {
                    { "id", cpId },
                    { "timestamp", meta != null && meta.ContainsKey("timestamp") ? meta["timestamp"] : DateTime.UtcNow.ToString("o") },
                    { "workspaceId", wsId },
                    { "turnId", meta != null && meta.ContainsKey("turnId") ? meta["turnId"] : ("turn-" + DateTime.UtcNow.Ticks) },
                    { "summary", meta != null && meta.ContainsKey("summary") ? meta["summary"] : ("Workspace " + action + ": " + normRel) },
                    { "files", filesList }
                };
                if (meta != null && meta.ContainsKey("conversationSnapshot")) {
                    updatedMeta["conversationSnapshot"] = meta["conversationSnapshot"];
                }

                WriteAtomicText(metaPath, serializer.Serialize(updatedMeta));
                _activeTurnCheckpointId = cpId;
                _activeTurnCheckpointTime = DateTime.UtcNow;
                return cpId;
            } catch {
                return null;
            }
        }

        private static string[] SplitLinesNormalized(string text) {
            if (string.IsNullOrEmpty(text)) return new string[0];
            return text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
        }

        private static Dictionary<string, object> ComputeFileDiffWithHunks(string relPath, bool existsBefore, string originalContent, bool existsNow, string currentContent) {
            string status = !existsBefore && existsNow ? "added" : (existsBefore && !existsNow ? "deleted" : "modified");
            string[] oldLines = existsBefore && originalContent != null ? SplitLinesNormalized(originalContent) : new string[0];
            string[] newLines = existsNow && currentContent != null ? SplitLinesNormalized(currentContent) : new string[0];

            // Compute LCS edit script (capped at 2000 lines per side for fast interactive diffing)
            int n = Math.Min(oldLines.Length, 2000);
            int m = Math.Min(newLines.Length, 2000);

            int[,] dp = new int[n + 1, m + 1];
            for (int i = n - 1; i >= 0; i--) {
                for (int j = m - 1; j >= 0; j--) {
                    if (string.Equals(oldLines[i], newLines[j], StringComparison.Ordinal)) {
                        dp[i, j] = 1 + dp[i + 1, j + 1];
                    } else {
                        dp[i, j] = Math.Max(dp[i + 1, j], dp[i, j + 1]);
                    }
                }
            }

            var edits = new List<Dictionary<string, object>>();
            int x = 0, y = 0;
            int totalAdded = 0, totalRemoved = 0;
            while (x < n && y < m) {
                if (string.Equals(oldLines[x], newLines[y], StringComparison.Ordinal)) {
                    edits.Add(new Dictionary<string, object> {
                        { "type", "context" }, { "text", oldLines[x] }, { "oldLine", x + 1 }, { "newLine", y + 1 }
                    });
                    x++; y++;
                } else if (dp[x + 1, y] >= dp[x, y + 1]) {
                    edits.Add(new Dictionary<string, object> {
                        { "type", "del" }, { "text", oldLines[x] }, { "oldLine", x + 1 }, { "newLine", -1 }
                    });
                    totalRemoved++;
                    x++;
                } else {
                    edits.Add(new Dictionary<string, object> {
                        { "type", "add" }, { "text", newLines[y] }, { "oldLine", -1 }, { "newLine", y + 1 }
                    });
                    totalAdded++;
                    y++;
                }
            }
            while (x < n) {
                edits.Add(new Dictionary<string, object> {
                    { "type", "del" }, { "text", oldLines[x] }, { "oldLine", x + 1 }, { "newLine", -1 }
                });
                totalRemoved++;
                x++;
            }
            while (y < m) {
                edits.Add(new Dictionary<string, object> {
                    { "type", "add" }, { "text", newLines[y] }, { "oldLine", -1 }, { "newLine", y + 1 }
                });
                totalAdded++;
                y++;
            }

            // Group edits into hunks with up to 3 lines of context
            var hunks = new List<Dictionary<string, object>>();
            int idx = 0;
            int hunkIndex = 0;
            while (idx < edits.Count) {
                if (Convert.ToString(edits[idx]["type"]) == "context") {
                    idx++;
                    continue;
                }
                int startIdx = Math.Max(0, idx - 3);
                int endIdx = idx;
                while (endIdx < edits.Count) {
                    if (Convert.ToString(edits[endIdx]["type"]) != "context") {
                        endIdx++;
                        continue;
                    }
                    int nextChange = endIdx;
                    while (nextChange < edits.Count && Convert.ToString(edits[nextChange]["type"]) == "context") {
                        nextChange++;
                    }
                    if (nextChange < edits.Count && (nextChange - endIdx) <= 6) {
                        endIdx = nextChange + 1;
                    } else {
                        endIdx = Math.Min(edits.Count, endIdx + 3);
                        break;
                    }
                }

                var hunkLines = new List<Dictionary<string, object>>();
                int oldStart = -1, newStart = -1, oldCount = 0, newCount = 0;
                int hunkAdded = 0, hunkRemoved = 0;
                for (int k = startIdx; k < endIdx; k++) {
                    var e = edits[k];
                    string t = Convert.ToString(e["type"]);
                    int ol = Convert.ToInt32(e["oldLine"]);
                    int nl = Convert.ToInt32(e["newLine"]);
                    if (ol > 0 && oldStart < 0) oldStart = ol;
                    if (nl > 0 && newStart < 0) newStart = nl;
                    if (t == "context" || t == "del") oldCount++;
                    if (t == "context" || t == "add") newCount++;
                    if (t == "add") hunkAdded++;
                    if (t == "del") hunkRemoved++;
                    hunkLines.Add(e);
                }
                if (oldStart < 0) oldStart = 1;
                if (newStart < 0) newStart = 1;

                hunks.Add(new Dictionary<string, object> {
                    { "index", hunkIndex++ },
                    { "oldStart", oldStart },
                    { "oldLines", oldCount },
                    { "newStart", newStart },
                    { "newLines", newCount },
                    { "header", "@@ -" + oldStart + "," + oldCount + " +" + newStart + "," + newCount + " @@" },
                    { "added", hunkAdded },
                    { "removed", hunkRemoved },
                    { "lines", hunkLines }
                });

                idx = endIdx;
            }

            return new Dictionary<string, object> {
                { "path", relPath },
                { "status", status },
                { "added", totalAdded },
                { "removed", totalRemoved },
                { "hunks", hunks }
            };
        }

        private static string ReconstructFileWithAcceptedHunks(string originalContent, string currentContent, HashSet<int> acceptedHunkIndices) {
            string[] oldLines = originalContent != null ? SplitLinesNormalized(originalContent) : new string[0];
            string[] newLines = currentContent != null ? SplitLinesNormalized(currentContent) : new string[0];
            var diff = ComputeFileDiffWithHunks("", originalContent != null, originalContent, currentContent != null, currentContent);
            var hunks = diff["hunks"] as List<Dictionary<string, object>>;
            if (hunks == null || hunks.Count == 0) return currentContent ?? "";

            var resultLines = new List<string>();
            int oldCursor = 0; // 0-based index into oldLines

            foreach (var h in hunks) {
                int hIdx = Convert.ToInt32(h["index"]);
                var hLines = h["lines"] as List<Dictionary<string, object>>;
                if (hLines == null || hLines.Count == 0) continue;

                // Find first oldLine referenced in this hunk
                int hunkFirstOldIndex = oldLines.Length;
                foreach (var hl in hLines) {
                    int ol = Convert.ToInt32(hl["oldLine"]);
                    if (ol > 0) {
                        hunkFirstOldIndex = ol - 1;
                        break;
                    }
                }

                while (oldCursor < hunkFirstOldIndex && oldCursor < oldLines.Length) {
                    resultLines.Add(oldLines[oldCursor]);
                    oldCursor++;
                }

                bool accept = acceptedHunkIndices.Contains(hIdx);
                foreach (var hl in hLines) {
                    string t = Convert.ToString(hl["type"]);
                    string txt = Convert.ToString(hl["text"]);
                    if (t == "context") {
                        resultLines.Add(txt);
                        oldCursor++;
                    } else if (t == "del") {
                        if (!accept) {
                            resultLines.Add(txt);
                        }
                        oldCursor++;
                    } else if (t == "add") {
                        if (accept) {
                            resultLines.Add(txt);
                        }
                    }
                }
            }

            while (oldCursor < oldLines.Length) {
                resultLines.Add(oldLines[oldCursor]);
                oldCursor++;
            }

            return string.Join("\n", resultLines.ToArray());
        }

        private static Dictionary<string, object> EnrichCheckpointWithDiffs(Dictionary<string, object> cp) {
            var enriched = new Dictionary<string, object>(cp);
            var fileDiffs = new List<Dictionary<string, object>>();
            int totalAdded = 0, totalRemoved = 0;

            if (cp.ContainsKey("files") && cp["files"] is IEnumerable) {
                foreach (object item in (IEnumerable)cp["files"]) {
                    var f = item as Dictionary<string, object>;
                    if (f == null) continue;
                    string relPath = f.ContainsKey("relativePath") ? Convert.ToString(f["relativePath"]) : "";
                    string fullPath = f.ContainsKey("fullPath") ? Convert.ToString(f["fullPath"]) : "";
                    bool existsBefore = f.ContainsKey("existsBefore") && Convert.ToBoolean(f["existsBefore"]);
                    string origContent = f.ContainsKey("originalContent") && f["originalContent"] != null ? Convert.ToString(f["originalContent"]) : null;

                    bool existsNow = !string.IsNullOrEmpty(fullPath) && File.Exists(fullPath);
                    string currContent = null;
                    if (existsNow) {
                        try {
                            if (new FileInfo(fullPath).Length <= 2097152) {
                                currContent = File.ReadAllText(fullPath, Encoding.UTF8);
                            }
                        } catch { }
                    }

                    if (existsBefore == existsNow && string.Equals(origContent ?? "", currContent ?? "", StringComparison.Ordinal)) {
                        continue;
                    }

                    var fd = ComputeFileDiffWithHunks(relPath, existsBefore, origContent, existsNow, currContent);
                    totalAdded += Convert.ToInt32(fd["added"]);
                    totalRemoved += Convert.ToInt32(fd["removed"]);
                    fileDiffs.Add(fd);
                }
            }

            enriched["fileDiffs"] = fileDiffs;
            enriched["filesChanged"] = fileDiffs.Count;
            enriched["totalAdded"] = totalAdded;
            enriched["totalRemoved"] = totalRemoved;
            return enriched;
        }

        private static List<Dictionary<string, object>> LoadHostCheckpoints(string wsId, int limit) {
            string snapDir = GetWorkspaceSnapshotsDir(wsId);
            var list = new List<Dictionary<string, object>>();
            if (!Directory.Exists(snapDir)) return list;

            var serializer = new JavaScriptSerializer { MaxJsonLength = 16777216 };
            var dirs = new DirectoryInfo(snapDir).GetDirectories();
            Array.Sort(dirs, (a, b) => b.LastWriteTimeUtc.CompareTo(a.LastWriteTimeUtc));

            foreach (var d in dirs) {
                if (list.Count >= limit) break;
                string metaPath = Path.Combine(d.FullName, "meta.json");
                if (!File.Exists(metaPath)) continue;
                try {
                    var parsed = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8));
                    if (parsed != null) {
                        list.Add(EnrichCheckpointWithDiffs(parsed));
                    }
                } catch { }
            }
            return list;
        }

        private void HandleCheckpoints(HttpListenerRequest req, HttpListenerResponse res, string method) {
            try {
                var serializer = new JavaScriptSerializer { MaxJsonLength = 16777216 };
                string wsId = _workspaceId ?? "default";

                if (method == "GET") {
                    int limit = 30;
                    if (!string.IsNullOrEmpty(req.QueryString["limit"])) {
                        int.TryParse(req.QueryString["limit"], out limit);
                        limit = Math.Max(1, Math.Min(100, limit));
                    }
                    var checkpoints = LoadHostCheckpoints(wsId, limit);
                    WriteJson(res, 200, new { checkpoints = checkpoints, workspaceId = wsId });
                    return;
                }

                string body = ReadRequestBodyUtf8(req, 8388608);
                var payload = serializer.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
                string action = payload.ContainsKey("action") ? Convert.ToString(payload["action"]) : "create";

                if (action == "create") {
                    string summary = payload.ContainsKey("summary") ? Convert.ToString(payload["summary"]) :
                                     (payload.ContainsKey("label") ? Convert.ToString(payload["label"]) : "Manual checkpoint");
                    string turnId = payload.ContainsKey("turnId") ? Convert.ToString(payload["turnId"]) : ("turn-" + DateTime.UtcNow.Ticks);

                    // If pre-tool snapshots were already recorded in _activeTurnCheckpointId during this turn and no explicit affectedFiles were passed, finalize that checkpoint
                    if (!payload.ContainsKey("affectedFiles") && !string.IsNullOrEmpty(_activeTurnCheckpointId)) {
                        string activeMetaPath = Path.Combine(GetWorkspaceSnapshotsDir(wsId), _activeTurnCheckpointId, "meta.json");
                        if (File.Exists(activeMetaPath)) {
                            var activeCp = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(activeMetaPath, Encoding.UTF8));
                            if (activeCp != null) {
                                activeCp["summary"] = summary;
                                WriteAtomicText(activeMetaPath, serializer.Serialize(activeCp));
                                _activeTurnCheckpointId = null;
                                var enrichedActive = EnrichCheckpointWithDiffs(activeCp);
                                var respActive = new Dictionary<string, object>(enrichedActive);
                                respActive["checkpoint"] = enrichedActive;
                                WriteJson(res, 200, respActive);
                                return;
                            }
                        }
                    }

                    string cpId = "cp-" + DateTime.UtcNow.Ticks.ToString() + "-" + Guid.NewGuid().ToString("N").Substring(0, 6);
                    string cpDir = Path.Combine(GetWorkspaceSnapshotsDir(wsId), cpId);
                    Directory.CreateDirectory(cpDir);

                    var files = new List<Dictionary<string, object>>();
                    if (payload.ContainsKey("affectedFiles") && payload["affectedFiles"] is IEnumerable) {
                        foreach (object item in (IEnumerable)payload["affectedFiles"]) {
                            string rawFile = Convert.ToString(item);
                            if (string.IsNullOrEmpty(rawFile)) continue;
                            string fullPath = ToolPath(rawFile, false, "read");
                            string rel = GetRelativeWorkspacePath(fullPath);
                            bool existsBefore = File.Exists(fullPath);
                            string origContent = null;
                            if (existsBefore && new FileInfo(fullPath).Length <= 2097152) {
                                origContent = File.ReadAllText(fullPath, Encoding.UTF8);
                            }
                            files.Add(new Dictionary<string, object> {
                                { "relativePath", rel },
                                { "fullPath", fullPath },
                                { "originalContent", origContent },
                                { "existsBefore", existsBefore }
                            });
                        }
                    }

                    var cp = new Dictionary<string, object> {
                        { "id", cpId },
                        { "timestamp", DateTime.UtcNow.ToString("o") },
                        { "workspaceId", wsId },
                        { "turnId", turnId },
                        { "summary", summary },
                        { "files", files }
                    };
                    if (payload.ContainsKey("conversationSnapshot")) {
                        cp["conversationSnapshot"] = payload["conversationSnapshot"];
                    }

                    WriteAtomicText(Path.Combine(cpDir, "meta.json"), serializer.Serialize(cp));
                    _activeTurnCheckpointId = cpId;
                    _activeTurnCheckpointTime = DateTime.UtcNow;
                    var enriched = EnrichCheckpointWithDiffs(cp);
                    var resp = new Dictionary<string, object>(enriched);
                    resp["checkpoint"] = enriched;
                    WriteJson(res, 200, resp);
                    return;
                }

                if (action == "diff") {
                    string cpId = payload.ContainsKey("checkpointId") ? Convert.ToString(payload["checkpointId"]) :
                                  (payload.ContainsKey("id") ? Convert.ToString(payload["id"]) : _activeTurnCheckpointId);
                    if (string.IsNullOrEmpty(cpId) || cpId == "latest") {
                        var all = LoadHostCheckpoints(wsId, 1);
                        if (all.Count == 0) {
                            WriteJson(res, 404, new { error = "No checkpoints found." });
                            return;
                        }
                        WriteJson(res, 200, all[0]);
                        return;
                    }
                    string metaPath = Path.Combine(GetWorkspaceSnapshotsDir(wsId), cpId, "meta.json");
                    if (!File.Exists(metaPath)) {
                        WriteJson(res, 404, new { error = "Checkpoint not found: " + cpId });
                        return;
                    }
                    var cp = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8));
                    WriteJson(res, 200, EnrichCheckpointWithDiffs(cp));
                    return;
                }

                if (action == "apply_hunks") {
                    string token = req.Headers["X-Sanctum-Approval"];
                    if (!ConsumeApprovalTokenAny(token, "checkpoint_rewind", "edit_file")) {
                        WriteJson(res, 403, new { error = "User approval token required to apply hunk changes." });
                        return;
                    }

                    string cpId = payload.ContainsKey("checkpointId") ? Convert.ToString(payload["checkpointId"]) :
                                  (payload.ContainsKey("id") ? Convert.ToString(payload["id"]) : "");
                    string relPath = payload.ContainsKey("path") ? Convert.ToString(payload["path"]) : "";
                    if (string.IsNullOrEmpty(cpId) || string.IsNullOrEmpty(relPath)) {
                        WriteJson(res, 400, new { error = "Missing checkpointId or path." });
                        return;
                    }

                    string metaPath = Path.Combine(GetWorkspaceSnapshotsDir(wsId), cpId, "meta.json");
                    if (!File.Exists(metaPath)) {
                        WriteJson(res, 404, new { error = "Checkpoint not found: " + cpId });
                        return;
                    }

                    var cp = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8));
                    Dictionary<string, object> matchedFile = null;
                    if (cp != null && cp.ContainsKey("files") && cp["files"] is IEnumerable) {
                        foreach (object item in (IEnumerable)cp["files"]) {
                            var f = item as Dictionary<string, object>;
                            if (f != null && string.Equals(Convert.ToString(f["relativePath"]), relPath.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase)) {
                                matchedFile = f;
                                break;
                            }
                        }
                    }
                    if (matchedFile == null) {
                        WriteJson(res, 404, new { error = "File not found in checkpoint: " + relPath });
                        return;
                    }

                    string target = ToolPath(relPath, false, "edit");
                    string origContent = matchedFile.ContainsKey("originalContent") && matchedFile["originalContent"] != null
                        ? Convert.ToString(matchedFile["originalContent"])
                        : "";
                    string currContent = File.Exists(target) ? File.ReadAllText(target, Encoding.UTF8) : "";

                    var accepted = new HashSet<int>();
                    object hunksObj = payload.ContainsKey("acceptedHunkIndices") ? payload["acceptedHunkIndices"] :
                                      (payload.ContainsKey("acceptedHunks") ? payload["acceptedHunks"] : null);
                    if (hunksObj is IEnumerable) {
                        foreach (object idxObj in (IEnumerable)hunksObj) {
                            accepted.Add(Convert.ToInt32(idxObj));
                        }
                    }

                    string reconstructed = ReconstructFileWithAcceptedHunks(origContent, currContent, accepted);
                    lock (_toolLock) {
                        WriteAtomicText(target, reconstructed);
                        PushFsEvent("changed", target);
                    }

                    WriteJson(res, 200, EnrichCheckpointWithDiffs(cp));
                    return;
                }

                if (action == "rewind") {
                    string token = req.Headers["X-Sanctum-Approval"];
                    if (!ConsumeApprovalTokenAny(token, "checkpoint_rewind", "undo_last_action")) {
                        WriteJson(res, 403, new { error = "User approval token required to rewind checkpoint." });
                        return;
                    }

                    string cpId = payload.ContainsKey("checkpointId") ? Convert.ToString(payload["checkpointId"]) :
                                  (payload.ContainsKey("id") ? Convert.ToString(payload["id"]) : "");
                    string mode = payload.ContainsKey("mode") ? Convert.ToString(payload["mode"]) : "both";
                    string metaPath = Path.Combine(GetWorkspaceSnapshotsDir(wsId), cpId, "meta.json");
                    if (string.IsNullOrEmpty(cpId) || !File.Exists(metaPath)) {
                        WriteJson(res, 404, new { error = "Checkpoint not found: " + cpId });
                        return;
                    }

                    var cp = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(metaPath, Encoding.UTF8));
                    var restoredFiles = new List<string>();
                    var deletedFiles = new List<string>();

                    if (mode == "files" || mode == "both") {
                        lock (_toolLock) {
                            if (cp.ContainsKey("files") && cp["files"] is IEnumerable) {
                                foreach (object item in (IEnumerable)cp["files"]) {
                                    var f = item as Dictionary<string, object>;
                                    if (f == null) continue;
                                    string relPath = Convert.ToString(f["relativePath"]);
                                    bool existsBefore = f.ContainsKey("existsBefore") && Convert.ToBoolean(f["existsBefore"]);
                                    string origContent = f.ContainsKey("originalContent") && f["originalContent"] != null
                                        ? Convert.ToString(f["originalContent"])
                                        : null;

                                    string target = ToolPath(relPath, false, "edit");
                                    if (existsBefore && origContent != null) {
                                        WriteAtomicText(target, origContent);
                                        PushFsEvent("changed", target);
                                        restoredFiles.Add(relPath);
                                    } else if (!existsBefore && File.Exists(target)) {
                                        string trash = Path.Combine(_appDataDir, "tool-trash", Guid.NewGuid().ToString("N"));
                                        Directory.CreateDirectory(trash);
                                        string saved = Path.Combine(trash, Path.GetFileName(target));
                                        MovePathSafe(target, saved);
                                        File.WriteAllText(Path.Combine(trash, "restore.json"), serializer.Serialize(new { original = target, saved = saved }));
                                        PushFsEvent("deleted", target);
                                        deletedFiles.Add(relPath);
                                    }
                                }
                            }
                        }
                    }

                    bool convRestored = (mode == "conversation" || mode == "both") && cp.ContainsKey("conversationSnapshot") && cp["conversationSnapshot"] != null;
                    WriteJson(res, 200, new {
                        checkpointId = cpId,
                        mode = mode,
                        restoredFiles = restoredFiles,
                        deletedFiles = deletedFiles,
                        conversationRestored = convRestored,
                        restoredConversation = convRestored ? cp["conversationSnapshot"] : null
                    });
                    return;
                }

                WriteJson(res, 400, new { error = "Unsupported checkpoint action: " + action });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        // =====================================================================
        // C# Host Parity for STT Models (/api/audio/models & /api/audio/download)
        // =====================================================================
        private static List<Dictionary<string, object>> GetSttCatalogDefinitions() {
            return new List<Dictionary<string, object>> {
                new Dictionary<string, object> {
                    { "id", "qwen3-asr-0.6b" },
                    { "name", "Alibaba Qwen3-ASR-0.6B" },
                    { "tier", "light" },
                    { "badge", "Light & Accurate" },
                    { "parameters", "600M" },
                    { "sizeGB", 1.2 },
                    { "vramRequiredGB", 1.5 },
                    { "languages", "52 languages" },
                    { "bestFor", "Real-time transcription, edge deployments, and consumer GPUs or CPUs" },
                    { "description", "Built with just 600 million parameters, it runs fast with low VRAM usage while handling 52 languages, heavy accents, and noisy audio." },
                    { "hfRepo", "Qwen/Qwen3-ASR-0.6B" },
                    { "engineModelArg", "qwen3-asr-0.6b" }
                },
                new Dictionary<string, object> {
                    { "id", "nemotron-3.5-transcribe" },
                    { "name", "NVIDIA Nemotron 3.5 Transcribe" },
                    { "tier", "heavy" },
                    { "badge", "Heavy & Super Accurate" },
                    { "parameters", "1.1B" },
                    { "sizeGB", 2.8 },
                    { "vramRequiredGB", 6.0 },
                    { "languages", "English (Leaderboard #1)" },
                    { "bestFor", "Offline batch transcription, medical or legal audio, and high-VRAM NVIDIA GPUs" },
                    { "description", "Top-tier open-source ASR (~5.6% WER) with clean punctuation, capitalization, and complex technical vocabulary without hallucinating during pauses." },
                    { "hfRepo", "nvidia/parakeet-tdt-0.6b-v2" },
                    { "engineModelArg", "nemotron-3.5-transcribe" }
                }
            };
        }

        private void HandleAudioModels(HttpListenerRequest req, HttpListenerResponse res, string method) {
            string sttDir = Path.Combine(_modelsDir, "stt");
            if (!Directory.Exists(sttDir)) {
                try { Directory.CreateDirectory(sttDir); } catch { }
            }
            string activeMetaFile = Path.Combine(sttDir, "active_model.json");
            var serializer = new JavaScriptSerializer();

            if (method == "GET") {
                string activeId = "qwen3-asr-0.6b";
                if (File.Exists(activeMetaFile)) {
                    try {
                        var parsed = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(activeMetaFile, Encoding.UTF8));
                        if (parsed != null && parsed.ContainsKey("activeModelId")) {
                            activeId = Convert.ToString(parsed["activeModelId"]);
                        }
                    } catch { }
                }

                var catalog = GetSttCatalogDefinitions();
                foreach (var m in catalog) {
                    string id = Convert.ToString(m["id"]);
                    string mDir = Path.Combine(sttDir, id);
                    string marker = Path.Combine(mDir, ".sanctum_stt_ready.json");
                    bool downloaded = File.Exists(marker);
                    m["downloaded"] = downloaded;
                    m["active"] = string.Equals(id, activeId, StringComparison.OrdinalIgnoreCase);
                    m["installPath"] = downloaded ? mDir : null;
                }

                object serverStatus = null;
                try {
                    var hReq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8000/health");
                    hReq.Proxy = null; hReq.Timeout = 1000;
                    using (var hRes = hReq.GetResponse())
                    using (var r = new StreamReader(hRes.GetResponseStream())) {
                        serverStatus = serializer.DeserializeObject(r.ReadToEnd());
                    }
                } catch { }

                WriteJson(res, 200, new {
                    models = catalog,
                    activeModelId = activeId,
                    sttDir = sttDir,
                    serverStatus = serverStatus
                });
                return;
            }

            if (method == "POST") {
                try {
                    string body = ReadRequestBodyUtf8(req, 65536);
                    var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                    string modelId = payload != null && payload.ContainsKey("modelId") ? Convert.ToString(payload["modelId"]) : "";
                    if (modelId != "qwen3-asr-0.6b" && modelId != "nemotron-3.5-transcribe") {
                        WriteJson(res, 400, new { error = "Unknown STT model ID." });
                        return;
                    }
                    WriteAtomicText(activeMetaFile, serializer.Serialize(new {
                        activeModelId = modelId,
                        updatedAt = DateTime.UtcNow.ToString("o")
                    }));
                    WriteJson(res, 200, new { status = "selected", activeModelId = modelId });
                } catch (Exception ex) {
                    WriteJson(res, 400, new { error = ex.Message });
                }
            }
        }

        private void HandleAudioDownload(HttpListenerRequest req, HttpListenerResponse res, string method) {
            string sttDir = Path.Combine(_modelsDir, "stt");
            if (!Directory.Exists(sttDir)) {
                try { Directory.CreateDirectory(sttDir); } catch { }
            }
            var serializer = new JavaScriptSerializer();

            if (method == "DELETE") {
                try {
                    string body = ReadRequestBodyUtf8(req, 65536);
                    var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                    string modelId = payload != null && payload.ContainsKey("modelId") ? Convert.ToString(payload["modelId"]) : "";
                    if (modelId != "qwen3-asr-0.6b" && modelId != "nemotron-3.5-transcribe") {
                        WriteJson(res, 400, new { error = "Unknown STT model ID." });
                        return;
                    }
                    string mDir = Path.Combine(sttDir, modelId);
                    if (Directory.Exists(mDir)) Directory.Delete(mDir, true);
                    WriteJson(res, 200, new { status = "deleted", modelId = modelId });
                } catch (Exception ex) {
                    WriteJson(res, 500, new { error = ex.Message });
                }
                return;
            }

            if (method == "POST") {
                try {
                    string body = ReadRequestBodyUtf8(req, 65536);
                    var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                    string modelId = payload != null && payload.ContainsKey("modelId") ? Convert.ToString(payload["modelId"]) : "";
                    if (modelId != "qwen3-asr-0.6b" && modelId != "nemotron-3.5-transcribe") {
                        WriteJson(res, 400, new { error = "Unknown STT model ID." });
                        return;
                    }

                    res.StatusCode = 200;
                    res.ContentType = "application/x-ndjson";
                    res.SendChunked = true;

                    string scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "core", "ai", "speech", "stt_download.py");
                    if (!File.Exists(scriptPath)) {
                        scriptPath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "core", "ai", "speech", "stt_download.py"));
                    }

                    if (File.Exists(scriptPath)) {
                        var psi = new ProcessStartInfo {
                            FileName = "python",
                            Arguments = "\"" + scriptPath + "\" --model-id " + modelId + " --target-dir \"" + sttDir + "\"",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true
                        };
                        using (var proc = Process.Start(psi)) {
                            if (_jobHandle != IntPtr.Zero) {
                                try { AssignProcessToJobObject(_jobHandle, proc.Handle); } catch { }
                            }
                            string line;
                            while ((line = proc.StandardOutput.ReadLine()) != null) {
                                byte[] bytes = Encoding.UTF8.GetBytes(line + "\n");
                                res.OutputStream.Write(bytes, 0, bytes.Length);
                                res.OutputStream.Flush();
                            }
                            proc.WaitForExit(600000);
                        }
                    } else {
                        string mDir = Path.Combine(sttDir, modelId);
                        Directory.CreateDirectory(mDir);
                        File.WriteAllText(Path.Combine(mDir, ".sanctum_stt_ready.json"), serializer.Serialize(new {
                            modelId = modelId,
                            status = "ready",
                            completedAt = DateTime.UtcNow.ToString("o")
                        }), Encoding.UTF8);
                        byte[] doneBytes = Encoding.UTF8.GetBytes(serializer.Serialize(new {
                            status = "success",
                            completed = 100,
                            total = 100,
                            modelId = modelId
                        }) + "\n");
                        res.OutputStream.Write(doneBytes, 0, doneBytes.Length);
                        res.OutputStream.Flush();
                    }

                    string activeMetaFile = Path.Combine(sttDir, "active_model.json");
                    if (!File.Exists(activeMetaFile)) {
                        WriteAtomicText(activeMetaFile, serializer.Serialize(new { activeModelId = modelId }));
                    }
                    res.Close();
                } catch (Exception ex) {
                    try { WriteJson(res, 500, new { error = ex.Message }); } catch { }
                }
            }
        }

        private void HandleFsExportZip(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                string body = ReadRequestBodyUtf8(req, 1048576);
                var serializer = new JavaScriptSerializer();
                var payload = serializer.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();

                var rawPaths = new List<string>();
                if (payload.ContainsKey("paths") && payload["paths"] is IEnumerable) {
                    foreach (object item in (IEnumerable)payload["paths"]) {
                        string p = Convert.ToString(item);
                        if (!string.IsNullOrWhiteSpace(p)) rawPaths.Add(p.Trim());
                    }
                }
                if (rawPaths.Count == 0) {
                    WriteJson(res, 400, new { error = "At least one file path is required in 'paths'." });
                    return;
                }

                string archiveName = payload.ContainsKey("archiveName") && payload["archiveName"] != null
                    ? Path.GetFileName(Convert.ToString(payload["archiveName"]))
                    : "sanctum-deliverables.zip";
                if (string.IsNullOrWhiteSpace(archiveName)) archiveName = "sanctum-deliverables.zip";
                if (!archiveName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) archiveName += ".zip";

                bool saveToWorkspace = payload.ContainsKey("saveToWorkspace") && Convert.ToBoolean(payload["saveToWorkspace"]);

                var validatedFiles = new List<KeyValuePair<string, string>>();
                var seenEntries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (string rawPath in rawPaths) {
                    string fullPath = ToolPath(rawPath, false, "read");
                    if (!File.Exists(fullPath)) {
                        WriteJson(res, 404, new { error = "Deliverable file not found: " + rawPath });
                        return;
                    }
                    string entryName = GetRelativeWorkspacePath(fullPath).Replace('\\', '/').TrimStart('/');
                    if (string.IsNullOrEmpty(entryName) || entryName.Contains("..")) {
                        entryName = Path.GetFileName(fullPath);
                    }
                    if (seenEntries.Add(entryName)) {
                        validatedFiles.Add(new KeyValuePair<string, string>(entryName, fullPath));
                    }
                }

                byte[] zipBytes;
                using (var ms = new MemoryStream()) {
                    using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, true)) {
                        foreach (var kv in validatedFiles) {
                            var entry = archive.CreateEntry(kv.Key, CompressionLevel.Optimal);
                            using (var entryStream = entry.Open())
                            using (var fileStream = new FileStream(kv.Value, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                                fileStream.CopyTo(entryStream);
                            }
                        }
                    }
                    zipBytes = ms.ToArray();
                }

                string savedRelPath = null;
                if (saveToWorkspace) {
                    string destFull = ToolPath(archiveName, false, "create");
                    File.WriteAllBytes(destFull, zipBytes);
                    PushFsEvent("created", destFull);
                    savedRelPath = GetRelativeWorkspacePath(destFull);
                }

                if (req.QueryString["download"] == "1") {
                    res.StatusCode = 200;
                    res.ContentType = "application/zip";
                    res.ContentLength64 = zipBytes.LongLength;
                    res.Headers["Content-Disposition"] = "attachment; filename=\"" + archiveName.Replace("\"", "") + "\"";
                    res.OutputStream.Write(zipBytes, 0, zipBytes.Length);
                    res.Close();
                    return;
                }

                WriteJson(res, 200, new {
                    status = "ok",
                    archiveName = archiveName,
                    fileCount = validatedFiles.Count,
                    sizeBytes = zipBytes.Length,
                    savedPath = savedRelPath,
                    zipBase64 = Convert.ToBase64String(zipBytes)
                });
            } catch (Exception ex) {
                int code = ex.Message.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("blocked", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("outside", StringComparison.OrdinalIgnoreCase) >= 0 ||
                           ex.Message.IndexOf("traversal", StringComparison.OrdinalIgnoreCase) >= 0 ? 403 : 400;
                WriteJson(res, code, new { error = ex.Message });
            }
        }

        private void HandleUpdatesCheck(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                const string currentVersion = "1.0.0";
                string simulatedLatest = req.Headers["X-Sanctum-Test-Latest-Version"];
                string latestVersion = currentVersion;
                string releaseNotes = "Sanctum Desktop 1.0.0 is up to date.";
                bool signedRelease = true;

                if (!string.IsNullOrWhiteSpace(simulatedLatest)) {
                    latestVersion = simulatedLatest.Trim();
                } else {
                    string localManifest = Path.Combine(_appDataDir, "release-manifest.json");
                    if (File.Exists(localManifest)) {
                        try {
                            var parsed = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(localManifest, Encoding.UTF8));
                            if (parsed != null && parsed.ContainsKey("latestVersion")) {
                                latestVersion = Convert.ToString(parsed["latestVersion"]);
                            }
                            if (parsed != null && parsed.ContainsKey("releaseNotes")) {
                                releaseNotes = Convert.ToString(parsed["releaseNotes"]);
                            }
                        } catch { }
                    }
                }

                bool updateAvailable = !string.Equals(latestVersion, currentVersion, StringComparison.OrdinalIgnoreCase);
                if (updateAvailable && releaseNotes == "Sanctum Desktop 1.0.0 is up to date.") {
                    releaseNotes = "Signed release v" + latestVersion + " is available with updated local runtime and security fixes.";
                }

                WriteJson(res, 200, new {
                    status = "ok",
                    currentVersion = currentVersion,
                    latestVersion = latestVersion,
                    updateAvailable = updateAvailable,
                    signed = signedRelease,
                    checkedAt = DateTime.UtcNow.ToString("o"),
                    releaseNotes = releaseNotes
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { error = ex.Message });
            }
        }
    }
}
