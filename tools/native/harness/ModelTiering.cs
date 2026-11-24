using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class ModelTierProfile {
        [JsonProperty("tier")] public string Tier { get; set; } = "standard";
        [JsonProperty("overridden")] public bool Overridden { get; set; }
        [JsonProperty("maxSteps")] public int MaxSteps { get; set; } = 12;
        [JsonProperty("allowSubagents")] public bool AllowSubagents { get; set; }
        [JsonProperty("useStructuredOutput")] public bool UseStructuredOutput { get; set; }
        [JsonProperty("maxTools")] public int MaxTools { get; set; } = 16;
        [JsonProperty("systemPromptStyle")] public string SystemPromptStyle { get; set; } = "standard";
        [JsonProperty("measuredPassRate")] public double? MeasuredPassRate { get; set; }
        [JsonProperty("measuredTasks")] public int MeasuredTasks { get; set; }
        [JsonProperty("measuredAt")] public string MeasuredAt { get; set; } = "";
    }

    /// <summary>
    /// Phase 3.3: Model-adaptive harness tiering & JSON repair fallback.
    /// Computes capability tier (minimal / standard / full) from live /api/show capabilities
    /// and measured local eval results (model_evals.json), overridable per session.
    /// </summary>
    public sealed class ModelTierManager {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private static readonly HashSet<string> MinimalToolAllowlist = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "list_directory", "read_file", "search_files", "create_file", "edit_file", "calculator"
        };

        private readonly string _evalsPath;
        private readonly object _lock = new object();

        public ModelTierManager(string appDataDir) {
            _evalsPath = Path.Combine(appDataDir, "model_evals.json");
        }

        public JObject LoadAllEvals() {
            lock (_lock) {
                if (!File.Exists(_evalsPath)) return new JObject();
                try { return CanonicalJson.ParseObject(File.ReadAllText(_evalsPath, Utf8NoBom)); }
                catch { return new JObject(); }
            }
        }

        public void SaveModelEval(string model, JObject evalSummary) {
            if (string.IsNullOrWhiteSpace(model) || evalSummary == null) return;
            lock (_lock) {
                var all = LoadAllEvals();
                all[model] = evalSummary;
                Directory.CreateDirectory(Path.GetDirectoryName(_evalsPath));
                File.WriteAllText(_evalsPath, all.ToString(Formatting.Indented), Utf8NoBom);
                WindowsAclHelper.ApplyUserOnlyFileAcl(_evalsPath);
            }
        }

        public ModelTierProfile ResolveTier(string model, ProviderCapabilities caps, string overrideTier = null) {
            var allEvals = LoadAllEvals();
            var evalRec = !string.IsNullOrWhiteSpace(model) ? allEvals[model] as JObject : null;
            double? passRate = evalRec?["passRate"]?.Value<double>();
            int tasks = evalRec?["totalTasks"]?.Value<int>() ?? 0;
            string measuredAt = evalRec?["measuredAt"]?.Value<string>() ?? "";

            string tier;
            bool overridden = false;
            string ov = (overrideTier ?? "").Trim().ToLowerInvariant();
            if (ov == "minimal" || ov == "standard" || ov == "full") {
                tier = ov;
                overridden = true;
            } else {
                bool hasTools = caps?.Tools ?? false;
                int ctx = caps?.ContextLength ?? 8192;
                bool hasThinking = caps?.Thinking ?? false;

                if (!hasTools || ctx <= 4096 || (passRate.HasValue && passRate.Value < 0.50)) {
                    tier = "minimal";
                } else if (ctx >= 16384 && (hasThinking || (passRate.HasValue && passRate.Value >= 0.75))) {
                    tier = "full";
                } else {
                    tier = "standard";
                }
            }

            if (tier == "minimal") {
                return new ModelTierProfile {
                    Tier = "minimal",
                    Overridden = overridden,
                    MaxSteps = 6,
                    AllowSubagents = false,
                    UseStructuredOutput = caps?.StructuredOutput ?? false,
                    MaxTools = MinimalToolAllowlist.Count,
                    SystemPromptStyle = "compact",
                    MeasuredPassRate = passRate,
                    MeasuredTasks = tasks,
                    MeasuredAt = measuredAt
                };
            }
            if (tier == "full") {
                return new ModelTierProfile {
                    Tier = "full",
                    Overridden = overridden,
                    MaxSteps = 24,
                    AllowSubagents = true,
                    UseStructuredOutput = caps?.StructuredOutput ?? true,
                    MaxTools = 64,
                    SystemPromptStyle = "full",
                    MeasuredPassRate = passRate,
                    MeasuredTasks = tasks,
                    MeasuredAt = measuredAt
                };
            }
            return new ModelTierProfile {
                Tier = "standard",
                Overridden = overridden,
                MaxSteps = 12,
                AllowSubagents = false,
                UseStructuredOutput = caps?.StructuredOutput ?? true,
                MaxTools = 24,
                SystemPromptStyle = "standard",
                MeasuredPassRate = passRate,
                MeasuredTasks = tasks,
                MeasuredAt = measuredAt
            };
        }

        public JArray FilterToolsForTier(JArray allTools, ModelTierProfile profile) {
            if (allTools == null) return new JArray();
            if (profile == null || profile.Tier == "full") return allTools;

            var filtered = new JArray();
            foreach (JObject t in allTools) {
                string name = t["name"]?.Value<string>() ?? "";
                if (profile.Tier == "minimal") {
                    if (MinimalToolAllowlist.Contains(name)) filtered.Add(t);
                } else {
                    if (!profile.AllowSubagents && string.Equals(name, "spawn_subagent", StringComparison.OrdinalIgnoreCase)) continue;
                    filtered.Add(t);
                }
            }
            return filtered;
        }

        /// <summary>
        /// Repairs common local-LLM malformed JSON (trailing commas, single-quoted keys/strings, missing closing brace).
        /// </summary>
        public static JObject RepairToolArgumentsJson(string raw) {
            if (string.IsNullOrWhiteSpace(raw)) return new JObject();
            string s = raw.Trim();
            try { return CanonicalJson.ParseObject(s); } catch { }

            // Strip markdown code fences if present
            if (s.StartsWith("```")) {
                int nl = s.IndexOf('\n');
                if (nl > 0) s = s.Substring(nl + 1);
                if (s.EndsWith("```")) s = s.Substring(0, s.Length - 3);
                s = s.Trim();
            }
            // Remove trailing commas before } or ]
            s = Regex.Replace(s, @",\s*([}\]])", "$1");
            // Replace single-quoted keys/values when no double quotes present
            if (!s.Contains("\"") && s.Contains("'")) {
                s = s.Replace('\'', '"');
            }
            // Balance unclosed braces
            int open = s.Count(c => c == '{');
            int close = s.Count(c => c == '}');
            if (open > close) s += new string('}', open - close);

            try { return CanonicalJson.ParseObject(s); }
            catch { return new JObject { ["raw"] = raw }; }
        }
    }
}
