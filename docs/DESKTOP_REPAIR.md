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
