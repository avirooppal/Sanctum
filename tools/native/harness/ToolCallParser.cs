using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Model tool-call parser, ID normalizer, alias mapper, and tolerant JSON repair engine.
    /// Verified in CI against the shared TypeScript oracle fixture corpus (core/ai/tools/parse_calls.ts).
    /// </summary>
    public static class ToolCallParser {
        private static readonly Dictionary<string, string> Aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["readfile"] = "read_file",
            ["read_file"] = "read_file",
            ["readfilerange"] = "read_file_range",
            ["read_file_range"] = "read_file_range",
            ["searchfiles"] = "search_files",
            ["search_files"] = "search_files",
            ["grep"] = "search_files",
            ["find_in_files"] = "search_files",
            ["createfile"] = "create_file",
            ["create_file"] = "create_file",
            ["writefile"] = "create_file",
            ["write_file"] = "create_file",
            ["editfile"] = "edit_file",
            ["edit_file"] = "edit_file",
            ["applypatch"] = "apply_patch",
            ["apply_patch"] = "apply_patch",
            ["patchfile"] = "apply_patch",
            ["listdir"] = "list_directory",
            ["listdirectory"] = "list_directory",
            ["list_directory"] = "list_directory",
            ["ls"] = "list_directory",
            ["createdir"] = "create_directory",
            ["createdirectory"] = "create_directory",
            ["create_directory"] = "create_directory",
            ["mkdir"] = "create_directory",
            ["movefile"] = "move_path",
            ["movepath"] = "move_path",
            ["move_path"] = "move_path",
            ["rename"] = "move_path",
            ["deletefile"] = "delete_path",
            ["deletepath"] = "delete_path",
            ["delete_path"] = "delete_path",
            ["rm"] = "delete_path",
            ["undolastaction"] = "undo_last_action",
            ["undo_last_action"] = "undo_last_action",
            ["undo"] = "undo_last_action",
            ["vaultsearch"] = "vault_search",
            ["vault_search"] = "vault_search",
            ["search_vault"] = "vault_search",
            ["memorysave"] = "memory_save",
            ["memory_save"] = "memory_save",
            ["save_memory"] = "memory_save",
            ["remember"] = "memory_save",
            ["memoryrecall"] = "memory_recall",
            ["memory_recall"] = "memory_recall",
            ["recall_memory"] = "memory_recall",
            ["search_memory"] = "memory_recall",
            ["calc"] = "calculator",
            ["calculator"] = "calculator",
            ["datetime"] = "datetime",
            ["get_time"] = "datetime",
            ["executecommand"] = "run_command",
            ["execute_command"] = "run_command",
            ["runshell"] = "run_command",
            ["run_shell"] = "run_command",
            ["shell"] = "run_command",
            ["runcommand"] = "run_command",
            ["run_command"] = "run_command"
        };

        private static readonly Regex StripFenceOpen = new Regex(@"^```(?:json)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex StripFenceClose = new Regex(@"\s*```$", RegexOptions.Compiled);
        private static readonly Regex TrailingComma = new Regex(@",\s*([}\]])", RegexOptions.Compiled);
        private static readonly Regex QwenTag = new Regex(@"<tool_call>([\s\S]*?)</tool_call>", RegexOptions.Compiled);
        private static readonly Regex LlamaBlock = new Regex(@"\[TOOL_CALLS\]\s*(\[[\s\S]*?\])", RegexOptions.Compiled);

        public static string NormalizeToolName(string rawName) {
            if (string.IsNullOrEmpty(rawName)) return "unknown_tool";
            string cleaned = rawName.Trim();
            string key = cleaned.ToLowerInvariant().Replace("-", "").Replace("_", "");
            if (Aliases.TryGetValue(key, out string mapped)) return mapped;
            if (Aliases.TryGetValue(cleaned.ToLowerInvariant(), out string mapped2)) return mapped2;
            return cleaned;
        }

        public static string RepairJsonString(string input) {
            if (input == null) return "";
            string s = input.Trim();
            s = StripFenceOpen.Replace(s, "");
            s = StripFenceClose.Replace(s, "").Trim();

            if (s.StartsWith("{") || s.StartsWith("[")) {
                s = TrailingComma.Replace(s, "$1");
                int openBraces = 0;
                int openBrackets = 0;
                bool inString = false;
                bool escaped = false;
                for (int i = 0; i < s.Length; i++) {
                    char ch = s[i];
                    if (escaped) { escaped = false; continue; }
                    if (ch == '\\') { escaped = true; continue; }
                    if (ch == '"') { inString = !inString; continue; }
                    if (!inString) {
                        if (ch == '{') openBraces++;
                        else if (ch == '}') openBraces = Math.Max(0, openBraces - 1);
                        else if (ch == '[') openBrackets++;
                        else if (ch == ']') openBrackets = Math.Max(0, openBrackets - 1);
                    }
                }
                var sb = new StringBuilder(s);
                if (inString) sb.Append('"');
                while (openBrackets-- > 0) sb.Append(']');
                while (openBraces-- > 0) sb.Append('}');
                s = TrailingComma.Replace(sb.ToString(), "$1");
            }
            return s;
        }

        public static (JObject args, string error) ParseArguments(JToken rawArgs) {
            if (rawArgs == null || rawArgs.Type == JTokenType.Null) return (new JObject(), null);
            if (rawArgs is JObject obj) return ((JObject)obj.DeepClone(), null);

            if (rawArgs.Type == JTokenType.String) {
                string trimmed = (rawArgs.Value<string>() ?? "").Trim();
                if (string.IsNullOrEmpty(trimmed) || trimmed == "{}" || trimmed == "null") {
                    return (new JObject(), null);
                }
                try {
                    var parsed = CanonicalJson.ParseObject(trimmed);
                    return (parsed, null);
                } catch {
                    try {
                        string repaired = RepairJsonString(trimmed);
                        var parsed = CanonicalJson.ParseObject(repaired);
                        return (parsed, null);
                    } catch (Exception ex) {
                        return (new JObject(), "Failed to parse arguments JSON: " + ex.Message);
                    }
                }
            }

            return (new JObject(), null);
        }

        public static List<ProviderToolCall> Parse(string content, JArray rawToolCalls, int turnId = 1) {
            var requests = new List<ProviderToolCall>();
            var seenIds = new HashSet<string>(StringComparer.Ordinal);

            void RegisterCall(string rawName, JToken rawArgs, string rawId) {
                int index = requests.Count;
                string name = NormalizeToolName(rawName);
                var (args, err) = ParseArguments(rawArgs);
                if (!string.IsNullOrEmpty(err)) {
                    args["_parseError"] = err;
                }
                string id = !string.IsNullOrWhiteSpace(rawId) ? rawId.Trim() : $"call_{turnId}_{index}";
                if (seenIds.Contains(id)) id = $"{id}_{index}";
                seenIds.Add(id);

                requests.Add(new ProviderToolCall {
                    Id = id,
                    Name = name,
                    Arguments = args
                });
            }

            // 1. Standard OpenAI / Ollama tool_calls array
            if (rawToolCalls != null && rawToolCalls.Count > 0) {
                foreach (var item in rawToolCalls) {
                    if (!(item is JObject raw)) continue;
                    var fn = raw["function"] as JObject;
                    string fnName = fn?["name"]?.Value<string>() ?? raw["name"]?.Value<string>();
                    JToken fnArgs = fn != null && fn["arguments"] != null ? fn["arguments"] : raw["arguments"];
                    if (!string.IsNullOrEmpty(fnName)) {
                        RegisterCall(fnName, fnArgs, raw["id"]?.Value<string>());
                    }
                }
            }

            // 2. Qwen XML <tool_call>...</tool_call>
            string text = content ?? "";
            if (text.Contains("<tool_call>")) {
                foreach (Match m in QwenTag.Matches(text)) {
                    try {
                        string repaired = RepairJsonString(m.Groups[1].Value);
                        var parsed = CanonicalJson.ParseObject(repaired);
                        string name = parsed["name"]?.Value<string>();
                        if (!string.IsNullOrEmpty(name)) {
                            RegisterCall(name, parsed["arguments"] ?? new JObject(), parsed["id"]?.Value<string>());
                        }
                    } catch { }
                }
            }

            // 3. Llama 3.x [TOOL_CALLS] [...]
            if (text.Contains("[TOOL_CALLS]")) {
                var m = LlamaBlock.Match(text);
                if (m.Success) {
                    try {
                        string repaired = RepairJsonString(m.Groups[1].Value);
                        var arr = JArray.Parse(repaired);
                        foreach (var el in arr) {
                            if (el is JObject item) {
                                string name = item["name"]?.Value<string>();
                                if (!string.IsNullOrEmpty(name)) {
                                    RegisterCall(name, item["arguments"] ?? new JObject(), item["id"]?.Value<string>());
                                }
                            }
                        }
                    } catch { }
                }
            }

            return requests;
        }
    }
}
