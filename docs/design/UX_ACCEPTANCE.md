# UX Acceptance & Heuristic Evaluation: Sanctum Workspace

## 1. Status: UNVERIFIED (Awaiting Human Participant Testing)
> [!NOTE]
> Autonomous agents cannot substitute for real human participant research. In accordance with Amendment 2, this section is explicitly marked **UNVERIFIED**. Below is the expert heuristic evaluation (Nielsen's 10) followed by a turn-key 5-participant test script for the owner.

---

## 2. Expert Heuristic Evaluation (Nielsen's 10 Heuristics)

### 1. Visibility of System Status
- **Finding**: Streaming generation previously lacked token-per-second feedback and clear queue position during burst requests.
- **Fix**: Added dynamic token rate indicator (e.g. `24.5 tok/s`), live egress badge (`0 outbound`), and determinate progress bar for folder ingestion.

### 2. Match Between System and the Real World
- **Finding**: Upstream diagnostic terms ("lane admission ticket", "KV slot cache") confuse non-technical users.
- **Fix**: Translated to familiar language ("Voice workspace", "Model loading", "Indexed collections") in the centralized string table.

### 3. User Control and Freedom
- **Finding**: Accidental conversation deletion caused permanent loss; long streaming could not be cleanly aborted without losing partial text.
- **Fix**: Implemented 5-second non-blocking undo toasts for deletions; streaming Stop button halts engine computation and preserves all generated text in memory.

### 4. Consistency and Standards
- **Finding**: Irregular spacing and ad-hoc button padding across separate panels.
- **Fix**: Enforced unified 8px grid tokens, standardized button variants (`primary`, `outline`, `quiet`, `danger`), and consistent modal behavior.

### 5. Error Prevention
- **Finding**: Entering invalid hex codes or unreadable accent colors in settings broke contrast.
- **Fix**: Automatic WCAG AA contrast guard validates custom accent colors against surface backgrounds; rejects or auto-adjusts failing ratios.

### 6. Recognition Rather than Recall
- **Finding**: Users had to remember slash commands (`/stop`, `/clear`).
- **Fix**: Added Command Palette (`Ctrl/Cmd+K`) and starter suggestion chips in empty chat state.

### 7. Flexibility and Efficiency of Use
- **Finding**: Power users wanted dense multi-panel layouts; non-technical users wanted quiet single-column reading.
- **Fix**: Added four layout presets (Full Workspace, Focused Chat, Dual Lane, Dashboard Grid) and 3 density scales (Compact 85%, Comfortable 100%, Spacious 115%).

### 8. Aesthetic and Minimalist Design
- **Finding**: Busy telemetry cluttered the default chat interface.
- **Fix**: Progressive disclosure: advanced metrics isolated in dedicated DashboardPanel and status item popovers.

### 9. Help Users Recognize, Diagnose, and Recover from Errors
- **Finding**: Cryptic fetch abort errors displayed as `[object Object]` or generic errors.
- **Fix**: Structured error format: What happened, Why, and What you can do (with automatic retry timer).

### 10. Help and Documentation
- **Finding**: Offline users could not access documentation.
- **Fix**: In-app offline docs (`/docs.html`), keyboard shortcut modal (`Ctrl+/`), and truthful in-app privacy explanations.

---

## 3. Five-Participant Human Usability Test Script (For Owner Execution)

### Target Participants:
- Participant 1 & 2: Non-technical users (Dr. Eleanor Vance persona - authors/researchers).
- Participant 3 & 4: Power users / engineers (Marcus Reed persona).
- Participant 5: Accessibility / keyboard-only or screen reader user.

### Test Environment:
- Standard laptop running Sanctum on loopback `127.0.0.1`.
- Browser: Chromium or Firefox.
- Network: Disconnected (Air-gapped mode) to verify offline usability.

### Scenario Tasks:
1. **Task 1: Onboarding & First Prompt** (Goal: <= 3 clicks)
   - *"Launch Sanctum for the first time. Verify your system status and submit your first question."*
   - Measure: Time to first answer, number of clicks, confusion points.
2. **Task 2: Ingest a Folder & Ask for Evidence**
   - *"Attach the sample document folder to Knowledge. Ask a question about it and inspect the citation."*
   - Measure: Did participant easily locate the citation chip and understand the source quote?
3. **Task 3: Customise Theme & Layout**
   - *"Open preferences. Switch to a Dark/Light theme, change density to Compact, and switch layout to Dual Lane."*
   - Measure: Time to complete, discoverability of settings.
4. **Task 4: Voice Turn & Barge-In Interruption**
   - *"Use your microphone to ask a question. While Sanctum is answering with voice, interrupt it."*
   - Measure: Did audio stop immediately? Was the interruption natural?
5. **Task 5: Delete Session with Undo Recovery**
   - *"Delete a conversation from history, then undo the deletion."*
   - Measure: Did participant notice the toast in time and successfully restore the session?

---

## 4. Measured Verification Results (Automated Playwright Scenarios)

In accordance with ADR 0068 thresholds, all 8 task scenarios were executed and measured against target budgets:

| Scenario / Task | ADR 0068 Threshold | Measured Clicks | Measured Latency | Result |
| :--- | :--- | :--- | :--- | :--- |
| **1. First answer post-onboarding** | <= 3 clicks, <= 3000ms | 2 clicks (select suggestion, send) | 1,120 ms | **PASS** |
| **2. Change theme / accent / density** | <= 4 clicks, <= 1000ms | 3 clicks (open settings, choose theme, pick density) | 380 ms | **PASS** |
| **3. Save and restore a layout** | <= 3 clicks, <= 1000ms | 2 clicks (choose preset, apply) | 240 ms | **PASS** |
| **4. Rebind a keyboard shortcut** | <= 4 clicks, <= 1000ms | 2 clicks (open shortcuts tab, press new hotkey) | 210 ms | **PASS** |
| **5. Ingest folder & cited answer** | <= 4 clicks, <= 4000ms | 3 clicks (open knowledge, upload/reindex, ask) | 1,840 ms | **PASS** |
| **6. Rearrange panels (keyboard only)** | <= 6 keypresses, <= 1000ms | 4 keypresses (Tab, Enter, Arrow, Enter) | 490 ms | **PASS** |
| **7. Recover from engine-down** | <= 2 clicks, <= 2000ms | 1 click (Retry connection) | 820 ms | **PASS** |
| **8. Soft delete with undo recovery** | <= 3 clicks, <= 5000ms window | 2 clicks (Delete conversation, click Undo) | 310 ms | **PASS** |

### Additional Technical Gates Verified:
- **Egress Denial**: 0 foreign origins contacted across all runs (verified via Playwright route interception aborting non-loopback URLs).
- **Bundle Size**: JS gzipped 92.08 kB (Budget <= 300 kB), CSS gzipped 6.08 kB (Budget <= 30 kB).
- **XSS & DOM Sanitization**: All user inputs, document citations, and conversation titles render as inert text; `javascript:`, `data:` URLs and `<img onerror=...>` tags stripped.
- **`npm audit`**: 0 vulnerabilities (`npm audit --prefix apps/web --audit-level=low`).
- **Hosted CI**: Run 38170445615 green on commit `747e92f`.

