# ADR 0102: Request Lifecycle Status & Interaction Performance Thresholds

**Date:** 2026-10-25  
**Status:** PROPOSED (Pre-set before measurement under AMENDMENT 1)  
**Decides:** Empirical budgets, timings, and contract schemas for live prompt lifecycle status and UI micro-interactions.

---

## 1. Context & Motivation

Under **AMENDMENT 1** (authorized by project owner in `docs/MASTER_PROMPT.md`), Sanctum is authorized to introduce new interactive and live status elements that provide transparent, honest, real-time feedback during every phase of prompt processing.

Per standing rules, all performance budgets, latency ceilings, and timeout thresholds must be explicitly codified in an ADR **before** implementation and measurement.

---

## 2. Pinned Thresholds & Budgets

| Metric / Check | Pre-Set Threshold | Rational & Safety Margin |
| :--- | :--- | :--- |
| **Send Acknowledgment Latency** | **$p95 \le 100\text{ ms}$** | Optimistic render of user message + immediate "Sending" phase indicator before network response. |
| **Silent Gap / Stall Detection** | **$5.0\text{ seconds}$** | If no token or SSE event is received from core engine for $\ge 5.0\text{s}$, the UI transitions to `stalled` state with `[Wait]` and `[Stop]` controls. |
| **Status Render Frame Rate** | **Max 60 FPS (RAF batched)** | Token updates and metrics are batched per `requestAnimationFrame` to eliminate DOM churn and layout shifts. |
| **Cumulative Layout Shift (CLS)** | **$\text{CLS} \le 0.01$** | Status pill uses fixed min-height geometry to prevent jitter while streaming tokens. |
| **Idle CPU Budget** | **$< 2.0\%$ average** | When no prompt is active, status elements must consume 0.0% CPU (no continuous infinite CSS animations while idle). |
| **Bundle Size Overhead** | **$< 15\text{ KB}$ gzip** | Total JavaScript/CSS added for the status components and state machine. |
| **Settings Gating** | **100% toggleable** | Settings > Interface provides `showRequestStatus` toggle to completely revert to standard minimal layout. |

---

## 3. Event Schema Contract

The core emits typed Server-Sent Events conforming to:
```typescript
interface RequestStatusEvent {
  request_id: string;
  thread_id: string;
  message_id: string;
  phase: RequestPhase;
  timestamp: number;
  elapsed_ms: number;
  progress?: { current: number; total: number; unit?: string; percentage?: number };
  detail?: string;
  stats?: { tokens_per_second?: number; tokens_generated?: number };
}
```

---

## 4. Legal Phase Transitions

Valid phase sequences enforced by the core state machine:
- `sending` $\to$ `queued` $\mid$ `loading_model` $\mid$ `reading_message` $\mid$ `error`
- `queued` $\to$ `loading_model` $\mid$ `reading_message` $\mid$ `cancelled`
- `loading_model` $\to$ `reading_message` $\mid$ `cancelled` $\mid$ `error`
- `reading_message` $\to$ `searching_documents` $\mid$ `thinking` $\mid$ `using_tool` $\mid$ `writing_answer`
- `searching_documents` $\to$ `thinking` $\mid$ `writing_answer` $\mid$ `error`
- `thinking` $\to$ `using_tool` $\mid$ `writing_answer` $\mid$ `stopped`
- `using_tool` $\to$ `waiting_approval` $\mid$ `writing_answer`
- `waiting_approval` $\to$ `using_tool` $\mid$ `writing_answer`
- `writing_answer` $\to$ `stalled` $\mid$ `finishing` $\mid$ `stopped` $\mid$ `error`
- `stalled` $\to$ `writing_answer` $\mid$ `stopped`
- `finishing` $\to$ `done`

---

## 5. Decision & Verification Mandate

1. Adopt the thresholds specified above.
2. Verify contract compliance with a typed test suite (`tests/request_status_contract.test.ts`).
3. Wire the status state machine into `core/ai` and the UI presentation components.
4. Record all results in `docs/REVIEW_QUEUE.md`.
