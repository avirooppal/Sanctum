using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    public sealed class ProviderCapabilities {
        [JsonProperty("tools")] public bool Tools { get; set; } = true;
        [JsonProperty("vision")] public bool Vision { get; set; }
        [JsonProperty("thinking")] public bool Thinking { get; set; } = true;
        [JsonProperty("structuredOutput")] public bool StructuredOutput { get; set; } = true;
        [JsonProperty("contextLength")] public int ContextLength { get; set; } = 32768;
    }

    public sealed class ProviderToolCall {
        [JsonProperty("id")] public string Id { get; set; } = "";
        [JsonProperty("name")] public string Name { get; set; } = "";
        [JsonProperty("arguments")] public JObject Arguments { get; set; } = new JObject();
    }

    public sealed class ProviderTurnResult {
        public string Content { get; set; } = "";
        public string Reasoning { get; set; } = "";
        public List<ProviderToolCall> ToolCalls { get; set; } = new List<ProviderToolCall>();
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
    }

    public interface IModelProvider {
        string Name { get; }
        ProviderCapabilities GetCapabilities(string model);
        ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct);
    }

    /// <summary>
    /// Deterministic scripted model provider for Phase 1a golden-transcript, cancellation,
    /// budget, loop-detection, and crash-recovery tests.
    /// </summary>
    public sealed class MockModelProvider : IModelProvider {
        private readonly JObject _script;

        public MockModelProvider(string scriptPath = null) {
            if (!string.IsNullOrEmpty(scriptPath) && File.Exists(scriptPath)) {
                _script = JObject.Parse(File.ReadAllText(scriptPath));
            } else {
                _script = new JObject();
            }
        }

        public string Name => "mock";

        public ProviderCapabilities GetCapabilities(string model) => new ProviderCapabilities {
            Tools = true,
            Vision = false,
            Thinking = true,
            StructuredOutput = true,
            ContextLength = 32768
        };

        public ProviderTurnResult StreamChat(
            string model,
            List<JObject> messages,
            JArray tools,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct) {
            ct.ThrowIfCancellationRequested();

            string lastUser = "";
            int toolResultsCount = 0;
            foreach (var m in messages) {
                string role = m["role"]?.Value<string>() ?? "";
                if (role == "user") lastUser = m["content"]?.Value<string>() ?? "";
                if (role == "tool") toolResultsCount++;
            }

            // Custom script override by scenario key or turn array
            if (_script["turns"] is JArray scriptTurns && toolResultsCount < scriptTurns.Count) {
                return ReplayTurn((JObject)scriptTurns[toolResultsCount], onReasoningDelta, onContentDelta, ct);
            }

            // Built-in deterministic scenarios keyed by prompt directive for golden & stress tests
            if (lastUser.IndexOf("[MOCK:SLOW]", StringComparison.OrdinalIgnoreCase) >= 0) {
                var result = new ProviderTurnResult { PromptTokens = 20 };
                for (int i = 0; i < 40; i++) {
                    ct.ThrowIfCancellationRequested();
                    string chunk = $"tok{i} ";
                    onContentDelta(chunk);
                    result.Content += chunk;
                    result.CompletionTokens++;
                    Thread.Sleep(50);
                }
                return result;
            }

            if (lastUser.IndexOf("[MOCK:LOOP]", StringComparison.OrdinalIgnoreCase) >= 0) {
                onContentDelta("Checking again...");
                return new ProviderTurnResult {
                    Content = "Checking again...",
                    PromptTokens = 16,
                    CompletionTokens = 4,
                    ToolCalls = new List<ProviderToolCall> {
                        new ProviderToolCall {
                            Id = "call_loop_" + toolResultsCount,
                            Name = "echo",
                            Arguments = new JObject { ["text"] = "same-arg" }
                        }
                    }
                };
            }

            if (lastUser.IndexOf("[MOCK:MAX_STEPS]", StringComparison.OrdinalIgnoreCase) >= 0) {
                onContentDelta($"Step {toolResultsCount + 1}.");
                return new ProviderTurnResult {
                    Content = $"Step {toolResultsCount + 1}.",
                    PromptTokens = 16,
                    CompletionTokens = 4,
                    ToolCalls = new List<ProviderToolCall> {
                        new ProviderToolCall {
                            Id = "call_step_" + toolResultsCount,
                            Name = "echo",
                            Arguments = new JObject { ["text"] = "unique-" + toolResultsCount }
                        }
                    }
                };
            }

            if (lastUser.IndexOf("[MOCK:BIG_BLOB]", StringComparison.OrdinalIgnoreCase) >= 0) {
                if (toolResultsCount == 0) {
                    return new ProviderTurnResult {
                        PromptTokens = 18,
                        CompletionTokens = 6,
                        ToolCalls = new List<ProviderToolCall> {
                            new ProviderToolCall {
                                Id = "call_blob_1",
                                Name = "big_output",
                                Arguments = new JObject { ["sizeBytes"] = 24576 }
                            }
                        }
                    };
                }
                string finalMsg = "Large output stored in blob.";
                onContentDelta(finalMsg);
                return new ProviderTurnResult { Content = finalMsg, PromptTokens = 30, CompletionTokens = 6 };
            }

            if (lastUser.IndexOf("[MOCK:TOOL]", StringComparison.OrdinalIgnoreCase) >= 0) {
                if (toolResultsCount == 0) {
                    onReasoningDelta("Need to call echo tool first.");
                    return new ProviderTurnResult {
                        Reasoning = "Need to call echo tool first.",
                        PromptTokens = 24,
                        CompletionTokens = 10,
                        ToolCalls = new List<ProviderToolCall> {
                            new ProviderToolCall {
                                Id = "call_echo_1",
                                Name = "echo",
                                Arguments = new JObject { ["text"] = "hello-harness" }
                            }
                        }
                    };
                }
                string doneText = "Tool returned: hello-harness.";
                foreach (string part in new[] { "Tool ", "returned: ", "hello-harness." }) {
                    ct.ThrowIfCancellationRequested();
                    onContentDelta(part);
                }
                return new ProviderTurnResult {
                    Content = doneText,
                    PromptTokens = 40,
                    CompletionTokens = 8
                };
            }

            // Default deterministic response
            string reply = "Mock reply to: " + lastUser;
            string[] pieces = reply.Split(' ');
            for (int i = 0; i < pieces.Length; i++) {
                ct.ThrowIfCancellationRequested();
                string piece = (i == 0 ? "" : " ") + pieces[i];
                onContentDelta(piece);
            }
            return new ProviderTurnResult {
                Content = reply,
                PromptTokens = Math.Max(8, lastUser.Length / 4),
                CompletionTokens = pieces.Length
            };
        }

        private static ProviderTurnResult ReplayTurn(
            JObject turn,
            Action<string> onReasoningDelta,
            Action<string> onContentDelta,
            CancellationToken ct) {
            var res = new ProviderTurnResult {
                PromptTokens = turn["promptTokens"]?.Value<int>() ?? 16,
                CompletionTokens = turn["completionTokens"]?.Value<int>() ?? 8
            };
            int delayMs = turn["delayMs"]?.Value<int>() ?? 0;

            if (turn["reasoningDeltas"] is JArray rDeltas) {
                foreach (var d in rDeltas) {
                    ct.ThrowIfCancellationRequested();
                    string s = d.Value<string>() ?? "";
                    onReasoningDelta(s);
                    res.Reasoning += s;
                    if (delayMs > 0) Thread.Sleep(delayMs);
                }
            }
            if (turn["contentDeltas"] is JArray cDeltas) {
                foreach (var d in cDeltas) {
                    ct.ThrowIfCancellationRequested();
                    string s = d.Value<string>() ?? "";
                    onContentDelta(s);
                    res.Content += s;
                    if (delayMs > 0) Thread.Sleep(delayMs);
                }
            }
            if (turn["toolCalls"] is JArray calls) {
                foreach (JObject c in calls) {
                    res.ToolCalls.Add(new ProviderToolCall {
                        Id = c["id"]?.Value<string>() ?? ("call_" + Guid.NewGuid().ToString("N").Substring(0, 8)),
                        Name = c["name"]?.Value<string>() ?? "",
                        Arguments = c["arguments"] as JObject ?? new JObject()
                    });
                }
            }
            return res;
        }
    }
}
