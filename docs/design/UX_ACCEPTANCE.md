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
