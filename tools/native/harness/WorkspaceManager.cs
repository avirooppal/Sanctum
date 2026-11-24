using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class WorkspaceSettingsOverrides {
        [JsonProperty("defaultModel")] public string DefaultModel { get; set; } = "";
        [JsonProperty("autonomyCeiling")] public string AutonomyCeiling { get; set; } = "";
        [JsonProperty("a2uiMode")] public string A2uiMode { get; set; } = "";
    }

    public sealed class WorkspaceRecord {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("name")] public string Name { get; set; } = "";
        [JsonProperty("color")] public string Color { get; set; } = "#6366f1";
        [JsonProperty("icon")] public string Icon { get; set; } = "folder";
        [JsonProperty("rootPath")] public string RootPath { get; set; }
        [JsonProperty("archived")] public bool Archived { get; set; }
        [JsonProperty("pinned")] public bool Pinned { get; set; }
        [JsonProperty("createdAt")] public string CreatedAt { get; set; } = "";
        [JsonProperty("updatedAt")] public string UpdatedAt { get; set; } = "";
        [JsonProperty("lastOpenedAt")] public string LastOpenedAt { get; set; } = "";
        [JsonProperty("settingsOverrides")] public WorkspaceSettingsOverrides SettingsOverrides { get; set; } = new WorkspaceSettingsOverrides();

        [JsonIgnore]
        public string RootStatus {
            get {
                if (string.IsNullOrWhiteSpace(RootPath)) return "chat_only";
                return Directory.Exists(RootPath) ? "ok" : "missing";
            }
        }

        public JObject ToPublicJson() {
            var obj = JObject.FromObject(this);
            obj["rootStatus"] = RootStatus;
            return obj;
        }
    }

    public sealed class WorkspaceRootValidationResult {
        public bool Ok { get; set; }
        public string Code { get; set; } = "ok";
        public string Error { get; set; } = "";
        public string CanonicalPath { get; set; } = "";
        public string ExistingWorkspaceId { get; set; } = "";
        public string ExistingWorkspaceName { get; set; } = "";
        public List<string> Warnings { get; set; } = new List<string>();

        public JObject ToJson() => new JObject {
            ["ok"] = Ok,
            ["code"] = Code,
            ["error"] = Error,
            ["canonicalPath"] = CanonicalPath,
            ["existingWorkspaceId"] = ExistingWorkspaceId,
            ["existingWorkspaceName"] = ExistingWorkspaceName,
            ["warnings"] = new JArray(Warnings)
        };
    }

    /// <summary>
    /// Part A: Host-owned workspace registry, root path validation, per-workspace isolated storage,
    /// UI state persistence, and reversible migration from legacy single-workspace layout.
    /// </summary>
    public sealed class WorkspaceManager {
        public const int CurrentSchemaVersion = 1;
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private static readonly string[] CloudSyncMarkers = new[] {
            "onedrive", "dropbox", "google drive", "googledrive", "iclouddrive", "box sync", "nextcloud"
        };

        private readonly string _appDataDir;
        private readonly string _registryPath;
        private readonly string _registryBackupPath;
        private readonly string _workspacesRoot;
        private readonly string _migrationStatePath;
        private readonly object _lock = new object();

        private int _schemaVersion = CurrentSchemaVersion;
        private string _lastUsedWorkspaceId = "";
        private List<WorkspaceRecord> _workspaces = new List<WorkspaceRecord>();

        public WorkspaceManager(string appDataDir) {
            _appDataDir = Path.GetFullPath(appDataDir);
            Directory.CreateDirectory(_appDataDir);
            _registryPath = Path.Combine(_appDataDir, "workspaces.json");
            _registryBackupPath = _registryPath + ".bak";
            _workspacesRoot = Path.Combine(_appDataDir, "workspaces");
            _migrationStatePath = Path.Combine(_appDataDir, "migration_state.json");
            Directory.CreateDirectory(_workspacesRoot);
            LoadOrMigrateLocked();
        }

        public string AppDataDir => _appDataDir;
        public string WorkspacesRoot => _workspacesRoot;

        public string GetWorkspaceDataDir(string workspaceId) {
            if (string.IsNullOrWhiteSpace(workspaceId)) throw new ArgumentException("workspaceId is required.");
            string safe = workspaceId.Trim();
            if (safe.IndexOfAny(new[] { '\\', '/', ':', '*', '?', '"', '<', '>', '|' }) >= 0 || safe.Contains("..")) {
                throw new ArgumentException("Invalid workspaceId.");
            }
            string dir = Path.Combine(_workspacesRoot, safe);
            Directory.CreateDirectory(dir);
            return dir;
        }

        public string LastUsedWorkspaceId {
            get { lock (_lock) { return _lastUsedWorkspaceId; } }
        }

        private void LoadOrMigrateLocked() {
            if (!File.Exists(_registryPath) && !File.Exists(_registryBackupPath)) {
                MigrateLegacyIfNeededLocked();
                return;
            }
            if (TryLoadRegistryFileLocked(_registryPath)) return;
            // Crash recovery from .bak if primary registry is corrupted or truncated
            if (TryLoadRegistryFileLocked(_registryBackupPath)) {
                SaveRegistryLocked();
                return;
            }
            // Last-resort recovery: scan workspaces\*\manifest.json
            var recovered = new List<WorkspaceRecord>();
            if (Directory.Exists(_workspacesRoot)) {
                foreach (string dir in Directory.GetDirectories(_workspacesRoot)) {
                    string mf = Path.Combine(dir, "manifest.json");
                    if (!File.Exists(mf)) continue;
                    try {
                        var rec = JsonConvert.DeserializeObject<WorkspaceRecord>(File.ReadAllText(mf, Utf8NoBom));
                        if (rec != null && !string.IsNullOrWhiteSpace(rec.Id)) recovered.Add(rec);
                    } catch { }
                }
            }
            _workspaces = recovered;
            if (_workspaces.Count == 0) {
                CreateDefaultScratchLocked();
            } else {
                _lastUsedWorkspaceId = _workspaces[0].Id;
                SaveRegistryLocked();
            }
        }

        private bool TryLoadRegistryFileLocked(string path) {
            if (!File.Exists(path)) return false;
            try {
                string raw = File.ReadAllText(path, Utf8NoBom);
                if (string.IsNullOrWhiteSpace(raw)) return false;
                var obj = JObject.Parse(raw);
                int ver = obj["schemaVersion"]?.Value<int>() ?? 0;
                if (ver <= 0) return false;
                var arr = obj["workspaces"] as JArray;
                if (arr == null) return false;
                var list = new List<WorkspaceRecord>();
                foreach (var item in arr) {
                    var rec = item.ToObject<WorkspaceRecord>();
                    if (rec != null && !string.IsNullOrWhiteSpace(rec.Id)) {
                        if (rec.SettingsOverrides == null) rec.SettingsOverrides = new WorkspaceSettingsOverrides();
                        list.Add(rec);
                    }
                }
                _schemaVersion = ver;
                _lastUsedWorkspaceId = obj["lastUsedWorkspaceId"]?.Value<string>() ?? (list.FirstOrDefault()?.Id ?? "");
                _workspaces = list;
                return true;
            } catch {
                return false;
            }
        }

        private void SaveRegistryLocked() {
            var root = new JObject {
                ["schemaVersion"] = CurrentSchemaVersion,
                ["lastUsedWorkspaceId"] = _lastUsedWorkspaceId ?? "",
                ["updatedAt"] = DateTime.UtcNow.ToString("o"),
                ["workspaces"] = new JArray(_workspaces.Select(w => JObject.FromObject(w)))
            };
            string json = root.ToString(Formatting.Indented);
            string tmp = _registryPath + ".tmp." + Guid.NewGuid().ToString("N").Substring(0, 8);
            File.WriteAllText(tmp, json, Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
            if (File.Exists(_registryPath)) {
                try { File.Copy(_registryPath, _registryBackupPath, true); } catch { }
                WindowsAclHelper.ApplyUserOnlyFileAcl(_registryBackupPath);
                try {
                    File.Replace(tmp, _registryPath, _registryBackupPath, true);
                } catch {
                    File.Copy(tmp, _registryPath, true);
                    try { File.Delete(tmp); } catch { }
                }
            } else {
                File.Move(tmp, _registryPath);
            }
            WindowsAclHelper.ApplyUserOnlyFileAcl(_registryPath);
        }

        private void SaveManifestLocked(WorkspaceRecord rec) {
            string dir = GetWorkspaceDataDir(rec.Id);
            string mf = Path.Combine(dir, "manifest.json");
            string tmp = mf + ".tmp." + Guid.NewGuid().ToString("N").Substring(0, 6);
            File.WriteAllText(tmp, JObject.FromObject(rec).ToString(Formatting.Indented), Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
            File.Copy(tmp, mf, true);
            try { File.Delete(tmp); } catch { }
            WindowsAclHelper.ApplyUserOnlyFileAcl(mf);
        }

        private WorkspaceRecord CreateDefaultScratchLocked() {
            string now = DateTime.UtcNow.ToString("o");
            var rec = new WorkspaceRecord {
                Id = "ws_" + Guid.NewGuid().ToString("N"),
                Name = "Scratch",
                Color = "#6366f1",
                Icon = "message",
                RootPath = null,
                CreatedAt = now,
                UpdatedAt = now,
                LastOpenedAt = now
            };
            _workspaces.Add(rec);
            _lastUsedWorkspaceId = rec.Id;
            EnsureWorkspaceSubdirs(rec.Id);
            SaveManifestLocked(rec);
            SaveRegistryLocked();
            return rec;
        }

        private void EnsureWorkspaceSubdirs(string workspaceId) {
            string dir = GetWorkspaceDataDir(workspaceId);
            Directory.CreateDirectory(Path.Combine(dir, "sessions"));
            Directory.CreateDirectory(Path.Combine(dir, "blobs"));
            Directory.CreateDirectory(Path.Combine(dir, "vault"));
            Directory.CreateDirectory(Path.Combine(dir, "shadow-git"));
        }

        private void MigrateLegacyIfNeededLocked() {
            string[] legacyFiles = new[] {
                "tool_workspace.txt", "memory.json", "permission_rules.json",
                "workspace_trust.json", "mcp_servers.json", "schedules.json"
            };
            string[] legacyDirs = new[] { "sessions", "blobs", "shadow-git" };

            bool hasLegacy = legacyFiles.Any(f => File.Exists(Path.Combine(_appDataDir, f)))
                          || legacyDirs.Any(d => Directory.Exists(Path.Combine(_appDataDir, d)) && Directory.EnumerateFileSystemEntries(Path.Combine(_appDataDir, d)).Any());

            string backupDir = "";
            if (hasLegacy) {
                backupDir = Path.Combine(_appDataDir, "backups", "pre-workspaces-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss"));
                Directory.CreateDirectory(backupDir);
                foreach (string f in legacyFiles) {
                    string src = Path.Combine(_appDataDir, f);
                    if (File.Exists(src)) File.Copy(src, Path.Combine(backupDir, f), true);
                }
                foreach (string d in legacyDirs) {
                    string src = Path.Combine(_appDataDir, d);
                    if (Directory.Exists(src)) CopyDirectoryRecursive(src, Path.Combine(backupDir, d));
                }
            }

            string legacyRoot = null;
            string wsTxt = Path.Combine(_appDataDir, "tool_workspace.txt");
            if (File.Exists(wsTxt)) {
                try {
                    string candidate = (File.ReadAllText(wsTxt, Utf8NoBom) ?? "").Trim();
                    if (!string.IsNullOrWhiteSpace(candidate)) {
                        var check = ValidateRootPathLocked(candidate, null);
                        if (check.Ok) legacyRoot = check.CanonicalPath;
                    }
                } catch { }
            }

            string now = DateTime.UtcNow.ToString("o");
            var rec = new WorkspaceRecord {
                Id = "ws_" + Guid.NewGuid().ToString("N"),
                Name = legacyRoot != null ? "Default" : "Scratch",
                Color = "#6366f1",
                Icon = legacyRoot != null ? "folder" : "message",
                RootPath = legacyRoot,
                CreatedAt = now,
                UpdatedAt = now,
                LastOpenedAt = now
            };
            _workspaces = new List<WorkspaceRecord> { rec };
            _lastUsedWorkspaceId = rec.Id;
            EnsureWorkspaceSubdirs(rec.Id);
            string targetDir = GetWorkspaceDataDir(rec.Id);

            if (hasLegacy) {
                // Copy legacy files into the default workspace (keep global memory.json intact for profile/global tier)
                string[] copyToWs = new[] { "memory.json", "permission_rules.json", "workspace_trust.json", "mcp_servers.json", "schedules.json" };
                foreach (string f in copyToWs) {
                    string src = Path.Combine(_appDataDir, f);
                    if (File.Exists(src)) File.Copy(src, Path.Combine(targetDir, f), true);
                }
                foreach (string d in legacyDirs) {
                    string src = Path.Combine(_appDataDir, d);
                    if (Directory.Exists(src)) CopyDirectoryRecursive(src, Path.Combine(targetDir, d));
                }
                var migState = new JObject {
                    ["schemaVersion"] = CurrentSchemaVersion,
                    ["migratedAt"] = now,
                    ["backupDir"] = backupDir,
                    ["migratedWorkspaceId"] = rec.Id,
                    ["migratedWorkspaceName"] = rec.Name,
                    ["legacyRootPath"] = legacyRoot ?? "",
                    ["reversible"] = true
                };
                File.WriteAllText(_migrationStatePath, migState.ToString(Formatting.Indented), Utf8NoBom);
            }

            SaveManifestLocked(rec);
            SaveRegistryLocked();
        }

        public static (bool ok, string message) RollbackMigration(string appDataDir) {
            string root = Path.GetFullPath(appDataDir);
            string migFile = Path.Combine(root, "migration_state.json");
            if (!File.Exists(migFile)) return (false, "No workspace migration state found to roll back.");
            try {
                var state = JObject.Parse(File.ReadAllText(migFile, Utf8NoBom));
                string backupDir = state["backupDir"]?.Value<string>() ?? "";
                if (string.IsNullOrWhiteSpace(backupDir) || !Directory.Exists(backupDir)) {
                    return (false, "Migration backup directory is missing: " + backupDir);
                }
                // Restore backed-up files & directories
                foreach (string file in Directory.GetFiles(backupDir)) {
                    string name = Path.GetFileName(file);
                    File.Copy(file, Path.Combine(root, name), true);
                }
                foreach (string dir in Directory.GetDirectories(backupDir)) {
                    string name = Path.GetFileName(dir);
                    string dest = Path.Combine(root, name);
                    if (Directory.Exists(dest)) Directory.Delete(dest, true);
                    CopyDirectoryRecursive(dir, dest);
                }
                string reg = Path.Combine(root, "workspaces.json");
                string regBak = reg + ".bak";
                string wsDir = Path.Combine(root, "workspaces");
                if (File.Exists(reg)) File.Delete(reg);
                if (File.Exists(regBak)) File.Delete(regBak);
                if (Directory.Exists(wsDir)) Directory.Delete(wsDir, true);
                File.Delete(migFile);
                return (true, "Rolled back workspace migration from " + backupDir);
            } catch (Exception ex) {
                return (false, "Rollback failed: " + ex.Message);
            }
        }

        private static void CopyDirectoryRecursive(string sourceDir, string destDir) {
            Directory.CreateDirectory(destDir);
            foreach (string file in Directory.GetFiles(sourceDir)) {
                File.Copy(file, Path.Combine(destDir, Path.GetFileName(file)), true);
            }
            foreach (string sub in Directory.GetDirectories(sourceDir)) {
                CopyDirectoryRecursive(sub, Path.Combine(destDir, Path.GetFileName(sub)));
            }
        }

        public WorkspaceRootValidationResult ValidateRootPath(string rawPath, string excludeWorkspaceId = null) {
            lock (_lock) {
                return ValidateRootPathLocked(rawPath, excludeWorkspaceId);
            }
        }

        private WorkspaceRootValidationResult ValidateRootPathLocked(string rawPath, string excludeWorkspaceId) {
            var res = new WorkspaceRootValidationResult();
            string trimmed = (rawPath ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed)) {
                res.Ok = false;
                res.Code = "empty_path";
                res.Error = "Workspace root path cannot be empty (omit rootPath for a chat-only workspace).";
                return res;
            }
            if (trimmed.IndexOf('\0') >= 0) {
                res.Ok = false;
                res.Code = "invalid_path";
                res.Error = "Path contains invalid null character.";
                return res;
            }
            if (trimmed.StartsWith(@"\\?\") || trimmed.StartsWith(@"\\.\")) {
                res.Ok = false;
                res.Code = "device_path_blocked";
                res.Error = "Device and raw namespace paths are not allowed as workspace roots.";
                return res;
            }

            if (!Directory.Exists(trimmed)) {
                res.Ok = false;
                res.Code = "folder_not_found";
                res.Error = "Workspace folder does not exist.";
                return res;
            }

            string canonical;
            try {
                canonical = PermissionEngine.CanonicalizePath(trimmed);
            } catch (Exception ex) {
                res.Ok = false;
                res.Code = "canonicalize_failed";
                res.Error = "Could not canonicalize path: " + ex.Message;
                return res;
            }
            res.CanonicalPath = canonical;

            string norm = canonical.TrimEnd('\\').ToLowerInvariant();

            // 1. Reject drive roots (e.g. C:\ or C:)
            string pathRoot = (Path.GetPathRoot(canonical) ?? "").TrimEnd('\\').ToLowerInvariant();
            if (!string.IsNullOrEmpty(pathRoot) && norm == pathRoot) {
                res.Ok = false;
                res.Code = "drive_root_blocked";
                res.Error = "A drive root cannot be used as a workspace.";
                return res;
            }

            // 2. Reject user profile root, Windows, Program Files, ProgramData, and %APPDATA%\Sanctum
            string userProfile = NormalizeCompare(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
            if (!string.IsNullOrEmpty(userProfile) && norm == userProfile) {
                res.Ok = false;
                res.Code = "user_profile_root_blocked";
                res.Error = "The Windows user profile root cannot be used as a workspace. Choose a project subfolder.";
                return res;
            }

            string[] blockedExactOrPrefix = new[] {
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData)
            };
            foreach (string b in blockedExactOrPrefix) {
                string bn = NormalizeCompare(b);
                if (!string.IsNullOrEmpty(bn) && (norm == bn || norm.StartsWith(bn + "\\"))) {
                    res.Ok = false;
                    res.Code = "system_path_blocked";
                    res.Error = "System directories (Windows, Program Files, ProgramData) cannot be used as a workspace.";
                    return res;
                }
            }

            // Reject Sanctum's own app data dir (equal, inside, or parent of it)
            string sanctumData = NormalizeCompare(PermissionEngine.CanonicalizePath(_appDataDir));
            string defaultAppDataSanctum = NormalizeCompare(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sanctum"));
            foreach (string sd in new[] { sanctumData, defaultAppDataSanctum }) {
                if (!string.IsNullOrEmpty(sd) && (norm == sd || norm.StartsWith(sd + "\\") || sd.StartsWith(norm + "\\"))) {
                    res.Ok = false;
                    res.Code = "sanctum_data_dir_blocked";
                    res.Error = "Sanctum's internal data directory cannot be used as or nested inside a workspace.";
                    return res;
                }
            }

            // 3. Reject equal, nested inside, or parent of any existing non-archived workspace root
            foreach (var existing in _workspaces) {
                if (existing.Archived || string.IsNullOrWhiteSpace(existing.RootPath)) continue;
                if (!string.IsNullOrEmpty(excludeWorkspaceId) &&
                    string.Equals(existing.Id, excludeWorkspaceId, StringComparison.OrdinalIgnoreCase)) continue;
                string exNorm = NormalizeCompare(PermissionEngine.CanonicalizePath(existing.RootPath));
                if (string.IsNullOrEmpty(exNorm)) continue;
                if (norm == exNorm || norm.StartsWith(exNorm + "\\") || exNorm.StartsWith(norm + "\\")) {
                    res.Ok = false;
                    res.Code = "workspace_root_overlap";
                    res.ExistingWorkspaceId = existing.Id;
                    res.ExistingWorkspaceName = existing.Name;
                    res.Error = $"Folder overlaps existing workspace '{existing.Name}'. Open that workspace instead.";
                    return res;
                }
            }

            // 4. Non-blocking warnings: network share / drive or cloud-synced folder
            if (canonical.StartsWith(@"\\")) {
                res.Warnings.Add("Network share detected. Performance and offline availability may be degraded.");
            } else {
                try {
                    var di = new DriveInfo(Path.GetPathRoot(canonical));
                    if (di.DriveType == DriveType.Network) {
                        res.Warnings.Add("Mapped network drive detected. Offline mode may interrupt file access.");
                    }
                } catch { }
            }
            foreach (string marker in CloudSyncMarkers) {
                if (norm.Contains("\\" + marker + "\\") || norm.EndsWith("\\" + marker)) {
                    res.Warnings.Add("Cloud-synced folder detected (" + marker + "). Local files may sync outside this machine.");
                    break;
                }
            }

            res.Ok = true;
            res.Code = "ok";
            return res;
        }

        private static string NormalizeCompare(string p) {
            if (string.IsNullOrWhiteSpace(p)) return "";
            try { return Path.GetFullPath(p).TrimEnd('\\').ToLowerInvariant(); } catch { return p.Trim().TrimEnd('\\').ToLowerInvariant(); }
        }

        public JObject ListWorkspaces(bool includeArchived = false) {
            lock (_lock) {
                var arr = new JArray();
                foreach (var w in _workspaces) {
                    if (!includeArchived && w.Archived) continue;
                    arr.Add(w.ToPublicJson());
                }
                return new JObject {
                    ["schemaVersion"] = _schemaVersion,
                    ["lastUsedWorkspaceId"] = _lastUsedWorkspaceId,
                    ["workspaces"] = arr
                };
            }
        }

        public WorkspaceRecord GetById(string id) {
            if (string.IsNullOrWhiteSpace(id)) return null;
            lock (_lock) {
                return _workspaces.FirstOrDefault(w => string.Equals(w.Id, id.Trim(), StringComparison.OrdinalIgnoreCase));
            }
        }

        public WorkspaceRecord ResolveSelector(string selector) {
            if (string.IsNullOrWhiteSpace(selector)) return null;
            string s = selector.Trim();
            lock (_lock) {
                var byId = _workspaces.FirstOrDefault(w => string.Equals(w.Id, s, StringComparison.OrdinalIgnoreCase));
                if (byId != null) return byId;
                var byName = _workspaces.FirstOrDefault(w => !w.Archived && string.Equals(w.Name, s, StringComparison.OrdinalIgnoreCase));
                if (byName != null) return byName;
                string canon = Directory.Exists(s) ? NormalizeCompare(PermissionEngine.CanonicalizePath(s)) : NormalizeCompare(s);
                return _workspaces.FirstOrDefault(w => !w.Archived && !string.IsNullOrWhiteSpace(w.RootPath) &&
                    NormalizeCompare(PermissionEngine.CanonicalizePath(w.RootPath)) == canon);
            }
        }

        public (int status, JObject body) CreateWorkspace(
            string name,
            string rootPath,
            string color = "#6366f1",
            string icon = "folder",
            string copySettingsFromId = null,
            WorkspaceSettingsOverrides overrides = null) {
            lock (_lock) {
                string cleanName = (name ?? "").Trim();
                if (string.IsNullOrEmpty(cleanName)) {
                    return (400, new JObject { ["error"] = "Workspace name is required." });
                }
                if (cleanName.Length > 80) cleanName = cleanName.Substring(0, 80);

                string canonicalRoot = null;
                var warnings = new List<string>();
                if (!string.IsNullOrWhiteSpace(rootPath)) {
                    var check = ValidateRootPathLocked(rootPath, null);
                    if (!check.Ok) {
                        int code = check.Code == "workspace_root_overlap" ? 409 : 400;
                        return (code, check.ToJson());
                    }
                    canonicalRoot = check.CanonicalPath;
                    warnings = check.Warnings;
                }

                var effectiveOverrides = overrides ?? new WorkspaceSettingsOverrides();
                if (!string.IsNullOrWhiteSpace(copySettingsFromId)) {
                    var src = _workspaces.FirstOrDefault(w => string.Equals(w.Id, copySettingsFromId.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (src?.SettingsOverrides != null) {
                        effectiveOverrides = new WorkspaceSettingsOverrides {
                            DefaultModel = src.SettingsOverrides.DefaultModel ?? "",
                            AutonomyCeiling = src.SettingsOverrides.AutonomyCeiling ?? "",
                            A2uiMode = src.SettingsOverrides.A2uiMode ?? ""
                        };
                    }
                }

                string now = DateTime.UtcNow.ToString("o");
                var rec = new WorkspaceRecord {
                    Id = "ws_" + Guid.NewGuid().ToString("N"),
                    Name = cleanName,
                    Color = string.IsNullOrWhiteSpace(color) ? "#6366f1" : color.Trim(),
                    Icon = string.IsNullOrWhiteSpace(icon) ? (canonicalRoot != null ? "folder" : "message") : icon.Trim(),
                    RootPath = canonicalRoot,
                    CreatedAt = now,
                    UpdatedAt = now,
                    LastOpenedAt = now,
                    SettingsOverrides = effectiveOverrides
                };
                _workspaces.Add(rec);
                _lastUsedWorkspaceId = rec.Id;
                EnsureWorkspaceSubdirs(rec.Id);
                SaveManifestLocked(rec);
                SaveRegistryLocked();

                var resp = rec.ToPublicJson();
                resp["warnings"] = new JArray(warnings);
                return (201, resp);
            }
        }

        public (int status, JObject body) RenameWorkspace(string id, string newName) {
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, id, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                string clean = (newName ?? "").Trim();
                if (string.IsNullOrEmpty(clean)) return (400, new JObject { ["error"] = "Workspace name cannot be empty." });
                rec.Name = clean.Length > 80 ? clean.Substring(0, 80) : clean;
                rec.UpdatedAt = DateTime.UtcNow.ToString("o");
                SaveManifestLocked(rec);
                SaveRegistryLocked();
                return (200, rec.ToPublicJson());
            }
        }

        public (int status, JObject body) RelocateWorkspace(string id, string newRootPath) {
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, id, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                var check = ValidateRootPathLocked(newRootPath, rec.Id);
                if (!check.Ok) {
                    int code = check.Code == "workspace_root_overlap" ? 409 : 400;
                    return (code, check.ToJson());
                }
                rec.RootPath = check.CanonicalPath;
                rec.UpdatedAt = DateTime.UtcNow.ToString("o");
                SaveManifestLocked(rec);
                SaveRegistryLocked();
                var resp = rec.ToPublicJson();
                resp["warnings"] = new JArray(check.Warnings);
                return (200, resp);
            }
        }

        public (int status, JObject body) UpdateWorkspace(string id, JObject patch) {
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, id, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                if (patch["name"] != null) {
                    string n = (patch["name"].Value<string>() ?? "").Trim();
                    if (!string.IsNullOrEmpty(n)) rec.Name = n.Length > 80 ? n.Substring(0, 80) : n;
                }
                if (patch["color"] != null) rec.Color = (patch["color"].Value<string>() ?? rec.Color).Trim();
                if (patch["icon"] != null) rec.Icon = (patch["icon"].Value<string>() ?? rec.Icon).Trim();
                if (patch["pinned"] != null) rec.Pinned = patch["pinned"].Value<bool>();
                if (patch["archived"] != null) rec.Archived = patch["archived"].Value<bool>();
                if (patch["touchOpened"]?.Value<bool>() == true) {
                    rec.LastOpenedAt = DateTime.UtcNow.ToString("o");
                    _lastUsedWorkspaceId = rec.Id;
                }
                if (patch["settingsOverrides"] is JObject ov) {
                    if (rec.SettingsOverrides == null) rec.SettingsOverrides = new WorkspaceSettingsOverrides();
                    if (ov["defaultModel"] != null) rec.SettingsOverrides.DefaultModel = ov["defaultModel"].Value<string>() ?? "";
                    if (ov["autonomyCeiling"] != null) rec.SettingsOverrides.AutonomyCeiling = ov["autonomyCeiling"].Value<string>() ?? "";
                    if (ov["a2uiMode"] != null) rec.SettingsOverrides.A2uiMode = ov["a2uiMode"].Value<string>() ?? "";
                }
                rec.UpdatedAt = DateTime.UtcNow.ToString("o");
                SaveManifestLocked(rec);
                SaveRegistryLocked();
                return (200, rec.ToPublicJson());
            }
        }

        public (int status, JObject body) DeleteWorkspace(string id, string confirmName, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "trusted_channel_required",
                    ["message"] = "Deleting a workspace requires the trusted channel (Named Pipe or native confirmation)."
                });
            }
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, id, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                if (!string.Equals((confirmName ?? "").Trim(), rec.Name, StringComparison.Ordinal)) {
                    return (400, new JObject {
                        ["error"] = "confirm_name_mismatch",
                        ["message"] = $"Type the exact workspace name '{rec.Name}' to confirm deletion."
                    });
                }

                // Remove ONLY Sanctum's internal workspace data directory — NEVER touch rec.RootPath
                string wsDataDir = Path.Combine(_workspacesRoot, rec.Id);
                if (Directory.Exists(wsDataDir)) {
                    Directory.Delete(wsDataDir, true);
                }
                _workspaces.Remove(rec);
                if (_workspaces.Count == 0) {
                    CreateDefaultScratchLocked();
                } else if (string.Equals(_lastUsedWorkspaceId, rec.Id, StringComparison.OrdinalIgnoreCase)) {
                    _lastUsedWorkspaceId = _workspaces.FirstOrDefault(w => !w.Archived)?.Id ?? _workspaces[0].Id;
                    SaveRegistryLocked();
                } else {
                    SaveRegistryLocked();
                }

                return (200, new JObject {
                    ["ok"] = true,
                    ["deletedWorkspaceId"] = rec.Id,
                    ["userFolderUntouched"] = true,
                    ["lastUsedWorkspaceId"] = _lastUsedWorkspaceId
                });
            }
        }

        public JObject LoadUiState(string workspaceId) {
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, workspaceId, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return null;
                string uiFile = Path.Combine(GetWorkspaceDataDir(rec.Id), "ui_state.json");
                if (!File.Exists(uiFile)) {
                    return new JObject {
                        ["workspaceId"] = rec.Id,
                        ["activeSessionId"] = "",
                        ["splitSessionId"] = "",
                        ["viewerTabs"] = new JArray(),
                        ["expandedTreePaths"] = new JArray(),
                        ["projects"] = new JArray()
                    };
                }
                try {
                    return JObject.Parse(File.ReadAllText(uiFile, Utf8NoBom));
                } catch {
                    return new JObject { ["workspaceId"] = rec.Id };
                }
            }
        }

        public (int status, JObject body) SaveUiState(string workspaceId, JObject state) {
            lock (_lock) {
                var rec = _workspaces.FirstOrDefault(w => string.Equals(w.Id, workspaceId, StringComparison.OrdinalIgnoreCase));
                if (rec == null) return (404, new JObject { ["error"] = "Workspace not found." });
                var safeState = state != null ? (JObject)state.DeepClone() : new JObject();
                safeState["workspaceId"] = rec.Id;
                safeState["updatedAt"] = DateTime.UtcNow.ToString("o");
                string uiFile = Path.Combine(GetWorkspaceDataDir(rec.Id), "ui_state.json");
                string tmp = uiFile + ".tmp." + Guid.NewGuid().ToString("N").Substring(0, 6);
                File.WriteAllText(tmp, safeState.ToString(Formatting.Indented), Utf8NoBom);
                WindowsAclHelper.ApplyUserOnlyFileAcl(tmp);
                File.Copy(tmp, uiFile, true);
                try { File.Delete(tmp); } catch { }
                WindowsAclHelper.ApplyUserOnlyFileAcl(uiFile);
                return (200, safeState);
            }
        }
    }
}
