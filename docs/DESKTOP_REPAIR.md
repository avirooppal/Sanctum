# Desktop repair — 29 October 2026

The previous EXE used a different, incomplete backend from the Next.js development
server. Its DNS suppression blocked loopback connections, its microphone handler
denied all permissions, and some native endpoints returned placeholder chat,
download, and transcription results.

The desktop now shares one authenticated loopback transport for real streaming
Ollama requests. The bundled UI stays at its existing virtual origin, preserving
stored workspaces. Downloads call Ollama and require its explicit success event.
Model discovery lists runnable Ollama models, not arbitrary files on disk. Errors
are surfaced instead of leaving stale model selections or reporting success.

Attachments support local PDF and DOCX text extraction, alongside text/code and
images. Sent messages retain visible attachment names. The microphone uses the
installed Windows offline dictation recognizer and sends actual recognized text
to the composer. Stopping dictation or closing the window releases capture.

The installer checks only the destination installation for running processes and
rechecks after Retry. The launcher preserves arguments containing spaces, uses a
payload-derived build stamp, requests graceful shutdown before updating, and
reports extraction errors instead of silently launching an old version.

## Verification performed

- Actual WebView2 desktop window: onboarding, model discovery, streamed chat.
- Text attachment: the real model answered with a code available only in the file.
- PDF and DOCX attachments: the real model returned both codes from extracted files.
- Native microphone: started successfully and recognized speech reached the composer;
  stop was exercised. This is not an accuracy benchmark for every device/accent.
- Fresh `smollm2:135m` installation: real download, SHA verification, manifest creation,
  rediscovery, and real inference through the installed EXE.
- Silent setup into a directory containing spaces, followed by real backend tests.
- Direct `dist/Sanctum.exe` extraction and launch with a spaced profile directory.
- Authentication rejection, nonexistent-model errors, thread round-trip persistence,
  streaming parser regressions, TypeScript checking, architecture check, production build.
- Full suite: 196 passed, zero failures, four skipped checks requiring the optional
  llama.cpp oracle on port 18080. Real Ollama and installed-EXE checks passed separately.

Run the real backend gate after building:

```powershell
python tools/exe-verify/verify_core_flows.py --model qwen3:1.7b --pull-model qwen3:1.7b
```

This gate requires a running Ollama service and the selected model. It never substitutes
mock model output. It creates an isolated temporary profile and terminates only its own
test process. Older EXE checks that expected canned responses or zero API listeners do
not establish correctness of the repaired desktop.

Ollama and the WebView2 runtime remain prerequisites. Browser transcription still
requires the optional local speech service. Cloud-provider and MCP settings remain
experimental and are not part of the local chat dispatch path.


## Workspace tools and model switching

The desktop titlebar drag handler was intercepting plain div model options.
Options now use accessible buttons inside a no-drag region. Selection updates the
active chat immediately and is restored when returning to that chat. Assistant
messages record their answering model so switching does not relabel old answers.

Desktop chat now supports seven Ollama function tools: list_directory, read_file,
create_file, edit_file, create_directory, move_path, and delete_path. Authenticated
native handlers validate workspace-relative paths, reject reparse points/device
paths/alternate streams, and prevent overwrite on create. Delete moves to private
recoverable trash. A native folder picker grants access to a different workspace;
workspace IDs prevent a running call from silently changing its destination.

The chat controller streams model output, executes calls serially, returns real
results to the model, persists activity records, supports Stop, and limits loops.
The existing ordinary chat path stays available with Tools off. Models must support
Ollama tool calling; no arbitrary shell executor is included.

Verification includes native filesystem operations and containment checks in
`verify_core_flows.py`, streamed tool-loop/cancellation/error tests in
`tests/workspace_tools.test.ts`, and actual WebView2 UI operations in
`tools/exe-verify/verify_workspace_ui.cjs`. The UI test requires an isolated profile
with Qwen3 1.7B and SmolLM2 135M installed and CDP enabled at port 19222.
