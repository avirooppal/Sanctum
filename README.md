<p align="center">
  <img src="public/logo.jpg" alt="Sanctum logo" width="112" height="112" />
</p>

<h1 align="center">Sanctum</h1>

<p align="center">
  A local AI workspace for conversations, projects, and documents.<br />
  <strong>Developer documentation · Windows desktop application</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#windows-desktop">Desktop</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#testing">Testing</a> ·
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

Sanctum connects to Ollama for on-device model inference. The interface is built
with Next.js, React, TypeScript, Tailwind CSS, and Zustand. The Windows release
packages the interface inside a native C# host using Microsoft Edge WebView2.

**Status: beta.** Local chat, model downloads, document attachments, and Windows
dictation are the supported desktop workflows. Cloud-provider settings, MCP,
and several legacy modules remain experimental; see [scope and limitations](#scope-and-limitations).

## Contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Windows desktop](#windows-desktop)
- [Development commands](#development-commands)
- [Architecture](#architecture)
- [Local API and configuration](#local-api-and-configuration)
- [Attachments and retrieval](#attachments-and-retrieval)
- [Voice input](#voice-input)
- [Storage and backups](#storage-and-backups)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Scope and limitations](#scope-and-limitations)
- [Documentation index](#documentation-index)

## Prerequisites

| Dependency | Needed for | Requirement |
| --- | --- | --- |
| Git | Source checkout | A working Git installation |
| Node.js and npm | Building the embedded desktop interface | Node.js **22.13+**; Node.js 24 was used for the latest desktop repair |
| Python | Architecture checks and Windows packaging | Python **3.10+** is the tested baseline |
| Ollama | Model discovery, downloads, and inference | Installed/started automatically by desktop setup |
| Microsoft Edge WebView2 Runtime | Running the Windows EXE | Installed automatically if missing |
| .NET Framework C# compiler | Building the Windows EXE | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` |
| Windows speech recognizer | Offline desktop dictation | Installed speech language and a working default microphone |

Running a packaged EXE does **not** require Node.js, npm, Python, or the C# compiler.
The checked-in WebView2 SDK assemblies are under `vendor/webview2/`; they do not
replace the installed WebView2 Runtime.

Model RAM, storage, and GPU requirements depend on the chosen model and context
size. Start with a smaller model if you are unsure of your machine's capacity.

## Quick start

1. Download [Sanctum.exe](dist/Sanctum.exe) (on GitHub, choose **Download raw file**).
2. Run it. The executable extracts and updates the desktop application automatically.
3. Click **Set up Sanctum** in the walkthrough. Sanctum installs or starts its local
   AI runtime, downloads Qwen3 1.7B if no chat model is installed, and verifies a real response.
4. Click **Start chatting**. Future launches automatically start the installed runtime.

No Node.js, Python, terminal commands, browser dashboard, or separate Ollama setup
is needed by the end user. First setup requires internet and several GB of disk
space. Windows may request installation permission. If setup is interrupted,
**Retry setup** retries installation and resumes model downloads through Ollama.
Missing WebView2 is installed in a native preparation screen before the walkthrough.

Downloads use official Microsoft and Ollama installers. Windows validates their
Authenticode signatures and publishers before execution. Existing working runtimes
and models are reused. Chat and file operations remain local after setup.

## Logs and system monitoring

- **Settings → Logs**: live entries, level/search filters, refresh, clear, export to
  a chosen file, and open the local log folder. Logs rotate at 2 MiB, retain one
  previous file, and do not record prompts, model responses, or document contents.
- **Settings → System monitor**: actual Windows CPU utilization, physical RAM,
  Sanctum host memory, free disk space, uptime, GPU identity, local engine state,
  and loaded-model memory/GPU allocations. Unsupported sensors show unavailable.
- **Repair runtime setup** reruns the same installation and model verification flow.

Runtime logs live in `%APPDATA%\Sanctum\logs\desktop.jsonl` (or the custom
`--data-dir`). Installer failures include a retryable error in the walkthrough.

## Windows desktop

### Run a packaged release

| Artifact | Usage |
| --- | --- |
| [Sanctum.exe](dist/Sanctum.exe) | Extract/update the desktop payload in the user's installation directory and launch it |
| [SHA-256 checksum](dist/SHA256SUMS) | Verify the downloaded EXE |

`Sanctum.exe` is the only file end users need. On GitHub, use **Download raw file**. The walkthrough prepares Ollama automatically; subsequent launches start it when needed.

To inspect a downloaded file's checksum:

```powershell
Get-FileHash .\dist\Sanctum.exe -Algorithm SHA256
```

Compare the result with the matching entry in `dist/SHA256SUMS`.

### Build the release from source

Run on Windows from the repository root:

```powershell
npm ci
python tools/build_installer.py
python tools/package_distribution.py
```

The first command installs frontend dependencies. The installer build compiles
Next.js, copies the bundled assets and PDF worker, compiles the native host and
uninstaller, and produces the installer and launcher. The packaging step creates
the portable ZIP, checksums, and dependency notices.

| Output | Purpose |
| --- | --- |
| `deploy/installer/build_payload/` | Generated desktop payload |
| `dist/` | Distributable EXEs, ZIP, checksums, and notices |
| `build/` | Ignored local build/test installations |

Source changes do not update an existing EXE automatically. Rebuild and test the
packaged application before distributing it. The supported pipeline uses the
C# WebView2 host; `src-tauri/` and the NSIS recipe are alternate references, not
steps invoked by the commands above.

See [Windows packaging](deploy/README.md) for more detail.

## Workspace file tools (Windows desktop)

Select a tool-capable Ollama model such as **Qwen3**, click **Choose folder** above
chat, and turn **Tools on**. The default folder is `%APPDATA%\Sanctum\workspace`.
The setting persists; turn it off for ordinary chat or models without tool support.

Try: `Create a notes.md file with a project checklist, then read it back.`

The model can list directories, read text files, create files/directories, replace
an exact unique text match, rename/move paths, and delete files or directories.
Each call shows its arguments, success/error status, and result in the conversation.
Follow-up tool results are returned to the model so it can verify its work.

- File paths stay within the chosen workspace; junctions, symlinks, device paths,
  and alternate streams are rejected.
- Creating a file never overwrites an existing file. Editing requires an exact,
  unique match. Read/create/edit limits are 1 MiB; listings return up to 200 entries.
- Deletion moves items to `%APPDATA%\Sanctum\tool-trash`. Each operation includes
  its recovery path; `restore.json` records the original location. Move the saved
  item back manually to restore it.
- A request is limited to 8 model rounds and 16 tool calls. Stop prevents subsequent
  calls; a filesystem operation already completed is not undone.
- This release provides file tools in the native Windows app. It does not execute
  arbitrary terminal commands. The workspace is available only inside the Windows desktop host.

Model selection is saved per chat. Switching chats restores their model; previous
answers retain the name of the model that generated them. The selector is disabled
while a response is running.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile assets for the embedded desktop interface |
| `npm run typecheck` | Run TypeScript checking without emitting files |
| `npm run lint` | Run the Python architecture/boundary checker; this is not ESLint |
| `npm run check-arch` | Invoke the same architecture checker directly |
| `npm test` | Run the explicitly listed Node test suites using native TypeScript stripping |

## Architecture

| Layer / path | Responsibility |
| --- | --- |
| `src/app/` | Next.js entry points and same-origin HTTP routes |
| `src/components/jan/JanAppShell.tsx` | Active application shell: onboarding, chat, projects, hub, and settings |
| `src/components/screens/` | Chat and other screen implementations |
| `src/store/slices/` | Zustand state and workflow orchestration |
| `src/lib/attachments.ts` | Local PDF, DOCX, and text extraction |
| `core/ai/` | Engine clients, stream parsing, prompts, retrieval, speech, and observability |
| `core/domain/` | Domain types and settings schema |
| `core/infra/` | Persistence and settings storage |
| `contracts/` | Shared types, constants, and validation contracts |
| `tools/compile_desktop_host.py` | C# host source and compiler driver |
| `tools/exe-verify/` | Packaged desktop verification utilities |
| `deploy/` | Installer assets and packaging documentation |
| `tests/` | Unit, contract, workflow, and live integration tests |
| `public/` | Branding, static assets, and the bundled PDF worker |

**Web request path:** React/Zustand → Next.js API route → local Ollama → streamed response.

**Desktop request path:** bundled UI at `https://sanctum.app` → injected fetch bridge
→ authenticated loopback API in the C# host → local Ollama → streamed response.

The desktop UI retains its virtual origin for workspace persistence. Its backend
uses real model responses and download progress rather than a parallel simulated
implementation. Windows dictation communicates through the native WebView2 bridge.

Keep rendering in the UI, AI/engine behavior in `core/ai`, and shared contracts in
`contracts`. The architecture gate checks selected boundary violations; it does
not replace runtime tests.

## Local API and configuration

Default service addresses:

| Service | Address |
| --- | --- |
| Next.js development server | `http://127.0.0.1:3000` |
| Ollama inference service | `http://127.0.0.1:11434` |
| Optional Whisper transcription service | `http://127.0.0.1:8000` |
| Desktop backend | Loopback port selected by the host; authenticated per launch |

The web routes live under `src/app/api/`. Key routes are:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/ollama/models` | Discover installed models and engine availability |
| `POST` | `/api/chat` | Forward chat requests and stream inference output |
| `POST` | `/api/ollama/pull` | Download a model through Ollama with progress |
| `GET`, `POST`, `DELETE` | `/api/settings` | Read, update, or reset settings |
| `POST` | `/api/audio/transcribe` | Send browser-recorded audio to the local speech service |

The desktop host implements its own routes, including thread persistence and
OpenAI-compatible chat forwarding. API operations require its per-launch token;
`/health` is available for readiness checks. The desktop API listener does not
serve the frontend as a public website.

Local chat uses the configured code defaults in `contracts/constants/`. Saving a
cloud provider in Settings does not currently change the active local chat dispatch
path. Do not assume every settings control represents a connected integration.

## Attachments and retrieval

- **Supported documents:** PDF with selectable text, DOCX, plain text, Markdown,
  JSON, CSV, and supported source-code formats.
- **Limit:** 10 MB per attachment in the chat composer.
- **Extraction:** PDF.js and Mammoth run locally; document bytes are not sent to
  a third-party extraction service.
- **Images:** require a compatible vision model to interpret their contents.
- **Scanned PDFs:** require OCR or an image-based workflow; text extraction alone
  cannot read a document consisting only of page images.
- **Retrieval:** text attachments enter the local document index. **My documents**
  retrieves passages from the active collection using deterministic hashed vectors.
  This is not a downloaded semantic embedding model.

If updating `pdfjs-dist`, keep `public/pdf.worker.min.mjs` aligned with the installed
version. The Windows packaging script refreshes it automatically. For web-only work:

```powershell
Copy-Item node_modules\pdfjs-dist\build\pdf.worker.min.mjs public\pdf.worker.min.mjs
```

## Voice input

### Windows desktop

The microphone button uses the installed Windows offline dictation recognizer.
Configure a speech language and a default microphone in Windows Settings, then
start dictation and click the microphone again to stop. Recognized text is inserted
into the composer; review it before sending.

No Whisper service is required for this desktop flow.

## Storage and backups

| Data | Location / behavior |
| --- | --- |
| Desktop interface state | WebView2 local storage in the desktop profile |
| Desktop UI workspace | WebView2 storage for `https://sanctum.app` |
| Desktop settings, threads, profiles, window state | `%APPDATA%\Sanctum` by default |
| Desktop WebView2 profile | `%APPDATA%\Sanctum\ebwebview2_data` |
| Installed desktop files | `%LOCALAPPDATA%\Programs\Sanctum` by default |
| Ollama model files | Managed separately by Ollama |

Export important conversations before clearing desktop profile storage.
Changing the origin or data directory creates a separate workspace. For a complete
desktop profile backup, close Sanctum before copying its data directory. Keep
application data separate from the generated installer payload.

Workspace storage failures are reported. Unreadable stored data is preserved, and
unfinished generations are marked as interrupted when the workspace is reloaded.

## Testing

### Source checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover state transitions, stream parsing, cancellation, retry behavior,
attachments, model identity, settings contracts, and other workflows. Some suites
contact real local engines and can skip when their prerequisites are unavailable.
Review the test summary; skipped integration checks are not verified behavior.

### Real packaged-backend check

After building the Windows payload and starting Ollama:

```powershell
python tools/exe-verify/verify_core_flows.py --model qwen3:1.7b --pull-model qwen3:1.7b
```

This test starts an isolated desktop-host profile and checks authentication, real
model discovery, streamed inference, missing-model errors, thread persistence, and
optional model installation. It fails if its required engine/model is unavailable.
The `--pull-model` option can perform a network download.

To test a specific installed host:

```powershell
python tools/exe-verify/verify_core_flows.py --exe "C:\path\to\Sanctum-Desktop.exe" --model qwen3:1.7b
```

Also exercise the actual desktop window: onboarding, model selection, attachment
upload and answers, download progress, microphone start/stop, and reopening the
saved workspace. A successful web build alone does not verify the packaged EXE.

The 29 October 2026 repair run recorded **196 passing tests, zero failures, and
four optional llama.cpp oracle checks skipped**. Real desktop checks are documented
in [desktop repair verification](docs/DESKTOP_REPAIR.md). This is a dated result,
not a guarantee for future changes.

## Troubleshooting

| Symptom | Checks and recovery |
| --- | --- |
| No models listed | Use **Settings → System monitor → Repair runtime setup**, then **Rescan** in the Hub. |
| `ollama serve` reports the address is in use | Check `/api/tags`; the Ollama desktop app may already be serving that port. |
| Model download fails | Inspect the reported error, confirm Ollama is running, and check network access and disk space. Retry from the Hub. |
| Response is slow to start | Initial model loading and context allocation take time. Try a smaller model or context window and inspect memory use. |
| Engine stream error | Confirm the selected model is installed and Ollama is reachable. Stop the failed request and retry after resolving the engine error. |
| PDF or DOCX will not attach | Check the 10 MB limit and file validity. Image-only PDFs need OCR; encrypted PDFs may need to be unlocked first. |
| Image is attached but cannot be interpreted | Select a model that supports image input. A text-only model is insufficient. |
| PDF worker/version error | Refresh `public/pdf.worker.min.mjs` from the installed `pdfjs-dist` package, then rebuild. |
| Desktop microphone does not start | Check the default input device, Windows microphone access for desktop apps, and the installed speech language. |
| EXE does not reflect source edits | Rebuild the installer and run the new artifact from `dist/`. Close the existing installation before updating. |
| Chats appear missing | Confirm the same desktop profile is in use. Restore/export data before clearing storage. |

## Contributing

1. Make a focused change in the appropriate layer and preserve existing user data.
2. Add regression coverage for changed behavior, especially error and cancellation paths.
3. Run type checking, the architecture gate, relevant tests, and a production build.
4. Rebuild and exercise the EXE for changes affecting the desktop host, permissions,
   networking, file handling, or packaging.
5. Document new setup requirements and distinguish tested behavior from optional integrations.

Keep generated caches, local environments, credentials, and test profiles out of
commits. Release artifacts under `dist/` are intentionally tracked; update their
checksums and notices together when distributing a new build. Do not replace real
inference, downloads, or transcription with simulated success responses.

## Scope and limitations

- The active local chat path uses Ollama. Cloud-provider settings are not wired
  into that path; cloud and MCP integrations remain experimental.
- Legacy arena, research, and agent screens exist in the repository but are not
  all connected to the active application shell.
- Model downloads and optional integrations can use the network. Local execution
  is not a blanket guarantee of zero network traffic.
- Speech recognition accuracy depends on the device, recognizer, language, and audio.
- Retrieval uses a lightweight local index, not a full semantic embedding pipeline.
- Historical verification documents can describe older behavior. Prefer current
  source, actual executable tests, and the dated repair notes when they differ.

## Documentation index

| Document | Topic |
| --- | --- |
| [Windows packaging](deploy/README.md) | Build prerequisites and artifact generation |
| [Architecture](docs/ARCHITECTURE.md) | Broader repository architecture |
| [Desktop runtime](docs/APP_NOT_WRAPPER.md) | Native window, WebView2, and transport design |
| [Desktop repair verification](docs/DESKTOP_REPAIR.md) | Root causes, repairs, and actual EXE checks |
| [Project checklist](docs/PROJECT_CHECKLIST.md) | Implementation and verification tracking |
| [Executable verification](docs/EXE_VERIFICATION.md) | Desktop verification procedures and historical evidence |
| [Pipeline verification](docs/PIPELINE_VERIFICATION.md) | Engine and request-pipeline checks |
| [Security update](docs/SECURITY_UPDATE.md) | Dependency remediation notes |
| [Evidence archive](evals/README.md) | Generated reports and historical verification policy |

## Branding and license

The README uses [Sanctum's logo](public/logo.jpg). The original beta artwork is
retained in [public/beta.jpg](public/beta.jpg).

<details>
<summary>View beta artwork</summary>

![Sanctum beta artwork](public/beta.jpg)

</details>

Sanctum is licensed under the [MIT License](LICENSE). Packaged dependencies have
their own licenses; see [third-party notices](dist/THIRD_PARTY_NOTICES.txt) and the
[license bundle](dist/LICENSE_BUNDLE.txt).
