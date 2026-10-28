"use client";

import React, { useState } from "react";
import { IconX, IconCopy, IconCheck, IconCode, IconCpu, IconLayersLinked, IconTerminal } from "@tabler/icons-react";
import type { InspectRecord } from "@core/ai/observability/inspect.ts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InspectRequestModalProps {
  record: InspectRecord | null;
  onClose: () => void;
}

export const InspectRequestModal: React.FC<InspectRequestModalProps> = ({ record, onClose }) => {
  const [activeTab, setActiveTab] = useState<"summary" | "prompt" | "raw" | "response">("summary");
  const [copied, setCopied] = useState<boolean>(false);

  if (!record) return null;

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    toast.success("Inspection payload copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const id = record.identity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <IconCode className="size-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Inspect Model Request</h2>
              <p className="text-[11px] font-mono text-muted-foreground">
                Message {record.messageId} â€¢ Trace {record.traceId.slice(0, 12)}â€¦
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopyRaw} className="h-7 text-xs">
              {copied ? <IconCheck size={14} className="text-emerald-400 mr-1" /> : <IconCopy size={14} className="mr-1" />}
              Copy JSON
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/10 px-6 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "summary"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Model Identity & Parameters
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "prompt"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Prompt Sections ({record.sections.length})
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "raw"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Engine Payload
          </button>
          <button
            onClick={() => setActiveTab("response")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "response"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Engine Response & Timings
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <IconCpu size={16} className="text-primary" />
                  <span>Model Ground Truth</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-muted-foreground font-mono text-[11px]">
                  <div><span className="text-foreground">Model Name:</span> {id?.model || "Unknown"}</div>
                  <div><span className="text-foreground">Engine:</span> {id?.engine || "Unknown"}</div>
                  <div><span className="text-foreground">Architecture:</span> {id?.family || "Unknown"}</div>
                  <div><span className="text-foreground">Parameters:</span> {id?.parameterSize || "Unknown"}</div>
                  <div><span className="text-foreground">Quantization:</span> {id?.quantization || "Unknown"}</div>
                  <div><span className="text-foreground">Context Length:</span> {id?.trainedContextLength || "Default"} tokens</div>
                  <div className="col-span-2 break-all">
                    <span className="text-foreground">Blob Digest (SHA256):</span> {id?.blobSha256 || "N/A"}
                  </div>
                  <div className="col-span-2 break-all">
                    <span className="text-foreground">Blob Path:</span> {id?.blobPath || "N/A"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <IconTerminal size={16} className="text-primary" />
                  <span>Invocation Context</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground font-mono text-[11px]">
                  <div><span className="text-foreground">Engine Endpoint:</span> {record.endpoint}</div>
                  <div><span className="text-foreground">Created At:</span> {record.createdAt}</div>
                  <div><span className="text-foreground">Full Content Captured:</span> {record.contentCaptured ? "Yes" : "No (hashes only)"}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="space-y-4">
              <div className="text-muted-foreground text-xs">
                Assembled prompt hierarchy partitioned by source role:
              </div>
              <div className="space-y-3">
                {record.sections.map((sec, idx) => (
                  <div key={idx} className="rounded-lg border border-border/60 bg-muted/15 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-semibold text-primary uppercase">{sec.kind}: {sec.label}</span>
                      <span className="text-muted-foreground">{sec.chars} chars</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-semibold mb-2">Message Turn Payloads:</div>
                <div className="space-y-2">
                  {record.messages.map((m, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded border border-border/40 font-mono text-[11px] whitespace-pre-wrap">
                      <span className="text-primary font-bold">[{m.role}]:</span> {m.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Exact request body dispatched to inference daemon:</div>
              <pre className="p-4 bg-muted/40 rounded-lg border border-border/60 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(record.requestBody, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "response" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="text-xs font-semibold">Engine Token Accounting</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div><span className="text-foreground">Prompt Tokens:</span> {record.response?.usage?.promptTokens ?? "N/A"}</div>
                  <div><span className="text-foreground">Completion Tokens:</span> {record.response?.usage?.completionTokens ?? "N/A"}</div>
                  <div><span className="text-foreground">Done Reason:</span> {record.response?.doneReason || "stop"}</div>
                  <div><span className="text-foreground">Answering Model:</span> {record.response?.engineModel || "N/A"}</div>
                </div>
              </div>

              {record.response?.timings && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-2 font-mono text-[11px]">
                  <div className="text-xs font-semibold font-sans">Engine Microsecond Timings</div>
                  <div>Total Duration: {record.response.timings.totalDurationNs ? `${(record.response.timings.totalDurationNs / 1e6).toFixed(2)} ms` : "N/A"}</div>
                  <div>Prompt Evaluation: {record.response.timings.promptEvalDurationNs ? `${(record.response.timings.promptEvalDurationNs / 1e6).toFixed(2)} ms` : "N/A"}</div>
                  <div>Generation Duration: {record.response.timings.evalDurationNs ? `${(record.response.timings.evalDurationNs / 1e6).toFixed(2)} ms` : "N/A"}</div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold">Final Concatenated Output</div>
                <div className="p-3 bg-muted/30 rounded border border-border/40 font-mono text-[11px] whitespace-pre-wrap">
                  {record.response?.text || "No response text captured"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
