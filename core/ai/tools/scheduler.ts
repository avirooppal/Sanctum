/**
 * Conflict-Aware Tool Scheduler & Concurrency Pool (Sanctum v2)
 *
 * Dispatches multiple tool calls with:
 * 1. Read-parallelization: pure reads of same or different resources run concurrently.
 * 2. Write-serialization: conflicting mutating operations on overlapping resources serialize in model order.
 * 3. Controlled concurrency pool (default 4, exec capped at 1).
 * 4. Deterministic result ordering matching original model call sequence.
 * 5. Cancellation and fail-fast isolation.
 */

import {
  type ToolCallRequest,
  type ToolExecutionResult,
  type ToolSpec,
  type MultiToolOptions,
  type ResourceKey,
} from "./types.ts";

export interface ScheduledTask {
  call: ToolCallRequest;
  spec?: ToolSpec;
  resources: ResourceKey[];
  isRead: boolean;
  status: "pending" | "running" | "completed" | "cancelled" | "skipped";
  result?: ToolExecutionResult;
}

export class ToolScheduler {
  private concurrency: number;
  private mode: "all-settled" | "fail-fast";

  constructor(options?: { concurrency?: number; mode?: "all-settled" | "fail-fast" }) {
    this.concurrency = Math.max(1, options?.concurrency ?? 4);
    this.mode = options?.mode ?? "all-settled";
  }

