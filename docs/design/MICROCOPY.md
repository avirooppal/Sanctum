# Microcopy & Voice Guidelines: Sanctum Workspace

## 1. Brand Tone & Voice
Sanctum's voice is **plain, warm, calm, and specific**.
- **Plain**: Avoid engineering jargon where clear natural language works. Use "local hardware profile" instead of "CUDA compute capability descriptor"; "conversations" instead of "session DAG nodes".
- **Warm & Respectful**: Direct, helpful, reassuring, never condescending or robotic.
- **Specific**: Always provide exact numbers, filenames, and measurable parameters instead of vague hand-waving ("Indexed 14 chunks from protocol.pdf in 1.2s", not "Done!").

---

## 2. Truthful Privacy Microcopy
Sanctum forbids marketing hyperbole:
- ❌ **Forbidden**: "100% secure", "unbreakable privacy", "military-grade encryption", "trust us".
- ✅ **Required**: Truthful statements of what has actually been measured and verified:
  - `"On-device only • All computation local to 127.0.0.1"`
  - `"Egress test: 0 outbound connections attempted across all active surfaces"`
  - `"Air-gapped verification: Network adapters can be disconnected without loss of function"`
  - `"Vectors stored in local SQLite database (~/.sanctum/knowledge.db)"`

---

## 3. Structured Error Format
Every error message presented to the user must follow a consistent three-part structure:
```
[What happened]: Clear statement of the current failure.
[Why]: The immediate underlying technical reason in understandable terms.
[What you can do]: The exact remediation step or automatic recovery state.
```

### Examples:
- **Engine Crash / Overload**:
  - *What happened*: The local model stopped responding.
  - *Why*: Peak memory usage exceeded the current system profile during batch processing.
  - *What you can do*: Sanctum is automatically restarting the worker (attempt 1 of 3). Your draft is safe. Click [Retry Now] or switch to a lighter model profile.
- **Unsupported File Ingestion**:
  - *What happened*: "dataset.xlsx" could not be added to Knowledge.
  - *Why*: Sanctum currently parses plain text, Markdown, and PDF documents only.
  - *What you can do*: Export your table as a .csv or .md file, then drop it here again.
- **Microphone Permission Denied**:
  - *What happened*: Voice input could not start.
  - *Why*: The browser blocked microphone access for this origin (127.0.0.1).
  - *What you can do*: Click the lock or permissions icon in your browser address bar, enable Microphone, and try again.

---

## 4. Empty State Copy
Empty states must actively teach the user what to do next with actionable prompts:
- **New Conversation / Blank Chat**:
  - Title: *"Private Study"*
  - Subtitle: *"Ask a question, dictate your thoughts, or select an indexed document."*
  - Suggestions:
    - `"What are the key themes in my ingested clinical notes?"`
    - `"Summarize recent protocol updates"`
    - `"Type '/' to view commands or press Ctrl+K for quick actions"`
- **Knowledge Library (No documents indexed)**:
  - Title: *"Your Knowledge Library is empty"*
  - Subtitle: *"Drop folders or documents (.pdf, .md, .txt) here to give Sanctum private grounding for answers with verifiable citations."*
  - Action: `[Browse Folder]`
- **History List (No previous chats)**:
  - Subtitle: *"Conversations you start will appear here. They are saved locally on your device and follow you across LAN sessions."*

---

## 5. Single String Table Requirement
All user-facing strings must be imported from the centralized string table in `apps/web/src/ui/strings.ts`.
Zero hardcoded strings in React components or template HTML.
This ensures:
1. Complete i18n readiness.
2. Uniform tone and verified wording across panels.
3. Automated lint verification (`npm test` ensures no un-keyed strings exist in core UI elements).
