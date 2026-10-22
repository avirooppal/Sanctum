"use client";

import React, { useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Globe2,
  Hand,
  MousePointer2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const AgentsScreen: React.FC = () => {
  const { models } = useAppStore();
  const [taskQuery, setTaskQuery] = useState(
    "Update the checkout button copy and verify the flow"
  );
  const [agentStatus, setAgentStatus] = useState<"waiting" | "running" | "paused" | "stopped">(
    "waiting"
  );
  const [isTechOpen, setIsTechOpen] = useState(false);

  const steps = [
    { title: "Opened localhost:3000", done: true },
    { title: "Clicked Checkout", done: true },
    { title: "Read the form labels", done: true },
    { title: agentStatus === "running" ? "Executing click command..." : "Waiting for confirmation", done: false, active: true },
  ];

  return (
    <main className="flex p-8 flex-col flex-1 gap-6 overflow-y-auto">
      <div className="grid flex-1 gap-8 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Side: Virtual Sandbox / Browser Canvas */}
        <section className="flex flex-col gap-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col flex-1 gap-2 min-w-[200px]">
              <label
                htmlFor="task"
                className="font-medium text-foreground text-sm"
              >
                Task
              </label>
              <Input
                id="task"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
                className="rounded-md bg-card border-input h-10"
              />
            </div>
            <div className="flex flex-col gap-2 w-56">
              <label className="font-medium text-foreground text-sm">
                Model
              </label>
              <Select defaultValue="llama">
                <SelectTrigger className="rounded-md bg-card border-input h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama">Ollama · Llama 3.2</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      Ollama · {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge className="rounded-md bg-muted text-muted-foreground mb-2">
              Local / Offline
            </Badge>
          </div>

          {/* Virtual Browser Window */}
          <div className="shadow-sm rounded-xl bg-card border border-border flex flex-col flex-1 min-h-[360px] overflow-hidden">
            <div className="border-b border-border flex px-5 items-center gap-3 h-12 bg-muted/20">
              <Globe2 className="text-muted-foreground size-4" />
              <span className="font-mono text-muted-foreground text-sm">
                localhost:3000
              </span>
            </div>
            <div className="bg-muted/30 flex p-8 justify-center items-center flex-1">
              <div className="shadow-xs rounded-lg bg-background border border-border flex p-12 flex-col justify-center items-center gap-8 size-full max-w-xl max-h-96 relative">
                <div className="flex flex-col items-center gap-2">
                  <h2 className="font-semibold text-foreground text-2xl">
                    Checkout
                  </h2>
                  <span className="text-muted-foreground text-sm">
                    Complete your order
                  </span>
                </div>
                <button
                  type="button"
                  className="font-medium shadow-xs rounded-md bg-primary text-primary-foreground text-sm px-6 py-3 cursor-default"
                >
                  Submit order
                </button>
                <MousePointer2
                  aria-label="Cursor marker"
                  className={cn(
                    "text-primary self-end size-5 transition-transform",
                    agentStatus === "running" && "animate-bounce"
                  )}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: What Sanctum is doing */}
        <section className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-accent text-accent-foreground flex justify-center items-center size-9">
                <Bot className="size-5" />
              </div>
              <h2 className="font-semibold text-card-foreground text-xl">
                What Sanctum is doing
              </h2>
            </div>

            <div className="flex mt-8 flex-col gap-6">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-center">
                  {step.done ? (
                    <div className="rounded-full bg-muted flex justify-center items-center shrink-0 size-5">
                      <Check className="text-muted-foreground size-3" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-background border-2 border-primary shrink-0 size-5 animate-pulse" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      step.done
                        ? "text-muted-foreground"
                        : "font-medium text-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex pt-8 flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setAgentStatus("running");
                setTimeout(() => setAgentStatus("waiting"), 3000);
              }}
              className="font-semibold shadow-xs rounded-md bg-primary text-primary-foreground text-base flex px-5 justify-center items-center gap-2 h-12 hover:bg-primary/90 transition-colors"
            >
              <Hand className="size-5" />
              <span>Confirm action</span>
            </button>
            <button
              type="button"
              onClick={() => setAgentStatus(agentStatus === "paused" ? "waiting" : "paused")}
              className="font-medium rounded-md bg-secondary text-secondary-foreground text-sm border border-border px-5 h-11 hover:bg-secondary/80 transition-colors"
            >
              {agentStatus === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => setAgentStatus("stopped")}
              className="font-medium rounded-md text-destructive text-sm border border-destructive px-5 h-11 hover:bg-destructive/10 transition-colors"
            >
              Stop agent
            </button>

            <button
              type="button"
              onClick={() => setIsTechOpen(!isTechOpen)}
              className="text-left text-muted-foreground text-sm flex pt-3 items-center gap-2 hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={cn("size-4 transition-transform", isTechOpen && "rotate-90")}
              />
              <span>Technical details</span>
            </button>
            {isTechOpen && (
              <div className="rounded-md bg-muted/50 text-muted-foreground text-xs border border-border p-3 font-mono space-y-1">
                <div>Action: `mouse_click(x=380, y=245)`</div>
                <div>Target: button#submit-order</div>
                <div>Status: Awaiting human confirmation</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="text-muted-foreground text-sm border-t border-border flex pt-5 justify-center items-center">
        Human approval required before the next action
      </footer>
    </main>
  );
};
