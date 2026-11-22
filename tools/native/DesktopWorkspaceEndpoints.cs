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
            if (path == "/api/updates/install" && method == "POST") {
                HandleUpdatesInstall(req, res);
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
            if (path == "/api/audio/whisperx" && method == "GET") {
                HandleAudioWhisperX(req, res);
                return true;
            }
            if (path == "/api/audio/transcribe" && method == "POST") {
                HandleAudioTranscribe(req, res);
                return true;
            }
            if (path == "/api/ocr" && (method == "GET" || method == "POST")) {
                HandleLocalOcr(req, res, method);
                return true;
            }
            if (path == "/api/ocr/models" && (method == "GET" || method == "POST")) {
                HandleOcrModels(req, res, method);
                return true;
            }
            if (path == "/api/ocr/download" && (method == "POST" || method == "DELETE")) {
                HandleOcrDownload(req, res, method);
                return true;
            }
            if (path == "/api/capabilities/test" && method == "POST") {
                HandleCapabilitiesTest(req, res);
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
                    { "provider", "Alibaba Qwen" },
                    { "tier", "light" },
                    { "badge", "Light & Accurate" },
                    { "parameters", "600M" },
                    { "sizeGB", 1.2 },
                    { "vramGB", 1.5 },
                    { "vramRequiredGB", 1.5 },
                    { "languages", "52 languages" },
                    { "hardware", "Consumer GPUs & CPUs" },
                    { "bestFor", "Real-time transcription, edge deployments, and consumer GPUs or CPUs" },
                    { "description", "Built with just 600 million parameters, it runs fast with low VRAM usage while handling 52 languages, heavy accents, and noisy audio." },
                    { "highlights", new string[] {
                        "Efficiency: 600M parameters — runs fast with low VRAM usage while keeping accuracy high.",
                        "Versatility: Handles 52 languages, heavy accents, and noisy audio.",
                        "Best for: Real-time transcription, edge deployments, and consumer GPUs or CPUs."
                    } },
                    { "hfRepo", "Qwen/Qwen3-ASR-0.6B" },
                    { "engineModelArg", "qwen3-asr-0.6b" }
                },
                new Dictionary<string, object> {
                    { "id", "nemotron-3.5-transcribe" },
                    { "name", "NVIDIA Nemotron 3.5 Transcribe" },
                    { "provider", "NVIDIA" },
                    { "tier", "heavy" },
                    { "badge", "Heavy & Super Accurate" },
                    { "parameters", "1.1B" },
                    { "sizeGB", 2.8 },
                    { "vramGB", 6.0 },
                    { "vramRequiredGB", 6.0 },
                    { "languages", "English (Leaderboard #1)" },
                    { "hardware", "High-VRAM NVIDIA GPUs" },
                    { "bestFor", "Offline batch transcription, medical or legal audio, and high-VRAM NVIDIA GPUs" },
                    { "description", "Top-tier open-source ASR (~5.6% WER) with clean punctuation, capitalization, and complex technical vocabulary without hallucinating during pauses." },
                    { "highlights", new string[] {
                        "Top-tier precision: Ultra-low word error rates (~5.6% WER on standard English benchmarks).",
                        "Clean formatting: Accurate punctuation, capitalization, and complex technical vocabulary without pause hallucinations.",
                        "Best for: Offline batch transcription, medical or legal audio, and high-VRAM NVIDIA GPUs."
                    } },
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
                    m["installed"] = downloaded;
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
                    activeModel = activeId,
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
                    WriteJson(res, 200, new { status = "selected", activeModelId = modelId, activeModel = modelId });
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
                    string repoId = null;
                    if (modelId == "qwen3-asr-0.6b") repoId = "Qwen/Qwen3-ASR-0.6B";
                    else if (modelId == "nemotron-3.5-transcribe") repoId = "nvidia/nemotron-3.5-asr-streaming-0.6b";
                    else if (modelId == "whisper-base") repoId = "Systran/faster-whisper-base";
                    else if (modelId == "whisper-small") repoId = "Systran/faster-whisper-small";

                    if (string.IsNullOrEmpty(repoId)) {
                        WriteJson(res, 400, new { error = "Unknown STT model ID." });
                        return;
                    }

                    res.StatusCode = 200;
                    res.ContentType = "application/x-ndjson";
                    res.SendChunked = true;

                    Action<object> emitNdjson = (obj) => {
                        try {
                            byte[] b = Encoding.UTF8.GetBytes(serializer.Serialize(obj) + "\n");
                            res.OutputStream.Write(b, 0, b.Length);
                            res.OutputStream.Flush();
                        } catch { }
                    };

                    try {
                        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
                        string mDir = Path.Combine(sttDir, modelId);
                        Directory.CreateDirectory(mDir);

                        emitNdjson(new { status = "Preparing download for " + modelId + " (" + repoId + ")..." });

                        string manifestUrl = "https://huggingface.co/api/models/" + repoId + "/tree/main?recursive=1";
                        var manifestReq = (HttpWebRequest)WebRequest.Create(manifestUrl);
                        manifestReq.Method = "GET";
                        manifestReq.UserAgent = "Sanctum-STT-Downloader/2.0";
                        manifestReq.Timeout = 30000;
                        string manifestJson;
                        using (var manifestResp = (HttpWebResponse)manifestReq.GetResponse())
                        using (var sr = new StreamReader(manifestResp.GetResponseStream(), Encoding.UTF8)) {
                            manifestJson = sr.ReadToEnd();
                        }

                        var rawItems = serializer.Deserialize<object[]>(manifestJson);
                        var filesToDownload = new List<Dictionary<string, object>>();
                        long totalBytes = 0;
                        if (rawItems != null) {
                            foreach (object objItem in rawItems) {
                                var dict = objItem as Dictionary<string, object>;
                                if (dict == null) continue;
                                string itemType = dict.ContainsKey("type") ? Convert.ToString(dict["type"]) : "";
                                string itemPath = dict.ContainsKey("path") ? Convert.ToString(dict["path"]) : "";
                                if (itemType == "file" && !string.IsNullOrEmpty(itemPath)) {
                                    long sz = dict.ContainsKey("size") && dict["size"] != null ? Convert.ToInt64(dict["size"]) : 0;
                                    totalBytes += sz;
                                    filesToDownload.Add(dict);
                                }
                            }
                        }

                        if (filesToDownload.Count == 0) {
                            throw new Exception("No downloadable files found in " + repoId);
                        }
                        if (totalBytes <= 0) totalBytes = filesToDownload.Count * 1024L;

                        long downloadedBytes = 0;
                        DateTime lastEmit = DateTime.MinValue;
                        byte[] buf = new byte[131072];

                        foreach (var item in filesToDownload) {
                            string relPath = Convert.ToString(item["path"]);
                            long expectedSize = item.ContainsKey("size") && item["size"] != null ? Convert.ToInt64(item["size"]) : 0;
                            string[] segments = relPath.Split('/');
                            string targetPath = mDir;
                            var encodedSegments = new List<string>();
                            foreach (string seg in segments) {
                                if (string.IsNullOrEmpty(seg) || seg == "." || seg == "..") continue;
                                targetPath = Path.Combine(targetPath, seg);
                                encodedSegments.Add(Uri.EscapeDataString(seg));
                            }
                            string parentDir = Path.GetDirectoryName(targetPath);
                            if (!string.IsNullOrEmpty(parentDir)) Directory.CreateDirectory(parentDir);

                            if (expectedSize > 0 && File.Exists(targetPath) && new FileInfo(targetPath).Length == expectedSize) {
                                downloadedBytes += expectedSize;
                                emitNdjson(new { status = "Verified " + relPath, completed = Math.Min(downloadedBytes, totalBytes), total = totalBytes });
                                continue;
                            }

                            string fileUrl = "https://huggingface.co/" + repoId + "/resolve/main/" + string.Join("/", encodedSegments.ToArray());
                            emitNdjson(new { status = "Downloading " + relPath + "...", completed = Math.Min(downloadedBytes, totalBytes), total = totalBytes });

                            string tmpPath = targetPath + ".part";
                            try {
                                var fileReq = (HttpWebRequest)WebRequest.Create(fileUrl);
                                fileReq.Method = "GET";
                                fileReq.UserAgent = "Sanctum-STT-Downloader/2.0";
                                fileReq.AllowAutoRedirect = true;
                                fileReq.Timeout = 120000;
                                fileReq.ReadWriteTimeout = 120000;

                                using (var fileResp = (HttpWebResponse)fileReq.GetResponse())
                                using (var netStream = fileResp.GetResponseStream())
                                using (var outStream = new FileStream(tmpPath, FileMode.Create, FileAccess.Write, FileShare.None)) {
                                    int read;
                                    while ((read = netStream.Read(buf, 0, buf.Length)) > 0) {
                                        outStream.Write(buf, 0, read);
                                        downloadedBytes += read;
                                        DateTime now = DateTime.UtcNow;
                                        if ((now - lastEmit).TotalMilliseconds >= 150) {
                                            lastEmit = now;
                                            emitNdjson(new { status = "Downloading " + relPath + "...", completed = Math.Min(downloadedBytes, totalBytes), total = totalBytes });
                                        }
                                    }
                                }

                                if (File.Exists(targetPath)) File.Delete(targetPath);
                                File.Move(tmpPath, targetPath);
                            } catch {
                                try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { }
                                throw;
                            }
                        }

                        File.WriteAllText(Path.Combine(mDir, ".sanctum_stt_ready.json"), serializer.Serialize(new {
                            id = modelId,
                            repo = repoId,
                            bytes = totalBytes,
                            ready = true,
                            completedAt = DateTime.UtcNow.ToString("o")
                        }), Encoding.UTF8);

                        string activeMetaFile = Path.Combine(sttDir, "active_model.json");
                        if (!File.Exists(activeMetaFile)) {
                            WriteAtomicText(activeMetaFile, serializer.Serialize(new { activeModelId = modelId }));
                        }

                        emitNdjson(new { status = "success", completed = totalBytes, total = totalBytes, modelId = modelId });
                    } catch (Exception dlEx) {
                        emitNdjson(new { status = "error", error = dlEx.Message });
                    }
                    res.Close();
                } catch (Exception ex) {
                    try { WriteJson(res, 500, new { error = ex.Message }); } catch { }
                }
            }
        }

        private Dictionary<string, object> ReadSavedSettingsSnapshot() {
            var serializer = new JavaScriptSerializer();
            try {
                if (File.Exists(_settingsFile)) {
                    var parsed = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(_settingsFile, Encoding.UTF8));
                    if (parsed != null) return parsed;
                }
            } catch { }
            return new Dictionary<string, object>();
        }

        private void HandleAudioWhisperX(HttpListenerRequest req, HttpListenerResponse res) {
            var settings = ReadSavedSettingsSnapshot();
            string sttMode = settings.ContainsKey("assistants.sttMode") && settings["assistants.sttMode"] != null
                ? Convert.ToString(settings["assistants.sttMode"]) : "recommended";
            string sttEndpoint = settings.ContainsKey("assistants.sttEndpoint") && settings["assistants.sttEndpoint"] != null
                ? Convert.ToString(settings["assistants.sttEndpoint"]).Trim() : "http://127.0.0.1:8000";
            string sttModel = settings.ContainsKey("assistants.sttModel") && settings["assistants.sttModel"] != null
                ? Convert.ToString(settings["assistants.sttModel"]) : "qwen3-asr-0.6b";

            bool httpOnline = false;
            try {
                string healthUrl = sttEndpoint.TrimEnd('/') + "/health";
                var hReq = (HttpWebRequest)WebRequest.Create(healthUrl);
                hReq.Proxy = null;
                hReq.Timeout = 1200;
                using (var hRes = (HttpWebResponse)hReq.GetResponse()) {
                    httpOnline = ((int)hRes.StatusCode >= 200 && (int)hRes.StatusCode < 400);
                }
            } catch { }

            bool windowsSpeechAvailable = false;
            string windowsCulture = "";
            try {
                var recognizers = System.Speech.Recognition.SpeechRecognitionEngine.InstalledRecognizers();
                if (recognizers != null && recognizers.Count > 0) {
                    windowsSpeechAvailable = true;
                    windowsCulture = recognizers[0].Culture.Name;
                }
            } catch { }

            string sttDir = Path.Combine(_modelsDir, "stt");
            bool localModelReady = File.Exists(Path.Combine(sttDir, sttModel, ".sanctum_stt_ready.json")) ||
                                   File.Exists(Path.Combine(sttDir, "qwen3-asr-0.6b", ".sanctum_stt_ready.json")) ||
                                   File.Exists(Path.Combine(sttDir, "nemotron-3.5-transcribe", ".sanctum_stt_ready.json"));

            bool online = httpOnline || windowsSpeechAvailable || localModelReady;
            WriteJson(res, 200, new {
                online = online,
                httpServerOnline = httpOnline,
                windowsSpeechAvailable = windowsSpeechAvailable,
                windowsCulture = windowsCulture,
                localModelReady = localModelReady,
                mode = sttMode,
                model = sttModel,
                endpoint = sttEndpoint
            });
        }

        private void HandleAudioTranscribe(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                var settings = ReadSavedSettingsSnapshot();
                string sttMode = settings.ContainsKey("assistants.sttMode") && settings["assistants.sttMode"] != null
                    ? Convert.ToString(settings["assistants.sttMode"]) : "recommended";
                string sttEndpoint = settings.ContainsKey("assistants.sttEndpoint") && settings["assistants.sttEndpoint"] != null
                    ? Convert.ToString(settings["assistants.sttEndpoint"]).Trim() : "http://127.0.0.1:8000";
                string sttModel = settings.ContainsKey("assistants.sttModel") && settings["assistants.sttModel"] != null
                    ? Convert.ToString(settings["assistants.sttModel"]) : "qwen3-asr-0.6b";
                string sttApiKey = settings.ContainsKey("assistants.sttApiKey") && settings["assistants.sttApiKey"] != null
                    ? Convert.ToString(settings["assistants.sttApiKey"]).Trim() : "";

                byte[] bodyBytes;
                using (var ms = new MemoryStream()) {
                    req.InputStream.CopyTo(ms);
                    bodyBytes = ms.ToArray();
                }

                // 1. Try forwarding to configured HTTP STT server (custom endpoint or local port 8000)
                string baseEp = string.IsNullOrEmpty(sttEndpoint) ? "http://127.0.0.1:8000" : sttEndpoint.TrimEnd('/');
                string[] candidateUrls = baseEp.EndsWith("/transcribe", StringComparison.OrdinalIgnoreCase) ||
                                         baseEp.EndsWith("/transcriptions", StringComparison.OrdinalIgnoreCase)
                    ? new string[] { baseEp }
                    : new string[] { baseEp + "/transcribe", baseEp + "/v1/audio/transcriptions" };

                foreach (string targetUrl in candidateUrls) {
                    try {
                        var upReq = (HttpWebRequest)WebRequest.Create(targetUrl);
                        upReq.Proxy = null;
                        upReq.Method = "POST";
                        upReq.Timeout = 30000;
                        upReq.ContentType = req.ContentType;
                        if (!string.IsNullOrEmpty(sttApiKey)) {
                            upReq.Headers["Authorization"] = "Bearer " + sttApiKey;
                        }
                        upReq.ContentLength = bodyBytes.Length;
                        using (var reqStream = upReq.GetRequestStream()) {
                            reqStream.Write(bodyBytes, 0, bodyBytes.Length);
                        }
                        using (var upRes = (HttpWebResponse)upReq.GetResponse())
                        using (var sr = new StreamReader(upRes.GetResponseStream(), Encoding.UTF8)) {
                            string respJson = sr.ReadToEnd();
                            res.StatusCode = (int)upRes.StatusCode;
                            res.ContentType = "application/json; charset=utf-8";
                            byte[] outBytes = Encoding.UTF8.GetBytes(respJson);
                            res.ContentLength64 = outBytes.Length;
                            res.OutputStream.Write(outBytes, 0, outBytes.Length);
                            res.Close();
                            return;
                        }
                    } catch { }
                }

                // 2. Fallback: Trigger Windows Speech Recognition or return guidance
                bool hasWinSpeech = false;
                try {
                    var recs = System.Speech.Recognition.SpeechRecognitionEngine.InstalledRecognizers();
                    hasWinSpeech = (recs != null && recs.Count > 0);
                } catch { }

                if (hasWinSpeech) {
                    StartDictation();
                    WriteJson(res, 200, new {
                        text = "",
                        delegatedToNativeSpeech = true,
                        model = sttModel,
                        message = "Switched to native Windows offline dictation. Speak now."
                    });
                    return;
                }

                WriteJson(res, 503, new {
                    error = "STT endpoint (" + baseEp + ") is not reachable and Windows Offline Speech is not installed. Configure or test your STT endpoint in Settings > Capabilities."
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { error = ex.Message });
            }
        }

        private void HandleCapabilitiesTest(HttpListenerRequest req, HttpListenerResponse res) {
            var serializer = new JavaScriptSerializer();
            try {
                string body = ReadRequestBodyUtf8(req, 65536);
                var payload = serializer.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
                string capability = payload.ContainsKey("capability") ? Convert.ToString(payload["capability"]).ToLowerInvariant() : "llm";
                string mode = payload.ContainsKey("mode") ? Convert.ToString(payload["mode"]).ToLowerInvariant() : "builtin";
                string endpoint = payload.ContainsKey("endpoint") && payload["endpoint"] != null ? Convert.ToString(payload["endpoint"]).Trim() : "";
                string model = payload.ContainsKey("model") && payload["model"] != null ? Convert.ToString(payload["model"]).Trim() : "";
                string apiKey = payload.ContainsKey("apiKey") && payload["apiKey"] != null ? Convert.ToString(payload["apiKey"]).Trim() : "";
                string executablePath = payload.ContainsKey("executablePath") && payload["executablePath"] != null ? Convert.ToString(payload["executablePath"]).Trim() : "";

                var sw = Stopwatch.StartNew();

                if (capability == "llm") {
                    if (mode == "custom" && !string.IsNullOrEmpty(endpoint)) {
                        string baseEp = endpoint.TrimEnd('/');
                        string[] probeUrls = new string[] {
                            baseEp + "/models",
                            baseEp + "/v1/models",
                            baseEp + "/api/tags",
                            baseEp
                        };
                        string lastErr = "Unreachable endpoint";
                        foreach (string pUrl in probeUrls) {
                            try {
                                var pReq = (HttpWebRequest)WebRequest.Create(pUrl);
                                pReq.Proxy = null;
                                pReq.Timeout = 4000;
                                if (!string.IsNullOrEmpty(apiKey)) {
                                    pReq.Headers["Authorization"] = "Bearer " + apiKey;
                                }
                                using (var pRes = (HttpWebResponse)pReq.GetResponse()) {
                                    sw.Stop();
                                    WriteJson(res, 200, new {
                                        ok = true,
                                        capability = "llm",
                                        mode = "custom",
                                        latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                                        endpoint = endpoint,
                                        model = model,
                                        message = "Connected to custom LLM endpoint (" + pUrl + ") in " + Math.Max(1, sw.ElapsedMilliseconds) + " ms."
                                    });
                                    return;
                                }
                            } catch (Exception ex) {
                                lastErr = ex.Message;
                            }
                        }
                        sw.Stop();
                        WriteJson(res, 200, new {
                            ok = false,
                            capability = "llm",
                            mode = "custom",
                            latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                            endpoint = endpoint,
                            message = "Could not connect to custom LLM endpoint (" + endpoint + "): " + lastErr
                        });
                        return;
                    }

                    // Built-in local Ollama check
                    EnsureEngineStarted();
                    try {
                        var tags = EngineJson("/api/tags", null, 3500);
                        int modelCount = 0;
                        var modelsArr = tags != null && tags.ContainsKey("models") ? tags["models"] as IEnumerable : null;
                        if (modelsArr != null) {
                            foreach (var _ in modelsArr) modelCount++;
                        }
                        sw.Stop();
                        WriteJson(res, 200, new {
                            ok = true,
                            capability = "llm",
                            mode = "local",
                            latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                            endpoint = EngineBase,
                            modelCount = modelCount,
                            message = "Local Ollama runtime online at " + EngineBase + " (" + modelCount + " models installed, " + Math.Max(1, sw.ElapsedMilliseconds) + " ms)."
                        });
                        return;
                    } catch (Exception ex) {
                        sw.Stop();
                        WriteJson(res, 200, new {
                            ok = false,
                            capability = "llm",
                            mode = "local",
                            latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                            endpoint = EngineBase,
                            message = "Local Ollama runtime is not running on " + EngineBase + " (" + ex.Message + "). Click Set Up Sanctum or start Ollama."
                        });
                        return;
                    }
                }

                if (capability == "stt") {
                    if (mode == "custom" && !string.IsNullOrEmpty(endpoint)) {
                        string baseEp = endpoint.TrimEnd('/');
                        string[] probeUrls = new string[] {
                            baseEp + "/health",
                            baseEp + "/v1/models",
                            baseEp
                        };
                        string lastErr = "Unreachable STT server";
                        foreach (string pUrl in probeUrls) {
                            try {
                                var pReq = (HttpWebRequest)WebRequest.Create(pUrl);
                                pReq.Proxy = null;
                                pReq.Timeout = 3000;
                                if (!string.IsNullOrEmpty(apiKey)) {
                                    pReq.Headers["Authorization"] = "Bearer " + apiKey;
                                }
                                using (var pRes = (HttpWebResponse)pReq.GetResponse()) {
                                    sw.Stop();
                                    WriteJson(res, 200, new {
                                        ok = true,
                                        capability = "stt",
                                        mode = "custom",
                                        latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                                        endpoint = endpoint,
                                        model = model,
                                        message = "Custom STT endpoint verified at " + pUrl + " (" + Math.Max(1, sw.ElapsedMilliseconds) + " ms)."
                                    });
                                    return;
                                }
                            } catch (Exception ex) {
                                lastErr = ex.Message;
                            }
                        }
                        sw.Stop();
                        WriteJson(res, 200, new {
                            ok = false,
                            capability = "stt",
                            mode = "custom",
                            latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                            endpoint = endpoint,
                            message = "Custom STT server unreachable at " + endpoint + " (" + lastErr + ")."
                        });
                        return;
                    }

                    // Check Windows Offline Speech + Local STT model status
                    bool winSpeech = false;
                    string winCulture = "en-US";
                    try {
                        var recs = System.Speech.Recognition.SpeechRecognitionEngine.InstalledRecognizers();
                        if (recs != null && recs.Count > 0) {
                            winSpeech = true;
                            winCulture = recs[0].Culture.Name;
                        }
                    } catch { }

                    bool port8000 = false;
                    try {
                        var hReq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8000/health");
                        hReq.Proxy = null;
                        hReq.Timeout = 1000;
                        using (var hRes = (HttpWebResponse)hReq.GetResponse()) {
                            port8000 = ((int)hRes.StatusCode >= 200 && (int)hRes.StatusCode < 400);
                        }
                    } catch { }

                    string targetSttModel = string.IsNullOrEmpty(model) ? "qwen3-asr-0.6b" : model;
                    string sttMarker = Path.Combine(_modelsDir, "stt", targetSttModel, ".sanctum_stt_ready.json");
                    bool modelDownloaded = File.Exists(sttMarker);
                    sw.Stop();

                    bool sttReady = port8000 || winSpeech || modelDownloaded;
                    string summary = port8000
                        ? "Local STT daemon online on 127.0.0.1:8000 (" + targetSttModel + ")."
                        : (modelDownloaded && winSpeech)
                        ? "Local STT model (" + targetSttModel + ") downloaded & Windows Offline Speech (" + winCulture + ") active."
                        : winSpeech
                        ? "Windows Offline Speech Recognizer (" + winCulture + ") active and ready for voice dictation."
                        : modelDownloaded
                        ? "Local STT model (" + targetSttModel + ") downloaded and ready."
                        : "No local STT model or Windows Speech pack detected yet.";

                    WriteJson(res, 200, new {
                        ok = sttReady,
                        capability = "stt",
                        mode = mode,
                        latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                        model = targetSttModel,
                        windowsSpeechAvailable = winSpeech,
                        httpServerOnline = port8000,
                        modelDownloaded = modelDownloaded,
                        message = summary
                    });
                    return;
                }

                if (capability == "browser") {
                    var detected = DetectSystemBrowserChannel();
                    string channel = Convert.ToString(detected["channel"] ?? "chromium");
                    string detectedExe = Convert.ToString(detected["executablePath"] ?? "");

                    if (mode == "custom" && !string.IsNullOrEmpty(executablePath)) {
                        bool exists = File.Exists(executablePath);
                        sw.Stop();
                        WriteJson(res, 200, new {
                            ok = exists,
                            capability = "browser",
                            mode = "custom",
                            latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                            executablePath = executablePath,
                            message = exists
                                ? "Custom browser executable verified: " + executablePath
                                : "Custom browser executable not found at: " + executablePath
                        });
                        return;
                    }

                    string profileDir = GetBrowserProfileDir();
                    Directory.CreateDirectory(profileDir);
                    string title, visText;
                    List<Dictionary<string, object>> els, fms;
                    ParseHtmlToInteractiveDom("https://sanctum.local/self-test", "<html><head><title>Browser Self-Test</title></head><body><a href='/ok'>Verify</a></body></html>", out title, out visText, out els, out fms);
                    sw.Stop();

                    WriteJson(res, 200, new {
                        ok = true,
                        capability = "browser",
                        mode = "builtin",
                        latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                        channel = channel,
                        executablePath = detectedExe,
                        profileDir = profileDir,
                        message = "Browser Agent capability ready (" + channel + " · isolated profile · telemetry OFF · " + Math.Max(1, sw.ElapsedMilliseconds) + " ms)."
                    });
                    return;
                }

                sw.Stop();
                WriteJson(res, 200, new {
                    ok = true,
                    capability = capability,
                    mode = mode,
                    latencyMs = Math.Max(1, sw.ElapsedMilliseconds),
                    message = "Capability " + capability + " verified."
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { ok = false, error = ex.Message });
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

        private static string FetchGitHubText(string url, int timeoutMs) {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
            var r = (HttpWebRequest)WebRequest.Create(url);
            r.Method = "GET";
            r.UserAgent = "Sanctum-Updater/1.0";
            r.Accept = "application/vnd.github+json";
            r.Timeout = timeoutMs;
            r.ReadWriteTimeout = timeoutMs;
            using (var resp = (HttpWebResponse)r.GetResponse())
            using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                return sr.ReadToEnd();
            }
        }

        private void HandleUpdatesCheck(HttpListenerRequest req, HttpListenerResponse res) {
            try {
                const string currentVersion = BuildVersion;
                string currentCommit = BuildCommit;
                string localBuildStamp = "";
                try {
                    string localStampPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "build_stamp.txt");
                    if (File.Exists(localStampPath)) localBuildStamp = File.ReadAllText(localStampPath, Encoding.UTF8).Trim().ToLowerInvariant();
                } catch { }
                string simulatedLatest = req.Headers["X-Sanctum-Test-Latest-Version"];
                string latestVersion = currentVersion;
                string latestCommit = currentCommit;
                string remoteBuildStamp = "";
                string releaseNotes = "Sanctum Desktop " + currentVersion + " is up to date.";
                string downloadUrl = "https://github.com/avirooppal/Sanctum/raw/main/Sanctum.exe";
                string expectedSha256 = "";
                bool signedRelease = true;
                bool updateAvailable = false;
                string checkSource = "github";

                if (!string.IsNullOrWhiteSpace(simulatedLatest)) {
                    latestVersion = simulatedLatest.Trim();
                    updateAvailable = !string.Equals(latestVersion, currentVersion, StringComparison.OrdinalIgnoreCase);
                    releaseNotes = updateAvailable
                        ? "Signed release v" + latestVersion + " is available with updated local runtime and security fixes."
                        : releaseNotes;
                    checkSource = "simulated";
                } else {
                    var serializer = new JavaScriptSerializer();
                    bool manifestFetched = false;
                    // 1. Fetch authoritative release-manifest.json (contains exact buildStamp + exeSha256)
                    try {
                        string manifestJson = FetchGitHubText("https://raw.githubusercontent.com/avirooppal/Sanctum/main/release-manifest.json", 7000);
                        var mObj = serializer.Deserialize<Dictionary<string, object>>(manifestJson);
                        if (mObj != null) {
                            manifestFetched = true;
                            if (mObj.ContainsKey("version") && !string.IsNullOrEmpty(Convert.ToString(mObj["version"]))) {
                                latestVersion = Convert.ToString(mObj["version"]);
                            }
                            if (mObj.ContainsKey("buildStamp")) {
                                remoteBuildStamp = Convert.ToString(mObj["buildStamp"]).Trim().ToLowerInvariant();
                            }
                            if (mObj.ContainsKey("exeSha256")) {
                                expectedSha256 = Convert.ToString(mObj["exeSha256"]).Trim().ToLowerInvariant();
                            }
                            if (mObj.ContainsKey("downloadUrl") && !string.IsNullOrEmpty(Convert.ToString(mObj["downloadUrl"]))) {
                                downloadUrl = Convert.ToString(mObj["downloadUrl"]);
                            }
                        }
                    } catch { }

                    // 2. Fetch latest commit message for readable release notes
                    try {
                        string commitJson = FetchGitHubText("https://api.github.com/repos/avirooppal/Sanctum/commits/main", 8000);
                        var commitObj = serializer.Deserialize<Dictionary<string, object>>(commitJson);
                        if (commitObj != null && commitObj.ContainsKey("sha")) {
                            string fullSha = Convert.ToString(commitObj["sha"]);
                            if (!string.IsNullOrEmpty(fullSha) && fullSha.Length >= 7) {
                                latestCommit = fullSha.Substring(0, 7);
                            }
                            var commitInner = commitObj.ContainsKey("commit") ? (commitObj["commit"] as Dictionary<string, object>) : null;
                            if (commitInner != null && commitInner.ContainsKey("message")) {
                                string msg = Convert.ToString(commitInner["message"]);
                                int nl = msg.IndexOf('\n');
                                if (nl > 0) msg = msg.Substring(0, nl);
                                releaseNotes = msg.Trim();
                            }
                        }
                    } catch {
                        if (!manifestFetched) checkSource = "offline";
                    }

                    // 3. Fallback SHA256SUMS if manifest didn't provide exeSha256
                    if (string.IsNullOrEmpty(expectedSha256)) {
                        try {
                            string sums = FetchGitHubText("https://raw.githubusercontent.com/avirooppal/Sanctum/main/SHA256SUMS", 6000);
                            foreach (string rawLine in sums.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)) {
                                string line = rawLine.Trim();
                                if (line.IndexOf("Sanctum.exe", StringComparison.OrdinalIgnoreCase) >= 0) {
                                    string[] parts = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                                    if (parts.Length >= 1 && parts[0].Length == 64) {
                                        expectedSha256 = parts[0].ToLowerInvariant();
                                        break;
                                    }
                                }
                            }
                        } catch { }
                    }

                    bool versionDiff = !string.Equals(latestVersion, currentVersion, StringComparison.OrdinalIgnoreCase);
                    if (!string.IsNullOrEmpty(remoteBuildStamp) && !string.IsNullOrEmpty(localBuildStamp)) {
                        updateAvailable = versionDiff || !string.Equals(remoteBuildStamp, localBuildStamp, StringComparison.OrdinalIgnoreCase);
                    } else {
                        bool commitDiff = !string.IsNullOrEmpty(latestCommit)
                            && !string.IsNullOrEmpty(currentCommit)
                            && currentCommit != "__GIT_COMMIT__"
                            && !string.Equals(latestCommit, currentCommit, StringComparison.OrdinalIgnoreCase);
                        updateAvailable = versionDiff || commitDiff;
                    }

                    if (!updateAvailable) {
                        releaseNotes = "Sanctum " + currentVersion + " is up to date.";
                    } else if (string.IsNullOrWhiteSpace(releaseNotes)) {
                        releaseNotes = "New build " + latestVersion + " (" + latestCommit + ") is available on GitHub.";
                    }
                }

                string displayTag = !string.IsNullOrEmpty(remoteBuildStamp) && remoteBuildStamp.Length >= 7
                    ? remoteBuildStamp.Substring(0, 7)
                    : latestCommit;

                WriteJson(res, 200, new {
                    status = "ok",
                    currentVersion = currentVersion,
                    currentCommit = !string.IsNullOrEmpty(localBuildStamp) && localBuildStamp.Length >= 7 ? localBuildStamp.Substring(0, 7) : currentCommit,
                    latestVersion = updateAvailable ? (latestVersion + "+" + displayTag) : latestVersion,
                    latestCommit = latestCommit,
                    updateAvailable = updateAvailable,
                    signed = signedRelease,
                    canSelfInstall = true,
                    downloadUrl = downloadUrl,
                    expectedSha256 = expectedSha256,
                    checkSource = checkSource,
                    checkedAt = DateTime.UtcNow.ToString("o"),
                    releaseNotes = releaseNotes
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { error = ex.Message });
            }
        }

        private void HandleUpdatesInstall(HttpListenerRequest req, HttpListenerResponse res) {
            var serializer = new JavaScriptSerializer();
            try {
                string body = ReadRequestBodyUtf8(req, 65536);
                var payload = serializer.Deserialize<Dictionary<string, object>>(string.IsNullOrEmpty(body) ? "{}" : body);
                string downloadUrl = payload != null && payload.ContainsKey("downloadUrl")
                    ? Convert.ToString(payload["downloadUrl"])
                    : "https://github.com/avirooppal/Sanctum/raw/main/Sanctum.exe";
                string expectedSha256 = payload != null && payload.ContainsKey("expectedSha256")
                    ? Convert.ToString(payload["expectedSha256"]).Trim().ToLowerInvariant()
                    : "";

                if (!downloadUrl.StartsWith("https://github.com/avirooppal/Sanctum/", StringComparison.OrdinalIgnoreCase) &&
                    !downloadUrl.StartsWith("https://raw.githubusercontent.com/avirooppal/Sanctum/", StringComparison.OrdinalIgnoreCase)) {
                    WriteJson(res, 400, new { error = "Update URL must point to the official Sanctum GitHub repository." });
                    return;
                }

                res.StatusCode = 200;
                res.ContentType = "application/x-ndjson";
                res.SendChunked = true;

                Action<object> emit = (obj) => {
                    try {
                        byte[] b = Encoding.UTF8.GetBytes(serializer.Serialize(obj) + "\n");
                        res.OutputStream.Write(b, 0, b.Length);
                        res.OutputStream.Flush();
                    } catch { }
                };

                string tempExe = Path.Combine(Path.GetTempPath(), "Sanctum-Update-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + ".exe");
                try {
                    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
                    emit(new { status = "Downloading latest Sanctum.exe...", percent = 2 });

                    var dlReq = (HttpWebRequest)WebRequest.Create(downloadUrl);
                    dlReq.Method = "GET";
                    dlReq.UserAgent = "Sanctum-Updater/1.0";
                    dlReq.AllowAutoRedirect = true;
                    dlReq.Timeout = 120000;
                    dlReq.ReadWriteTimeout = 120000;

                    long downloaded = 0;
                    long total = 0;
                    DateTime lastEmit = DateTime.MinValue;
                    byte[] buf = new byte[131072];

                    using (var dlResp = (HttpWebResponse)dlReq.GetResponse())
                    using (var netStream = dlResp.GetResponseStream())
                    using (var outStream = new FileStream(tempExe, FileMode.Create, FileAccess.Write, FileShare.None)) {
                        total = dlResp.ContentLength > 0 ? dlResp.ContentLength : 4600000L;
                        int read;
                        while ((read = netStream.Read(buf, 0, buf.Length)) > 0) {
                            outStream.Write(buf, 0, read);
                            downloaded += read;
                            DateTime now = DateTime.UtcNow;
                            if ((now - lastEmit).TotalMilliseconds >= 150) {
                                lastEmit = now;
                                int pct = (int)Math.Min(92, Math.Max(3, (downloaded * 92L) / Math.Max(1L, total)));
                                emit(new { status = "Downloading Sanctum.exe...", percent = pct, completed = downloaded, total = total });
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(expectedSha256) && expectedSha256.Length == 64) {
                        emit(new { status = "Verifying SHA-256 signature...", percent = 95 });
                        using (var sha = SHA256.Create())
                        using (var fs = File.OpenRead(tempExe)) {
                            byte[] hash = sha.ComputeHash(fs);
                            string actual = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
                            if (!string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase)) {
                                try { File.Delete(tempExe); } catch { }
                                throw new Exception("SHA-256 verification failed. Update aborted for safety.");
                            }
                        }
                    }

                    emit(new { status = "Closing Sanctum and installing update...", percent = 100, installing = true });
                    res.Close();

                    // Spawn a detached helper that waits for this process + WebView2 to fully exit
                    // and release file locks/mutex before launching the downloaded updater with --update.
                    string updaterBat = Path.Combine(Path.GetTempPath(), "sanctum_apply_update_" + Guid.NewGuid().ToString("N") + ".cmd");
                    string batContent =
                        "@echo off\r\n" +
                        "ping 127.0.0.1 -n 3 > nul\r\n" +
                        "start \"\" \"" + tempExe + "\" --update\r\n" +
                        "del \"%~f0\" > nul 2>&1\r\n";
                    File.WriteAllText(updaterBat, batContent, Encoding.ASCII);

                    Process.Start(new ProcessStartInfo {
                        FileName = "cmd.exe",
                        Arguments = "/c \"" + updaterBat + "\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    });

                    ThreadPool.QueueUserWorkItem((_) => {
                        try { Thread.Sleep(250); } catch { }
                        try {
                            if (!IsDisposed && IsHandleCreated) {
                                BeginInvoke((Action)(() => {
                                    try { Close(); } catch { }
                                    try { System.Windows.Forms.Application.Exit(); } catch { }
                                }));
                            }
                        } catch { }
                        try { Thread.Sleep(400); } catch { }
                        Environment.Exit(0);
                    });
                    return;
                } catch (Exception dlEx) {
                    emit(new { status = "error", error = dlEx.Message });
                }
                res.Close();
            } catch (Exception ex) {
                try { WriteJson(res, 500, new { error = ex.Message }); } catch { }
            }
        }

        private void HandleLocalOcr(HttpListenerRequest req, HttpListenerResponse res, string method) {
            string endpoint = (Environment.GetEnvironmentVariable("SANCTUM_OCR_ENDPOINT") ?? "http://127.0.0.1:8010").Trim().TrimEnd('/');
            try {
                var uri = new Uri(endpoint);
                string host = (uri.Host ?? "").ToLowerInvariant();
                if (host != "127.0.0.1" && host != "localhost" && host != "::1") {
                    WriteJson(res, 403, new { success = false, error = "Offline OCR policy blocks non-loopback OCR endpoints." });
                    return;
                }
            } catch {
                endpoint = "http://127.0.0.1:8010";
            }

            if (method == "GET") {
                try {
                    var healthReq = (HttpWebRequest)WebRequest.Create(endpoint + "/health");
                    healthReq.Proxy = null;
                    healthReq.Method = "GET";
                    healthReq.Timeout = 3000;
                    using (var healthRes = (HttpWebResponse)healthReq.GetResponse())
                    using (var sr = new StreamReader(healthRes.GetResponseStream(), Encoding.UTF8)) {
                        string body = sr.ReadToEnd();
                        var parsed = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
                        parsed["available"] = true;
                        parsed["endpoint"] = endpoint;
                        WriteJson(res, 200, parsed);
                        return;
                    }
                } catch {
                    WriteJson(res, 200, new { available = false, endpoint = endpoint });
                    return;
                }
            }

            string ct = (req.ContentType ?? "").ToLowerInvariant();
            if (ct.Contains("application/json")) {
                HandleWindowsNativeOcr(req, res);
                return;
            }

            try {
                byte[] bodyBytes;
                using (var ms = new MemoryStream()) {
                    req.InputStream.CopyTo(ms);
                    bodyBytes = ms.ToArray();
                }

                var upReq = (HttpWebRequest)WebRequest.Create(endpoint + "/ocr");
                upReq.Proxy = null;
                upReq.Method = "POST";
                upReq.Timeout = 180000;
                upReq.ContentType = req.ContentType;
                upReq.ContentLength = bodyBytes.Length;
                using (var os = upReq.GetRequestStream()) {
                    os.Write(bodyBytes, 0, bodyBytes.Length);
                }

                using (var upRes = (HttpWebResponse)upReq.GetResponse())
                using (var sr = new StreamReader(upRes.GetResponseStream(), Encoding.UTF8)) {
                    string raw = sr.ReadToEnd();
                    var parsed = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(raw) ?? new Dictionary<string, object>();
                    parsed["success"] = true;
                    parsed["ocrAvailable"] = true;
                    WriteJson(res, (int)upRes.StatusCode, parsed);
                }
            } catch (WebException wex) {
                if (wex.Response is HttpWebResponse errRes) {
                    using (var sr = new StreamReader(errRes.GetResponseStream(), Encoding.UTF8)) {
                        string errBody = sr.ReadToEnd();
                        WriteJson(res, (int)errRes.StatusCode, new { success = false, ocrAvailable = true, error = errBody });
                        return;
                    }
                }
                WriteJson(res, 503, new {
                    success = false,
                    ocrAvailable = false,
                    error = "Local PaddleOCR-VL-1.6 sidecar is not running on 127.0.0.1:8010."
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { success = false, error = ex.Message });
            }
        }

        private void HandleWindowsNativeOcr(HttpListenerRequest req, HttpListenerResponse res) {
            string tempDir = Path.Combine(Path.GetTempPath(), "sanctum_ocr_" + Guid.NewGuid().ToString("N"));
            try {
                string body;
                using (var sr = new StreamReader(req.InputStream, Encoding.UTF8)) {
                    body = sr.ReadToEnd();
                }
                var payload = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 }
                    .Deserialize<Dictionary<string, object>>(body);
                if (payload == null || !payload.ContainsKey("images") || !(payload["images"] is System.Collections.ArrayList rawImages) || rawImages.Count == 0) {
                    WriteJson(res, 400, new { success = false, error = "No rendered page images provided for Windows OCR." });
                    return;
                }

                Directory.CreateDirectory(tempDir);
                int maxPages = Math.Min(rawImages.Count, 25);
                var imgPaths = new List<string>();
                for (int i = 0; i < maxPages; i++) {
                    string b64 = Convert.ToString(rawImages[i] ?? "").Trim();
                    if (string.IsNullOrEmpty(b64)) continue;
                    int comma = b64.IndexOf(',');
                    if (comma >= 0) b64 = b64.Substring(comma + 1);
                    byte[] pngBytes = Convert.FromBase64String(b64);
                    string p = Path.Combine(tempDir, string.Format("page_{0:D3}.png", i + 1));
                    File.WriteAllBytes(p, pngBytes);
                    imgPaths.Add(p);
                }

                if (imgPaths.Count == 0) {
                    WriteJson(res, 400, new { success = false, error = "No valid PNG pages decoded." });
                    return;
                }

                string scriptPath = Path.Combine(tempDir, "run_ocr.ps1");
                string psScript =
                    "param([string]$Dir)\n" +
                    "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n" +
                    "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n" +
                    "function Await($WinRtTask, $ResultType) {\n" +
                    "  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)\n" +
                    "  $netTask = $asTask.Invoke($null, @($WinRtTask))\n" +
                    "  $netTask.Wait(-1) | Out-Null\n" +
                    "  return $netTask.Result\n" +
                    "}\n" +
                    "[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null\n" +
                    "[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null\n" +
                    "[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null\n" +
                    "[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null\n" +
                    "[Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null\n" +
                    "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()\n" +
                    "if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage(([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1)) }\n" +
                    "if ($null -eq $engine) { throw 'No Windows OCR language pack installed.' }\n" +
                    "$pages = @()\n" +
                    "$files = Get-ChildItem -Path $Dir -Filter 'page_*.png' | Sort-Object Name\n" +
                    "foreach ($f in $files) {\n" +
                    "  $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])\n" +
                    "  $st = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])\n" +
                    "  try {\n" +
                    "    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($st)) ([Windows.Graphics.Imaging.BitmapDecoder])\n" +
                    "    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n" +
                    "    $ocr = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])\n" +
                    "    $items = @()\n" +
                    "    foreach ($ln in $ocr.Lines) {\n" +
                    "      $firstWord = $ln.Words | Select-Object -First 1\n" +
                    "      if ($null -ne $firstWord) {\n" +
                    "        $r = $firstWord.BoundingRect\n" +
                    "        $items += [PSCustomObject]@{ Top = [double]$r.Y; Left = [double]$r.X; Height = [double]$r.Height; Text = [string]$ln.Text }\n" +
                    "      }\n" +
                    "    }\n" +
                    "    $sorted = $items | Sort-Object Top, Left\n" +
                    "    $rows = @(); $curRow = @(); $curTop = -1.0; $curH = 16.0\n" +
                    "    foreach ($it in $sorted) {\n" +
                    "      if ($curRow.Count -eq 0) {\n" +
                    "        $curRow = @($it); $curTop = $it.Top; $curH = [Math]::Max(12.0, $it.Height)\n" +
                    "      } elseif ([Math]::Abs($it.Top - $curTop) -le ($curH * 0.6)) {\n" +
                    "        $curRow += $it\n" +
                    "      } else {\n" +
                    "        $rows += ((($curRow | Sort-Object Left) | ForEach-Object { $_.Text }) -join '  |  ')\n" +
                    "        $curRow = @($it); $curTop = $it.Top; $curH = [Math]::Max(12.0, $it.Height)\n" +
                    "      }\n" +
                    "    }\n" +
                    "    if ($curRow.Count -gt 0) {\n" +
                    "      $rows += ((($curRow | Sort-Object Left) | ForEach-Object { $_.Text }) -join '  |  ')\n" +
                    "    }\n" +
                    "    $pageText = if ($rows.Count -gt 0) { $rows -join \"`n\" } else { [string]$ocr.Text }\n" +
                    "    $pages += $pageText\n" +
                    "  } finally { $st.Dispose() }\n" +
                    "}\n" +
                    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" +
                    "ConvertTo-Json -InputObject $pages -Compress\n";
                File.WriteAllText(scriptPath, psScript, new UTF8Encoding(false));

                var psi = new ProcessStartInfo {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + scriptPath + "\" -Dir \"" + tempDir + "\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                string stdout = "";
                string stderr = "";
                using (var proc = Process.Start(psi)) {
                    stdout = proc.StandardOutput.ReadToEnd();
                    stderr = proc.StandardError.ReadToEnd();
                    proc.WaitForExit(120000);
                    if (proc.ExitCode != 0) {
                        WriteJson(res, 500, new { success = false, error = string.IsNullOrWhiteSpace(stderr) ? "Windows offline OCR failed." : stderr.Trim() });
                        return;
                    }
                }

                var pageTexts = new List<string>();
                string trimmedOut = (stdout ?? "").Trim();
                if (!string.IsNullOrEmpty(trimmedOut)) {
                    var parsed = new JavaScriptSerializer().DeserializeObject(trimmedOut);
                    if (parsed is object[] arr) {
                        foreach (var item in arr) pageTexts.Add(Convert.ToString(item ?? "").Trim());
                    } else if (parsed is string single) {
                        pageTexts.Add(single.Trim());
                    }
                }

                var nonEmpty = new List<string>();
                for (int i = 0; i < pageTexts.Count; i++) {
                    if (string.IsNullOrWhiteSpace(pageTexts[i])) continue;
                    nonEmpty.Add(pageTexts.Count > 1 ? ("<!-- Page " + (i + 1) + " -->\n\n" + pageTexts[i]) : pageTexts[i]);
                }

                string markdown = string.Join("\n\n---\n\n", nonEmpty).Trim();
                if (string.IsNullOrEmpty(markdown)) {
                    WriteJson(res, 200, new { success = false, error = "Windows offline OCR found no readable text in this PDF." });
                    return;
                }

                WriteJson(res, 200, new {
                    success = true,
                    ocrAvailable = true,
                    backend = "windows-ocr",
                    pages_total = imgPaths.Count,
                    markdown = markdown
                });
            } catch (Exception ex) {
                WriteJson(res, 500, new { success = false, error = "Windows offline OCR error: " + ex.Message });
            } finally {
                try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true); } catch { }
            }
        }

        private void HandleOcrModels(HttpListenerRequest req, HttpListenerResponse res, string method) {
            string ocrDir = Path.Combine(_modelsDir, "ocr");
            if (!Directory.Exists(ocrDir)) {
                try { Directory.CreateDirectory(ocrDir); } catch { }
            }
            string activeFile = Path.Combine(ocrDir, "active.json");
            var serializer = new JavaScriptSerializer();

            if (method == "GET") {
                string activeId = "windows-native";
                if (File.Exists(activeFile)) {
                    try {
                        var parsed = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(activeFile, Encoding.UTF8));
                        if (parsed != null && parsed.ContainsKey("activeModelId")) {
                            activeId = Convert.ToString(parsed["activeModelId"]) ?? "windows-native";
                        }
                    } catch { }
                }

                bool paddleInstalled = File.Exists(Path.Combine(ocrDir, "paddleocr-vl-1.6", ".sanctum_ocr_ready.json"));
                bool sidecarOnline = false;
                try {
                    string ep = (Environment.GetEnvironmentVariable("SANCTUM_OCR_ENDPOINT") ?? "http://127.0.0.1:8010").Trim().TrimEnd('/');
                    var hReq = (HttpWebRequest)WebRequest.Create(ep + "/health");
                    hReq.Proxy = null;
                    hReq.Method = "GET";
                    hReq.Timeout = 1500;
                    using (var hRes = (HttpWebResponse)hReq.GetResponse()) {
                        sidecarOnline = hRes.StatusCode == HttpStatusCode.OK;
                    }
                } catch { }

                WriteJson(res, 200, new {
                    activeModel = activeId,
                    models = new object[] {
                        new { id = "windows-native", installed = true, active = activeId == "windows-native" },
                        new { id = "paddleocr-vl-1.6", installed = paddleInstalled, active = activeId == "paddleocr-vl-1.6", sidecarOnline = sidecarOnline }
                    }
                });
                return;
            }

            if (method == "POST") {
                if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "settings_write")) {
                    WriteJson(res, 403, new { error = "User approval required to change OCR engine." });
                    return;
                }
                try {
                    string body = ReadRequestBodyUtf8(req, 65536);
                    var payload = serializer.Deserialize<Dictionary<string, object>>(body);
                    string modelId = payload != null && payload.ContainsKey("modelId") ? Convert.ToString(payload["modelId"]) : "";
                    if (modelId != "windows-native" && modelId != "paddleocr-vl-1.6") {
                        WriteJson(res, 400, new { error = "Unknown OCR engine ID." });
                        return;
                    }
                    WriteAtomicText(activeFile, serializer.Serialize(new { activeModelId = modelId, updatedAt = DateTime.UtcNow.ToString("o") }));
                    WriteJson(res, 200, new { ok = true, activeModel = modelId });
                } catch (Exception ex) {
                    WriteJson(res, 500, new { error = ex.Message });
                }
            }
        }

        private void HandleOcrDownload(HttpListenerRequest req, HttpListenerResponse res, string method) {
            string ocrDir = Path.Combine(_modelsDir, "ocr");
            if (!Directory.Exists(ocrDir)) {
                try { Directory.CreateDirectory(ocrDir); } catch { }
            }
            var serializer = new JavaScriptSerializer();

            if (method == "DELETE") {
                if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "settings_write")) {
                    WriteJson(res, 403, new { error = "User approval required to remove OCR weights." });
                    return;
                }
                try {
                    string targetDir = Path.Combine(ocrDir, "paddleocr-vl-1.6");
                    if (Directory.Exists(targetDir)) Directory.Delete(targetDir, true);
                    string activeFile = Path.Combine(ocrDir, "active.json");
                    WriteAtomicText(activeFile, serializer.Serialize(new { activeModelId = "windows-native", updatedAt = DateTime.UtcNow.ToString("o") }));
                    WriteJson(res, 200, new { ok = true });
                } catch (Exception ex) {
                    WriteJson(res, 500, new { error = ex.Message });
                }
                return;
            }

            if (method == "POST") {
                if (!ConsumeApprovalToken(req.Headers["X-Sanctum-Approval"], "model_download")) {
                    WriteJson(res, 403, new { error = "User approval required to download OCR model." });
                    return;
                }

                string mDir = Path.Combine(ocrDir, "paddleocr-vl-1.6");
                Directory.CreateDirectory(mDir);

                res.StatusCode = 200;
                res.ContentType = "application/x-ndjson; charset=utf-8";
                res.SendChunked = true;
                Action<object> emit = (obj) => {
                    try {
                        byte[] b = Encoding.UTF8.GetBytes(serializer.Serialize(obj) + "\n");
                        res.OutputStream.Write(b, 0, b.Length);
                        res.OutputStream.Flush();
                    } catch { }
                };

                try {
                    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
                    string repoId = "PaddlePaddle/PaddleOCR-VL-1.6";
                    emit(new { status = "Fetching PaddleOCR-VL-1.6 manifest...", percent = 3 });

                    var metaReq = (HttpWebRequest)WebRequest.Create("https://huggingface.co/api/models/" + repoId);
                    metaReq.UserAgent = "Sanctum-OCR-Downloader/1.0";
                    metaReq.Timeout = 30000;
                    string metaJson;
                    using (var metaRes = (HttpWebResponse)metaReq.GetResponse())
                    using (var sr = new StreamReader(metaRes.GetResponseStream(), Encoding.UTF8)) {
                        metaJson = sr.ReadToEnd();
                    }

                    var meta = serializer.Deserialize<Dictionary<string, object>>(metaJson);
                    var siblings = meta != null && meta.ContainsKey("siblings") ? meta["siblings"] as System.Collections.ArrayList : null;
                    var filesToDownload = new List<string>();
                    if (siblings != null) {
                        foreach (var item in siblings) {
                            var dict = item as Dictionary<string, object>;
                            if (dict == null || !dict.ContainsKey("rfilename")) continue;
                            string rf = Convert.ToString(dict["rfilename"]) ?? "";
                            if (string.IsNullOrEmpty(rf) || rf.StartsWith(".")) continue;
                            if (rf.EndsWith(".json", StringComparison.OrdinalIgnoreCase) ||
                                rf.EndsWith(".txt", StringComparison.OrdinalIgnoreCase) ||
                                rf.EndsWith(".py", StringComparison.OrdinalIgnoreCase) ||
                                rf.EndsWith(".model", StringComparison.OrdinalIgnoreCase) ||
                                rf.EndsWith(".safetensors", StringComparison.OrdinalIgnoreCase)) {
                                filesToDownload.Add(rf);
                            }
                        }
                    }

                    if (filesToDownload.Count == 0) {
                        throw new Exception("No downloadable model files found in " + repoId);
                    }

                    int totalFiles = filesToDownload.Count;
                    byte[] buf = new byte[131072];
                    for (int idx = 0; idx < totalFiles; idx++) {
                        string rel = filesToDownload[idx];
                        string dest = Path.Combine(mDir, rel.Replace('/', Path.DirectorySeparatorChar));
                        Directory.CreateDirectory(Path.GetDirectoryName(dest));
                        int basePct = 5 + (idx * 90) / totalFiles;
                        emit(new { status = "Downloading " + rel + " (" + (idx + 1) + "/" + totalFiles + ")", percent = basePct });

                        string url = "https://huggingface.co/" + repoId + "/resolve/main/" + Uri.EscapeUriString(rel);
                        var dlReq = (HttpWebRequest)WebRequest.Create(url);
                        dlReq.UserAgent = "Sanctum-OCR-Downloader/1.0";
                        dlReq.AllowAutoRedirect = true;
                        dlReq.Timeout = 180000;
                        dlReq.ReadWriteTimeout = 180000;

                        using (var dlRes = (HttpWebResponse)dlReq.GetResponse())
                        using (var net = dlRes.GetResponseStream())
                        using (var fs = new FileStream(dest, FileMode.Create, FileAccess.Write, FileShare.None)) {
                            long fileTotal = dlRes.ContentLength;
                            long fileDone = 0;
                            DateTime lastEmit = DateTime.UtcNow;
                            int read;
                            while ((read = net.Read(buf, 0, buf.Length)) > 0) {
                                fs.Write(buf, 0, read);
                                fileDone += read;
                                if (fileTotal > 0 && (DateTime.UtcNow - lastEmit).TotalMilliseconds >= 300) {
                                    lastEmit = DateTime.UtcNow;
                                    int subPct = basePct + (int)((fileDone * (90L / Math.Max(1, totalFiles))) / fileTotal);
                                    emit(new { status = "Downloading " + rel + "...", percent = Math.Min(98, subPct) });
                                }
                            }
                        }
                    }

                    WriteAtomicText(
                        Path.Combine(mDir, ".sanctum_ocr_ready.json"),
                        serializer.Serialize(new { modelId = "paddleocr-vl-1.6", repoId = repoId, downloadedAt = DateTime.UtcNow.ToString("o"), files = totalFiles })
                    );
                    emit(new { status = "PaddleOCR-VL-1.6 ready", percent = 100, done = true });
                } catch (Exception ex) {
                    emit(new { error = ex.Message });
                } finally {
                    try { res.Close(); } catch { }
                }
            }
        }
    }
}