  /**
   * Normalizes and derives resource keys for a tool call.
   */
  public static extractResources(call: ToolCallRequest, spec?: ToolSpec): ResourceKey[] {
    if (spec?.resources) {
      try {
        return spec.resources(call.arguments);
      } catch {
        // fallback
      }
    }

    const args = call.arguments || {};
    const res: ResourceKey[] = [];

    // Auto-detect standard workspace paths
    const rawPath = args.path || args.filePath || args.target;
    if (typeof rawPath === "string") {
      const norm = rawPath.replace(/\\/g, "/").replace(/^\.\//, "");
      const isDir = args.action === "mkdir" || args.action === "list" || call.name.includes("directory");
      res.push(`${isDir ? "dir" : "file"}:${norm}`);
    }

    const destPath = args.destination || args.dest;
    if (typeof destPath === "string") {
      const normDest = destPath.replace(/\\/g, "/").replace(/^\.\//, "");
      res.push(`file:${normDest}`);
    }

    if (call.name === "shell" || spec?.safety === "exec") {
      res.push("proc:shell");
    }

    if (spec?.safety === "network" || args.url || args.host) {
      res.push(`net:${args.host || "global"}`);
    }

    if (res.length === 0) {
      // Default resource keyed by tool name if none declared
      res.push(`tool:${call.name}`);
    }

    return res;
  }

  /**
   * Two resource keys conflict if either is a write and their target paths or descriptors overlap.
   */
  public static doResourcesConflict(
    resA: ResourceKey,
    isReadA: boolean,
    resB: ResourceKey,
    isReadB: boolean
  ): boolean {
    // Two reads never conflict
    if (isReadA && isReadB) return false;

    // Direct identical key conflict
    if (resA === resB) return true;

    // Process-level locks always conflict with each other
    if (resA === "proc:shell" && resB === "proc:shell") return true;

    // Hierarchical directory vs file overlap (e.g. dir:src conflicts with file:src/a.ts)
    const [typeA, pathA] = resA.split(":");
    const [typeB, pathB] = resB.split(":");

    if ((typeA === "file" || typeA === "dir") && (typeB === "file" || typeB === "dir")) {
      if (pathA === pathB) return true;
      if (pathA === "." || pathB === ".") return true; // root conflicts with children on mutating operations
      if (pathA.startsWith(pathB + "/") || pathB.startsWith(pathA + "/")) return true;
    }

    return false;
  }

  /**
   * Check if a candidate task conflicts with any currently active running tasks.
   */
  public static conflictsWithRunning(candidate: ScheduledTask, running: ScheduledTask[]): boolean {
    for (const active of running) {
      for (const resCand of candidate.resources) {
        for (const resActive of active.resources) {
          if (
            ToolScheduler.doResourcesConflict(
              resCand,
              candidate.isRead,
              resActive,
              active.isRead
            )
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Execute multiple tool calls respecting resource locks, concurrency limits,
   * error isolation, and cancellation.
   */
  public async scheduleAndRun(
    calls: ToolCallRequest[],
    specs: Map<string, ToolSpec>,
    runner: (call: ToolCallRequest, spec?: ToolSpec, signal?: AbortSignal) => Promise<ToolExecutionResult>,
    options?: MultiToolOptions
  ): Promise<ToolExecutionResult[]> {
    if (!calls.length) return [];

    const effectiveConcurrency = options?.concurrency ?? this.concurrency;
    const effectiveMode = options?.mode ?? this.mode;
    const parentSignal = options?.signal;

    // 1. Prepare scheduled tasks
    const tasks: ScheduledTask[] = calls.map((c, idx) => {
      const spec = specs.get(c.name);
      const isRead = spec?.parallelSafe === true && spec?.safety === "read";
      const resources = ToolScheduler.extractResources(c, spec);
      return {
        call: { ...c, index: c.index ?? idx },
        spec,
        resources,
        isRead,
        status: "pending",
      };
    });

    const running = new Set<ScheduledTask>();
    const completed = new Map<string, ToolExecutionResult>();
    let hasFailed = false;

    // AbortController tree for fail-fast or parent cancellation
    const batchAbortController = new AbortController();
    if (parentSignal) {
      if (parentSignal.aborted) {
        batchAbortController.abort();
      } else {
        parentSignal.addEventListener("abort", () => batchAbortController.abort(), { once: true });
      }
    }

    return new Promise<ToolExecutionResult[]>((resolve) => {
      const checkDone = () => {
        if (completed.size === tasks.length) {
          // Reassemble results in exact original call index order
          const sorted = tasks.map((t) => {
            const res = completed.get(t.call.id);
            if (res) return res;
            return {
              id: t.call.id,
              toolName: t.call.name,
              name: t.call.name,
              status: "cancelled" as const,
              ok: false,
              output: "",
              content: "",
              exitCode: 130,
              durationMs: 0,
              error: { code: "cancelled" as const, message: "Execution cancelled" },
            };
          });
          resolve(sorted);
        }
      };

      const pump = () => {
        // If aborted, cancel remaining pending
        if (batchAbortController.signal.aborted) {
          for (const t of tasks) {
            if (t.status === "pending") {
              t.status = "cancelled";
              const r: ToolExecutionResult = {
                id: t.call.id,
                toolName: t.call.name,
                name: t.call.name,
                status: "cancelled",
                ok: false,
                output: "",
                content: "",
                exitCode: 130,
                durationMs: 0,
                error: { code: "cancelled", message: "Batch was cancelled" },
              };
              completed.set(t.call.id, r);
              options?.onActivity?.({
                id: t.call.id,
                callId: t.call.id,
                name: t.call.name,
                index: t.call.index,
                arguments: t.call.arguments,
                status: "cancelled",
              });
            }
          }
          checkDone();
          return;
        }

        // If in fail-fast mode and a tool failed, skip remaining pending
        if (effectiveMode === "fail-fast" && hasFailed) {
          for (const t of tasks) {
            if (t.status === "pending") {
              t.status = "skipped";
              const r: ToolExecutionResult = {
                id: t.call.id,
                toolName: t.call.name,
                name: t.call.name,
                status: "skipped",
                ok: false,
                output: "",
                content: "",
                exitCode: 1,
                durationMs: 0,
                error: { code: "skipped", message: "Skipped due to prior tool failure" },
              };
              completed.set(t.call.id, r);
              options?.onActivity?.({
                id: t.call.id,
                callId: t.call.id,
                name: t.call.name,
                index: t.call.index,
                arguments: t.call.arguments,
                status: "cancelled",
              });
            }
          }
          checkDone();
          return;
        }

        // Find candidate tasks that are pending and don't conflict with earlier tasks
        for (let i = 0; i < tasks.length; i++) {
          if (running.size >= effectiveConcurrency) break;

          const candidate = tasks[i];
          if (candidate.status !== "pending") continue;

          // Check dependency: does candidate conflict with any earlier UNFINISHED task in the batch?
          let blockedByPreceding = false;
          for (let j = 0; j < i; j++) {
            const preceding = tasks[j];
            if (preceding.status !== "completed") {
              for (const resCand of candidate.resources) {
                for (const resPre of preceding.resources) {
                  if (
                    ToolScheduler.doResourcesConflict(
                      resCand,
                      candidate.isRead,
                      resPre,
                      preceding.isRead
                    )
                  ) {
                    blockedByPreceding = true;
                    break;
                  }
                }
                if (blockedByPreceding) break;
              }
            }
            if (blockedByPreceding) break;
          }

          if (blockedByPreceding) {
            // Cannot start yet; must wait for earlier conflicting task
            continue;
          }

          // Check if candidate conflicts with any currently running task
          if (ToolScheduler.conflictsWithRunning(candidate, Array.from(running))) {
            continue;
          }

          // Ready to run!
          candidate.status = "running";
          running.add(candidate);

          options?.onActivity?.({
            id: candidate.call.id,
            callId: candidate.call.id,
            name: candidate.call.name,
            index: candidate.call.index,
            arguments: candidate.call.arguments,
            status: "running",
          });

          // Launch runner asynchronously
          void (async (task: ScheduledTask) => {
            const t0 = Date.now();
            let result: ToolExecutionResult;
            try {
              result = await runner(task.call, task.spec, batchAbortController.signal);
            } catch (err: any) {
              result = {
                id: task.call.id,
                toolName: task.call.name,
                name: task.call.name,
                status: "error",
                ok: false,
                output: "",
                content: "",
                exitCode: 1,
                durationMs: Date.now() - t0,
                error: {
                  code: "internal",
                  message: err instanceof Error ? err.message : String(err),
                },
              };
            }

            task.status = "completed";
            task.result = result;
            running.delete(task);
            completed.set(task.call.id, result);

            if (!result.ok) {
              hasFailed = true;
              if (effectiveMode === "fail-fast") {
                batchAbortController.abort();
              }
            }

            options?.onActivity?.({
              id: task.call.id,
              callId: task.call.id,
              name: task.call.name,
              index: task.call.index,
              arguments: task.call.arguments,
              status: result.ok ? "success" : "error",
              output: result.output,
              durationMs: result.durationMs,
            });

            // Pump next ready tasks
            pump();
          })(candidate);
        }

        checkDone();
      };

      // Start initial wave
      pump();
    });
  }
}
