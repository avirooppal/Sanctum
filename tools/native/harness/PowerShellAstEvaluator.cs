using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management.Automation.Language;
using System.Text.RegularExpressions;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 2.1: PowerShell AST-based command safety evaluator.
    /// Parses commands with System.Management.Automation.Language.Parser, resolves aliases,
    /// detects Invoke-Expression/iex, -EncodedCommand, call operators, dynamic invocation,
    /// here-strings, subexpressions, cmd /c wrappers, redirections, and out-of-scope paths.
    /// Unparseable or dynamic commands fail closed (deny or ask).
    /// </summary>
    public static class PowerShellAstEvaluator {
        private static readonly Dictionary<string, string> BuiltinAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["iex"] = "invoke-expression",
            ["icm"] = "invoke-command",
            ["iwr"] = "invoke-webrequest",
            ["irm"] = "invoke-restmethod",
            ["curl"] = "invoke-webrequest",
            ["wget"] = "invoke-webrequest",
            ["saps"] = "start-process",
            ["start"] = "start-process",
            ["rm"] = "remove-item",
            ["del"] = "remove-item",
            ["erase"] = "remove-item",
            ["rd"] = "remove-item",
            ["ri"] = "remove-item",
            ["rmdir"] = "remove-item",
            ["mv"] = "move-item",
            ["mi"] = "move-item",
            ["move"] = "move-item",
            ["cp"] = "copy-item",
            ["cpi"] = "copy-item",
            ["copy"] = "copy-item",
            ["sc"] = "set-content",
            ["ac"] = "add-content",
            ["sp"] = "set-itemproperty",
            ["sv"] = "set-variable",
            ["sal"] = "set-alias",
            ["cat"] = "get-content",
            ["gc"] = "get-content",
            ["type"] = "get-content",
            ["ls"] = "get-childitem",
            ["dir"] = "get-childitem",
            ["gci"] = "get-childitem",
            ["pwd"] = "get-location",
            ["gl"] = "get-location",
            ["sls"] = "select-string",
            ["echo"] = "write-output",
            ["write"] = "write-output"
        };

        private static readonly HashSet<string> HardDenyCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "invoke-expression",
            "invoke-command",
            "format-volume",
            "clear-disk",
            "stop-computer",
            "restart-computer",
            "shutdown",
            "shutdown.exe",
            "format",
            "format.com",
            "diskpart",
            "diskpart.exe",
            "bcdedit",
            "bcdedit.exe",
            "vssadmin",
            "vssadmin.exe",
            "cipher",
            "cipher.exe",
            "mshta",
            "mshta.exe",
            "certutil",
            "certutil.exe",
            "bitsadmin",
            "bitsadmin.exe",
            "rundll32",
            "rundll32.exe",
            "wscript",
            "wscript.exe",
            "cscript",
            "cscript.exe",
            "reg",
            "reg.exe",
            "add-type"
        };

        private static readonly HashSet<string> ShellWrapperCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe", "bash", "bash.exe", "wsl", "wsl.exe", "sh"
        };

        private static readonly HashSet<string> ReadOnlyAllowCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "get-childitem",
            "get-content",
            "get-location",
            "select-string",
            "test-path",
            "write-output",
            "measure-object",
            "select-object"
        };

        private static readonly HashSet<string> ReadOnlyGitSubcommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "status", "log", "diff", "branch", "show", "rev-parse", "ls-files", "describe", "tag"
        };

        private static readonly Regex EncodedParamRegex = new Regex(
            @"^[-/](?:e|ec|en|enc|enco|encod|encode|encoded|encodedc|encodedco|encodedcom|encodedcomm|encodedcomma|encodedcomman|encodedcommand)$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static string ResolveAlias(string cmdName) {
            if (string.IsNullOrWhiteSpace(cmdName)) return "";
            string clean = cmdName.Trim().Replace("`", "");
            if (BuiltinAliases.TryGetValue(clean, out string resolved)) return resolved;
            return clean.ToLowerInvariant();
        }

        public static (string action, string reason) Evaluate(string command, string workspaceRoot = null) {
            string raw = (command ?? "").Trim();
            if (string.IsNullOrEmpty(raw)) return ("deny", "Empty command.");

            Token[] tokens;
            ParseError[] errors;
            ScriptBlockAst ast;
            try {
                ast = Parser.ParseInput(raw, out tokens, out errors);
            } catch (Exception ex) {
                return ("ask", "PowerShell AST parser failed: " + ex.Message);
            }

            if (errors != null && errors.Length > 0) {
                return ("ask", "Unparseable PowerShell syntax requires explicit approval: " + errors[0].Message);
            }

            // 1. Detect here-strings (often used to hide payloads)
            var hereStrings = ast.FindAll(node =>
                node is StringConstantExpressionAst sc &&
                (sc.StringConstantType == StringConstantType.DoubleQuotedHereString ||
                 sc.StringConstantType == StringConstantType.SingleQuotedHereString), true).ToList();
            if (hereStrings.Count > 0) {
                return ("ask", "Here-string payload requires explicit user approval.");
            }
            var expandableHereStrings = ast.FindAll(node =>
                node is ExpandableStringExpressionAst esc &&
                esc.StringConstantType == StringConstantType.DoubleQuotedHereString, true).ToList();
            if (expandableHereStrings.Count > 0) {
                return ("ask", "Expandable here-string payload requires explicit user approval.");
            }

            // 2. Detect dynamic invocation: subexpressions $(...), scriptblocks, member/type static invocations
            bool hasSubExpression = ast.FindAll(node => node is SubExpressionAst || node is ArrayExpressionAst, true).Any();
            bool hasMemberInvoke = ast.FindAll(node => node is InvokeMemberExpressionAst, true).Any();
            bool hasRedirection = ast.FindAll(node => node is RedirectionAst, true).Any();
            bool hasAssignment = ast.FindAll(node => node is AssignmentStatementAst, true).Any();

            // Check redirections for hard-blocked paths or workspace escape
            foreach (RedirectionAst redir in ast.FindAll(node => node is RedirectionAst, true)) {
                if (redir is FileRedirectionAst fileRedir) {
                    string targetText = fileRedir.Location?.Extent?.Text?.Trim('"', '\'') ?? "";
                    if (IsHardBlockedTarget(targetText)) {
                        return ("deny", "Redirection to hard-blocked system or credential path is forbidden.");
                    }
                }
            }

            var commands = ast.FindAll(node => node is CommandAst, true).Cast<CommandAst>().ToList();
            if (commands.Count == 0) {
                if (hasMemberInvoke) {
                    return ("ask", "Dynamic .NET/member invocation requires explicit approval.");
                }
                return ("ask", "Non-command PowerShell expression requires explicit approval.");
            }

            bool allReadOnlySafe = !hasSubExpression && !hasMemberInvoke && !hasRedirection && !hasAssignment;
            var pipelines = ast.FindAll(node => node is PipelineAst, true).Cast<PipelineAst>().ToList();
            if (pipelines.Count > 1) {
                allReadOnlySafe = false;
            }

            foreach (var cmdAst in commands) {
                // Call operator (& or .)
                if (cmdAst.InvocationOperator == TokenKind.Ampersand || cmdAst.InvocationOperator == TokenKind.Dot) {
                    return ("ask", "Call operator (& or .) dynamic invocation requires explicit approval.");
                }

                string rawNameExtent = cmdAst.CommandElements.Count > 0 ? (cmdAst.CommandElements[0].Extent?.Text ?? "") : "";
                string parsedName = cmdAst.GetCommandName();

                // Dynamic command name (e.g., $x, ("i"+"ex"), etc.)
                if (string.IsNullOrWhiteSpace(parsedName)) {
                    return ("ask", "Dynamic or computed command name requires explicit approval.");
                }

                // Backtick obfuscation in command name (e.g. i`e`x, r`m)
                bool hasBacktickObfuscation = rawNameExtent.Contains("`");
                string resolved = ResolveAlias(parsedName);

                if (HardDenyCommands.Contains(resolved)) {
                    return ("deny", $"Blocked by host AST safety rule: '{resolved}' is forbidden.");
                }

                // Check for shell wrapper commands (cmd /c, powershell -enc, etc.)
                if (ShellWrapperCommands.Contains(resolved)) {
                    // Check for -EncodedCommand or /c
                    foreach (var elem in cmdAst.CommandElements.Skip(1)) {
                        string txt = (elem.Extent?.Text ?? "").Trim('"', '\'');
                        if (EncodedParamRegex.IsMatch(txt)) {
                            return ("deny", "Encoded PowerShell commands (-EncodedCommand) are hard-blocked.");
                        }
                        if (string.Equals(txt, "/c", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(txt, "/k", StringComparison.OrdinalIgnoreCase)) {
                            return ("ask", "Nested shell wrapper (cmd /c) requires explicit approval.");
                        }
                    }
                    return ("ask", $"Nested shell invocation ('{resolved}') requires explicit approval.");
                }

                if (hasBacktickObfuscation) {
                    return ("ask", "Backtick-obfuscated command requires explicit approval.");
                }

                // Inspect arguments for -EncodedCommand, hard-blocked paths, workspace escape, destructive flags
                bool hasRecurse = false;
                bool hasForce = false;
                bool hasRunAs = false;
                var argTexts = new List<string>();

                foreach (var elem in cmdAst.CommandElements.Skip(1)) {
                    string txt = (elem.Extent?.Text ?? "").Trim('"', '\'');
                    argTexts.Add(txt);

                    if (EncodedParamRegex.IsMatch(txt)) {
                        return ("deny", "Encoded PowerShell commands (-EncodedCommand) are hard-blocked.");
                    }
                    if (elem is CommandParameterAst cp) {
                        string pname = (cp.ParameterName ?? "").ToLowerInvariant();
                        if (pname == "recurse" || pname == "r") hasRecurse = true;
                        if (pname == "force" || pname == "fo") hasForce = true;
                        if (pname == "verb" && cp.Argument != null &&
                            string.Equals(cp.Argument.Extent?.Text?.Trim('"', '\''), "runas", StringComparison.OrdinalIgnoreCase)) {
                            hasRunAs = true;
                        }
                    }
                    if (string.Equals(txt, "runas", StringComparison.OrdinalIgnoreCase)) hasRunAs = true;

                    if (IsHardBlockedTarget(txt)) {
                        return ("deny", "Command references hard-blocked system or credential path.");
                    }

                    if (!string.IsNullOrWhiteSpace(workspaceRoot) && LooksLikeOutOfScopePath(txt, workspaceRoot)) {
                        allReadOnlySafe = false;
                    }
                }

                // Block elevation via Start-Process -Verb RunAs
                if (resolved == "start-process" && hasRunAs) {
                    return ("deny", "Elevated process execution (RunAs) is hard-blocked.");
                }

                // Block destructive recursive delete on root/drive/wildcard
                if (resolved == "remove-item" && (hasRecurse || hasForce)) {
                    foreach (string a in argTexts) {
                        if (a == "/" || a == "\\" || a == "C:\\" || a == "C:/" || a == "*" || a.StartsWith("..\\") || a.StartsWith("../")) {
                            return ("deny", "Recursive/forced delete targeting root or parent directory is hard-blocked.");
                        }
                    }
                }

                // Block network downloaders in Offline mode
                if ((resolved == "invoke-webrequest" || resolved == "invoke-restmethod") && EgressHttpFactory.IsOfflineMode) {
                    return ("deny", "Network commands are blocked while Offline mode is active.");
                }

                // Check read-only allowlist
                if (allReadOnlySafe) {
                    if (ReadOnlyAllowCommands.Contains(resolved)) {
                        continue;
                    }
                    if (resolved == "git" || resolved == "git.exe") {
                        string sub = argTexts.FirstOrDefault(a => !a.StartsWith("-")) ?? "";
                        if (!ReadOnlyGitSubcommands.Contains(sub)) {
                            allReadOnlySafe = false;
                        }
                        continue;
                    }
                    if ((resolved == "node" || resolved == "python" || resolved == "dotnet" || resolved == "npm") &&
                        argTexts.Count == 1 && (argTexts[0] == "--version" || argTexts[0] == "-v" || argTexts[0] == "-V")) {
                        continue;
                    }
                    allReadOnlySafe = false;
                }
            }

            if (allReadOnlySafe) {
                return ("allow", "AST-verified read-only command within scope.");
            }
            if (hasRedirection) {
                return ("ask", "Command with file redirection requires explicit user approval.");
            }
            if (hasSubExpression || hasMemberInvoke) {
                return ("ask", "Command with dynamic subexpression or member invocation requires explicit user approval.");
            }
            return ("ask", "Non-allowlisted shell command requires explicit user approval.");
        }

        private static bool IsHardBlockedTarget(string arg) {
            if (string.IsNullOrWhiteSpace(arg)) return false;
            string low = arg.Replace('/', '\\').ToLowerInvariant();
            if (low.Contains("\\windows\\system32") || low == "c:\\windows" || low.StartsWith("c:\\windows\\")) return true;
            if (low.Contains("\\.ssh") || low.Contains("\\.aws") || low.Contains("\\.gnupg") || low.Contains("\\.kube") || low.Contains("\\.azure")) return true;
            if (low.Contains("appdata\\roaming\\sanctum\\runtime.json")) return true;
            return false;
        }

        private static bool LooksLikeOutOfScopePath(string arg, string workspaceRoot) {
            if (string.IsNullOrWhiteSpace(arg) || arg.StartsWith("-")) return false;
            if (arg.Contains("..")) return true;
            if (arg.StartsWith("\\\\") || arg.StartsWith("//") || arg.StartsWith("~")) return true;
            if (arg.StartsWith("$env:", StringComparison.OrdinalIgnoreCase)) return true;
            if (Path.IsPathRooted(arg)) {
                try {
                    string root = Path.GetFullPath(workspaceRoot).TrimEnd(Path.DirectorySeparatorChar);
                    string full = Path.GetFullPath(arg).TrimEnd(Path.DirectorySeparatorChar);
                    bool inside = full.Equals(root, StringComparison.OrdinalIgnoreCase) ||
                                  full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
                    return !inside;
                } catch {
                    return true;
                }
            }
            return false;
        }
    }
}
