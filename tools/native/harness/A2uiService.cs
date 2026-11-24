using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 3b-2: Host-owned A2UI v0.9.1 structural validator, catalog allowlist enforcer,
    /// deterministic Markdown text flattener, and render_ui tool registration.
    /// UI is treated strictly as untrusted data — never code, never approvals, never direct tool execution.
    /// </summary>
    public static class A2uiService {
        public const string SupportedVersion = "0.9.1";
        public const int MaxPayloadBytes = 65536;
        public const int MaxComponents = 50;
        public const int MaxNestingDepth = 8;
        public const int MaxStringLength = 4096;
        public const int MaxDataModelBytes = 32768;
        public const int MaxSurfacesPerMessage = 3;
        public const int MaxDataUriBytes = 16384;

        private static readonly HashSet<string> AllowedComponents = new HashSet<string>(StringComparer.Ordinal) {
            "Column", "Row", "Card", "Text", "Button", "TextField", "Checkbox", "Select",
            "Table", "FileCard", "DiffSummary", "TodoList", "CodeBlock", "Citations", "TerminalOutput"
        };

        private static readonly Regex UnsafeSchemeRegex = new Regex(
            @"(?:javascript:|vbscript:|file://|data:text/html)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex ScriptTagRegex = new Regex(
            @"<\s*script\b|on(?:error|load|click|mouseover)\s*=",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static (bool ok, string code, string error, JObject sanitizedSurface, string markdownFallback) ValidateAndSanitize(
            JObject rawPayload,
            string workspaceRoot) {
            if (rawPayload == null) {
                return (false, "null_payload", "A2UI payload is null.", null, "");
            }

            string rawJson = rawPayload.ToString(Formatting.None);
            if (Encoding.UTF8.GetByteCount(rawJson) > MaxPayloadBytes) {
                return (false, "payload_too_large", $"A2UI payload exceeds {MaxPayloadBytes} bytes limit.", null, "");
            }

            string version = rawPayload["a2uiVersion"]?.Value<string>() ?? SupportedVersion;
            if (!string.Equals(version, SupportedVersion, StringComparison.Ordinal)) {
                return (false, "unsupported_version", $"Unsupported A2UI version '{version}'. Expected '{SupportedVersion}'.", null, "");
            }

            string surfaceId = (rawPayload["surfaceId"]?.Value<string>() ?? "").Trim();
            if (string.IsNullOrEmpty(surfaceId) || surfaceId.Length > 128) {
                return (false, "invalid_surface_id", "surfaceId must be a non-empty string <= 128 chars.", null, "");
            }

            var components = rawPayload["components"] as JArray;
            if (components == null || components.Count == 0) {
                return (false, "empty_components", "components must be a non-empty array.", null, "");
            }
            if (components.Count > MaxComponents) {
                return (false, "too_many_components", $"Surface exceeds maximum component count ({MaxComponents}).", null, "");
            }

            if (rawPayload["dataModel"] != null) {
                int dmBytes = Encoding.UTF8.GetByteCount(rawPayload["dataModel"].ToString(Formatting.None));
                if (dmBytes > MaxDataModelBytes) {
                    return (false, "data_model_too_large", $"dataModel exceeds {MaxDataModelBytes} bytes.", null, "");
                }
            }

            var sanitized = (JObject)SecretsRedactor.RedactToken(rawPayload.DeepClone());
            sanitized["a2uiVersion"] = SupportedVersion;

            var depthErr = ValidateDepthAndStrings(sanitized, 0);
            if (depthErr != null) {
                return (false, depthErr.Value.code, depthErr.Value.error, null, "");
            }

            var sanComps = sanitized["components"] as JArray;
            foreach (var item in sanComps) {
                if (!(item is JObject comp)) {
                    return (false, "invalid_component", "Each component must be an object.", null, "");
                }
                string cid = (comp["id"]?.Value<string>() ?? "").Trim();
                string ctype = (comp["type"]?.Value<string>() ?? "").Trim();
                if (string.IsNullOrEmpty(cid)) {
                    return (false, "missing_component_id", "Component missing id.", null, "");
                }
                if (!AllowedComponents.Contains(ctype)) {
                    return (false, "disallowed_component", $"Component type '{ctype}' is not in the Sanctum A2UI catalog allowlist.", null, "");
                }
                var props = comp["props"] as JObject;
                if (props == null) {
                    props = new JObject();
                    comp["props"] = props;
                }

                // Block password/secret input fields
                if (ctype == "TextField") {
                    string inputType = (props["inputType"]?.Value<string>() ?? props["type"]?.Value<string>() ?? "").ToLowerInvariant();
                    bool isSecret = props["secret"]?.Value<bool>() ?? false;
                    if (inputType == "password" || isSecret) {
                        return (false, "disallowed_secret_field", "Password and secret input fields are forbidden in A2UI surfaces.", null, "");
                    }
                }

                // Block remote images/media/fonts and unsafe URL schemes in all props
                foreach (var prop in props.Properties()) {
                    string pName = prop.Name.ToLowerInvariant();
                    string pVal = prop.Value.Type == JTokenType.String ? (prop.Value.Value<string>() ?? "") : "";
                    if (string.IsNullOrEmpty(pVal)) continue;

                    if (UnsafeSchemeRegex.IsMatch(pVal) || ScriptTagRegex.IsMatch(pVal)) {
                        return (false, "unsafe_content", $"Blocked unsafe scheme or script payload in property '{prop.Name}'.", null, "");
                    }
                    if ((pName == "src" || pName == "image" || pName == "avatar" || pName == "font" || pName == "media") &&
                        (pVal.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || pVal.StartsWith("https://", StringComparison.OrdinalIgnoreCase))) {
                        return (false, "remote_media_blocked", $"Remote media/image URL blocked in property '{prop.Name}' (local-only policy).", null, "");
                    }
                    if (pVal.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && pVal.Length > MaxDataUriBytes) {
                        return (false, "data_uri_too_large", $"Inline data: URI exceeds {MaxDataUriBytes} bytes.", null, "");
                    }
                }

                // Validate workspace-scoped paths on FileCard & Citations (never leak host FS; mark disabled if out-of-scope/missing)
                if (ctype == "FileCard" || ctype == "DiffSummary") {
                    string relPath = props["path"]?.Value<string>() ?? "";
                    bool validPath = false;
                    if (!string.IsNullOrWhiteSpace(workspaceRoot) && !string.IsNullOrWhiteSpace(relPath)) {
                        try {
                            string full = PermissionEngine.ResolveToolPath(workspaceRoot, relPath, allowRoot: false);
                            validPath = File.Exists(full);
                        } catch {
                            validPath = false;
                        }
                    }
                    props["pathValid"] = validPath;
                }
            }

            string md = FlattenToMarkdown(sanitized);
            return (true, "ok", "", sanitized, md);
        }

        private static (string code, string error)? ValidateDepthAndStrings(JToken tok, int depth) {
            if (depth > MaxNestingDepth) {
                return ("max_depth_exceeded", $"A2UI payload exceeds max nesting depth ({MaxNestingDepth}).");
            }
            if (tok.Type == JTokenType.String) {
                string s = tok.Value<string>() ?? "";
                if (s.Length > MaxStringLength) {
                    return ("string_too_long", $"String exceeds maximum length ({MaxStringLength} chars).");
                }
                if (ScriptTagRegex.IsMatch(s) || UnsafeSchemeRegex.IsMatch(s)) {
                    return ("unsafe_content", "Blocked unsafe script or URI scheme in A2UI string.");
                }
            } else if (tok is JObject obj) {
                foreach (var p in obj.Properties()) {
                    var err = ValidateDepthAndStrings(p.Value, depth + 1);
                    if (err != null) return err;
                }
            } else if (tok is JArray arr) {
                foreach (var item in arr) {
                    var err = ValidateDepthAndStrings(item, depth + 1);
                    if (err != null) return err;
                }
            }
            return null;
        }

        /// <summary>
        /// Deterministic A2UI -> Markdown flattener for CLI, logs, export, copy, search, and version-mismatch fallback.
        /// </summary>
        public static string FlattenToMarkdown(JObject surface) {
            if (surface == null) return "";
            var sb = new StringBuilder();
            string summary = surface["summaryText"]?.Value<string>();
            if (!string.IsNullOrWhiteSpace(summary)) {
                sb.AppendLine(summary.Trim());
                sb.AppendLine();
            }

            var comps = surface["components"] as JArray ?? new JArray();
            foreach (JObject c in comps) {
                string type = c["type"]?.Value<string>() ?? "";
                var p = c["props"] as JObject ?? new JObject();
                switch (type) {
                    case "Text": {
                        string txt = p["text"]?.Value<string>() ?? p["content"]?.Value<string>() ?? "";
                        string variant = (p["variant"]?.Value<string>() ?? "").ToLowerInvariant();
                        if (variant == "h1" || variant == "title") sb.AppendLine("# " + txt);
                        else if (variant == "h2" || variant == "subtitle") sb.AppendLine("## " + txt);
                        else if (!string.IsNullOrEmpty(txt)) sb.AppendLine(txt);
                        break;
                    }
                    case "Button": {
                        string label = p["label"]?.Value<string>() ?? "Action";
                        sb.AppendLine($"[{label}]");
                        break;
                    }
                    case "TextField": {
                        string label = p["label"]?.Value<string>() ?? "Field";
                        string val = p["value"]?.Value<string>() ?? p["placeholder"]?.Value<string>() ?? "";
                        sb.AppendLine($"- **{label}**: {val}");
                        break;
                    }
                    case "Table": {
                        var cols = p["columns"] as JArray;
                        var rows = p["rows"] as JArray;
                        if (cols != null && cols.Count > 0) {
                            sb.AppendLine("| " + string.Join(" | ", cols.ToObject<List<string>>()) + " |");
                            sb.AppendLine("| " + string.Join(" | ", System.Linq.Enumerable.Repeat("---", cols.Count)) + " |");
                            if (rows != null) {
                                foreach (var r in rows) {
                                    if (r is JArray ra) {
                                        var cells = new List<string>();
                                        foreach (var cell in ra) cells.Add(cell?.ToString() ?? "");
                                        sb.AppendLine("| " + string.Join(" | ", cells) + " |");
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case "TodoList": {
                        var items = p["items"] as JArray;
                        if (items != null) {
                            foreach (JObject it in items) {
                                bool done = string.Equals(it["status"]?.Value<string>(), "done", StringComparison.OrdinalIgnoreCase) ||
                                            (it["done"]?.Value<bool>() ?? false);
                                sb.AppendLine($"- [{(done ? "x" : " ")}] {it["title"]?.Value<string>() ?? ""}");
                            }
                        }
                        break;
                    }
                    case "FileCard": {
                        string fp = p["path"]?.Value<string>() ?? "";
                        string desc = p["description"]?.Value<string>() ?? "";
                        sb.AppendLine($"- File: `{fp}`" + (string.IsNullOrEmpty(desc) ? "" : " — " + desc));
                        break;
                    }
                    case "DiffSummary": {
                        string fp = p["path"]?.Value<string>() ?? "";
                        int add = p["added"]?.Value<int>() ?? 0;
                        int del = p["removed"]?.Value<int>() ?? 0;
                        sb.AppendLine($"- Diff `{fp}` (+{add} -{del})");
                        break;
                    }
                    case "CodeBlock": {
                        string lang = p["language"]?.Value<string>() ?? "";
                        string code = p["code"]?.Value<string>() ?? "";
                        sb.AppendLine("```" + lang);
                        sb.AppendLine(code);
                        sb.AppendLine("```");
                        break;
                    }
                    case "TerminalOutput": {
                        string output = p["output"]?.Value<string>() ?? "";
                        sb.AppendLine("```text");
                        sb.AppendLine(output);
                        sb.AppendLine("```");
                        break;
                    }
                    case "Citations": {
                        var sources = p["sources"] as JArray;
                        if (sources != null) {
                            foreach (JObject src in sources) {
                                sb.AppendLine($"- Source: `{src["path"]?.Value<string>() ?? ""}` {src["excerpt"]?.Value<string>() ?? ""}");
                            }
                        }
                        break;
                    }
                }
            }
            return sb.ToString().Trim();
        }

        public static void RegisterTool(HarnessEngine engine) {
            engine.RegisterTool(new HarnessToolDescriptor {
                Name = "render_ui",
                Description = "Render a declarative A2UI v0.9.1 rich UI surface (tables, forms, file cards, todo lists, code blocks, diffs, citations) alongside a 1-2 sentence text summary.",
                Category = "ui",
                Safety = "read",
                InputSchema = new JObject {
                    ["type"] = "object",
                    ["properties"] = new JObject {
                        ["a2uiVersion"] = new JObject { ["type"] = "string" },
                        ["surfaceId"] = new JObject { ["type"] = "string" },
                        ["summaryText"] = new JObject { ["type"] = "string" },
                        ["components"] = new JObject { ["type"] = "array" },
                        ["dataModel"] = new JObject { ["type"] = "object" }
                    },
                    ["required"] = new JArray("surfaceId", "components")
                },
                Execute = (args, ct) => {
                    string ws = args["_workspace"]?.Value<string>() ?? "";
                    string sid = args["_sessionId"]?.Value<string>() ?? "";
                    var (ok, code, err, sanitized, md) = ValidateAndSanitize(args, ws);
                    if (!ok) {
                        if (!string.IsNullOrEmpty(sid)) {
                            engine.EmitA2uiSurfaceEvent(sid, new JObject {
                                ["a2uiVersion"] = SupportedVersion,
                                ["surfaceId"] = args["surfaceId"]?.Value<string>() ?? "invalid",
                                ["valid"] = false,
                                ["errorCode"] = code,
                                ["error"] = err,
                                ["fallbackToText"] = true
                            });
                        }
                        return new JObject { ["ok"] = false, ["code"] = code, ["error"] = err, ["fallbackToText"] = true }.ToString(Formatting.None);
                    }
                    if (!string.IsNullOrEmpty(sid)) {
                        engine.EmitA2uiSurfaceEvent(sid, new JObject {
                            ["a2uiVersion"] = SupportedVersion,
                            ["surfaceId"] = sanitized["surfaceId"],
                            ["summaryText"] = sanitized["summaryText"]?.Value<string>() ?? "",
                            ["valid"] = true,
                            ["surface"] = sanitized,
                            ["markdownFallback"] = md
                        });
                    }
                    return new JObject {
                        ["ok"] = true,
                        ["a2uiVersion"] = SupportedVersion,
                        ["surfaceId"] = sanitized["surfaceId"],
                        ["markdownFallback"] = md
                    }.ToString(Formatting.None);
                }
            });
        }
    }
}
