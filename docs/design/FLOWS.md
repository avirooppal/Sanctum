# User Flows Specification: Sanctum Workspace

This document defines the 9 core interactive flows required by Amendment 2. Each flow maps to a corresponding static SVG wireframe in `docs/design/wireframes/`.

---

## 1. Flow 1: First Run / Onboarding (`onboarding.svg`)
1. **Trigger**: User opens Sanctum for the first time (no stored preferences / fresh profile).
2. **Step 1: Hardware & Profile Detection**: Displays detected CPU/GPU, total RAM, and selects recommended profile (e.g., `4-thread CPU, 8GB RAM profile`).
3. **Step 2: Model Provisioning & Fit Estimate**: Shows installed reference model status or download progress bar with time estimate and Cancel button.
4. **Step 3: Verifiable Privacy Proof**: Runs live loopback egress self-test in real-time. Displays exact output: `0 outbound connections attempted • Loopback 127.0.0.1 bound • Egress PASS`.
5. **Step 4: Knowledge Folder Selection (Optional)**: Provides a quick folder dropzone or browse action to seed local knowledge.
6. **Step 5: First Prompt Launch**: Offers 3 starter prompts tailored to the selected model. User clicks or types; workspace opens with prompt pre-filled in <= 3 clicks.
7. **Persistence**: Sets onboarding completed flag; returning users bypass this flow directly to workspace.

---

## 2. Flow 2: Ask a Question with Documents & Citations (`document_qa_citations.svg`)
1. **Trigger**: User types a question requiring local document grounding in the Composer.
2. **Submission**: User presses `Enter`. Composer disables input and transitions to Streaming state.
3. **Retrieval**: Retrieval banner appears briefly (`Retrieving relevant sections from 3 indexed documents...`).
4. **Streaming Response**: Model streams answer tokens into the active Message. Virtualized list keeps smooth stick-to-bottom scroll.
5. **Citation Rendering**: Exact citation chips appear in the text body (e.g. `[Doc 1: trials.pdf #4]`).
6. **Inspection**: User clicks citation chip. An inspector drawer slides open on the right displaying the exact highlighted chunk excerpt and relevance score.
7. **Completion**: Stream finishes, Stop button morphs back to Send, token speed (e.g. `24.2 tok/s`) is noted in turn metadata.

---

## 3. Flow 3: Voice Conversation with Barge-In (`voice_barge_in.svg`)
1. **Trigger**: User clicks the Microphone icon in the Composer or presses `Ctrl+M`.
2. **Listening**: Audio visualizer pulses; Silero VAD detects user speech; incremental transcript appears live.
3. **Assistant Turn**: User pauses; assistant synthesizes and plays audio response via Flite/TTS while streaming text.
4. **Barge-In Interruption**: While assistant audio is playing, user speaks ("Wait, tell me more about...").
5. **Instant Cancel**: Gateway detects speech, immediately aborts TTS playback and running generation via ticket cancellation API.
6. **New Turn**: Assistant switches seamlessly to transcribing the user's new question and answers without UI stall.

---

## 4. Flow 4: Model Switching (`model_switching.svg`)
1. **Trigger**: User clicks active model badge in top bar (`Qwen 2.5 7B Q4_K_M`) or uses Command Palette.
2. **Model Picker Popover**: Displays available local models categorized by tier (Fast / Balanced / Large).
3. **Fit & Memory Preview**: Highlights memory footprint against system headroom (e.g. `4.8 GB RAM / 16 GB total - Fits Comfortably`).
4. **Selection**: User clicks desired model.
5. **Smooth Transition**: Status badge shows brief loading spinner (`Switching model...`); active session retains context; composer ready.

---

## 5. Flow 5: Attach & Ingest a Folder (`folder_ingest.svg`)
1. **Trigger**: User drops a folder into the Knowledge panel or Composer attachment area.
2. **Validation**: Files are screened (.md, .pdf, .txt; size <= 10MiB). Unsupported files are cleanly listed with clear reasons.
3. **Ingestion Progress**: Determinate progress bar showing `Ingesting: 14/42 chunks processed (33%)`.
4. **Cancel Capability**: User can click "Cancel Ingestion" at any time; processed chunks are safely retained or rolled back cleanly.
5. **Completion**: Ingested collection updates in Knowledge panel with chunk count and total token count.

---

## 6. Flow 6: Settings & Customisation (`settings_customisation.svg`)
1. **Trigger**: User clicks Settings cog or presses `Ctrl+,`.
2. **Tabs**:
   - **Appearance**: Theme selection (16 presets + Custom JSON), Dark/Light/System mode, Accent Color picker with WCAG AA contrast guard indicator (`Contrast: 5.4:1 - WCAG AA Pass`), Interface Density (Compact / Comfortable / Spacious), Font choice (bundled OFL fonts).
   - **Layouts**: Layout presets (Full Workspace, Focused Chat, Dual Lane, Dashboard Grid) and user saved layouts.
   - **Keyboard Shortcuts**: Rebindable table with conflict detection.
   - **Import/Export**: One-click JSON export of preferences and theme import.
3. **Live Preview**: Preferences apply live in the background without needing a page refresh.
4. **Server Persistence**: Automatically synchronizes to gateway SQLite `user_preferences`.

---

## 7. Flow 7: Destructive Action with Undo (`destructive_undo.svg`)
1. **Trigger**: User clicks Delete on a session in the History sidebar.
2. **Soft Delete**: Conversation is immediately removed from the active list (no jarring blocking modal for routine deletions).
3. **Undo Toast**: A prominent toast appears at bottom right: `Conversation "Trial Protocol Review" deleted. [Undo (5s)] [Dismiss]`.
4. **Undo Action**:
   - If user clicks **Undo**, session is instantly restored to the sidebar at its original position.
   - If 5s timer expires without action, soft delete is committed permanently.
5. **Irreversible Exception (Full Purge)**: Triggering "Purge All Data" requires explicit typed confirmation (`type "DELETE ALL"`).

---

## 8. Flow 8: Error & Engine-Down States (`engine_down_error.svg`)
1. **Trigger**: Local daemon crashes, model worker restarts, or engine is under peak overload.
2. **Clear Diagnostics**: Status bar pill turns amber/red: `Engine offline - daemon restarting`.
3. **Composer State**: Composer disables input with a helpful prompt banner: `Engine is recovering (attempt 1/3). Reconnecting in 4s... [Retry Now]`.
4. **Automatic Recovery**: Shell polls capability/health endpoint with backoff. Once healthy, state restores cleanly without lost conversation drafts.

---

## 9. Flow 9: Mobile Layouts (`mobile_layout.svg`)
1. **Trigger**: Viewport width <= 640px (e.g. 390px iPhone viewport).
2. **Layout Adaptation**:
   - Left sidebar collapses into an accessible slide-over drawer triggered by a hamburger button.
   - Composer docks to the bottom with 44px minimum touch targets.
   - Top bar presents compact model indicator and drawer toggle.
   - Zero horizontal overflow.
