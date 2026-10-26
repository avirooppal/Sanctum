# UI Provenance Ledger: Jan v0.8.7 Exact Port

This ledger documents the provenance, source tree, licensing, and adaptation status of components ported from `janhq/jan` at release `v0.8.7` (commit `648e8da55438150ccfab78808fa97a7a8e458c9f`, Apache-2.0).

- **Upstream Repository**: `https://github.com/janhq/jan`
- **Release**: `v0.8.7`
- **Pinned Commit**: `648e8da55438150ccfab78808fa97a7a8e458c9f`
- **License**: Apache-2.0 (`docs/licenses/jan-v0.8.7-LICENSE.txt`, SHA256: `240e79d4976dbf1d4c76e0ac1da223df97935a75497eaf8dd045771c3e92de16`)
- **Root Notice**: None present upstream (HTTP 404)
- **App Icon Source**: `Beta.jpg` (SHA256: `44fbb9ec77c13b9f569be49168950a78bfbb53070dba8f551ca78e3fc82ae324`, 1150×1150 square JPEG, owner-supplied)

---

## 1. Reference Screenshots Inventory (Owner Provided)

Location: `docs/design/reference/owner/`

| Filename | Resolution | SHA256 Hash | View / Feature Represented |
|---|---|---|---|
| `preview.webp` | 1324×896 | `35d6ec9faf6aa8ffe784e7f15476ce9d24d012aba7be3c7b7a9435e6073888b9` | **First Run (Step 1 of 3)**: Centered onboarding card "Jan needs to set up on your system", engine & file-search model download text, coral pill button "Let's start", custom window controls |
| `preview (1).webp` | 1425×840 | `e65156d51608705715a3bf50cda1add5f9c372fa68ea8d585b36385f7d73b570` | **Model Hub**: Hugging Face search box, "Newest" sort dropdown, "Downloaded" toggle switch, model cards with green "Fits" badge, "Download · Q4_K_M" button, parameters, description, download count, "Tools" and "Multimodal" tags, "Show variants" |
| `preview (2).webp` | 1400×849 | `3a84e3e97f014d4f68d7ea5ec9625075041e2800c5292b79a6abb5cc38f9bf6d` | **Search Modal (Ctrl+K)**: Blurred dark backdrop, "Search threads…" input, "New Chat" row with icon and shortcut hint, footer navigation hints (navigate, select, esc to close) |
| `preview (3).webp` | 1425×840 | `3f376db6d5945ee9d641cd21b428cfdae18aad8b9861da04b78cbbd4826f780b` | **Create New Project Modal**: Dialog with "Project Name" input, "Select an assistant (optional)" dropdown, Cancel and coral "Create" buttons |
| `9f7dba0d-ac1d-4936-a7a4-ac5c508c5d11.png` | 1906×1120 | `45cd047bc9ec9b36cff1ed657037177273fd9a496df42d5b28e8ec741d193f2e` | **Settings (General)**: Sidebar (General, Appearance, Assistants, Attachments, Local API Server, HTTPS Proxy, Web Search, Shortcuts, Hardware, Privacy, MCP Servers, Claude Code, Providers), App Version, Automatic Update Check switch, Check for updates button, Language selector, Data Folder path with "Copy Path" and "Change Location", App Logs with "Show in File Explorer" and "Open Logs", Advanced with Jan CLI setup guide, Reset to Factory Settings, Spell Check switch |
| `Screenshot 2026-10-25 190854.png` | 1916×1112 | `6d99588dd3bf2115000e4b441af9cce63a5cb20a156f8e9219cc9c96586cf0f0` | **Floating Left Sidebar**: Brand wordmark "Jan" (adapted to "Sanctum"), download-manager button with circular progress ring, collapse toggle, New Chat (Ctrl+N), New Projects (Ctrl+P), Search (Ctrl+K), Hub, Settings, Projects list, Thread list |
| `186e7d53-2468-4c1c-b016-18af1233da1f.png` | 790×570 | `3e8a3433390e2e6fd3a4f0988faa3a7e8825e2511dd90fa77d2800d0bebd5eaf` | **Downloads Popover**: Active download item card with filename, pause and cancel action buttons, coral progress bar, percentage indicator, byte progress ("1.72 / 2.79 GB") |

---

## 2. Ported Component Ledger

| Upstream Path (`web-app/src/`) | Sanctum Destination | License | Modifications / Deviations |
|---|---|---|---|
| `containers/SetupScreen.tsx` | `src/components/jan/SetupScreen.tsx` | Apache-2.0 | Renamed brand text; added consent gate before downloads; bundled engine CPU probe |
| `routes/hub/index.tsx` | `src/components/jan/HubView.tsx` | Apache-2.0 | Routed HF API requests through consent-gated broker; real GGUF "Fits" formula |
| `containers/dialogs/SearchDialog.tsx` | `src/components/jan/SearchDialog.tsx` | Apache-2.0 | Wired to local thread store; backdrop blur |
| `containers/dialogs/AddProjectDialog.tsx` | `src/components/jan/AddProjectDialog.tsx` | Apache-2.0 | Project creation and assistant assignment |
| `routes/settings/general.tsx` | `src/components/jan/SettingsGeneral.tsx` | Apache-2.0 | Auto-update default OFF; data folder change with real file copy; factory reset strictly scoped to data folder |
| `containers/SettingsMenu.tsx` | `src/components/jan/SettingsMenu.tsx` | Apache-2.0 | Full navigation matches screenshot; remote providers list |
| `components/left-sidebar/index.tsx` | `src/components/jan/LeftSidebar.tsx` | Apache-2.0 | Floating sidebar, wordmark, download popover with circular progress |
| `containers/DownloadManegement.tsx` | `src/components/jan/DownloadPopover.tsx` | Apache-2.0 | Pause, resume, cancel, coral progress bar matching screenshot |
| `locales/en/*.json` | `src/locales/en/*.json` | Apache-2.0 | Upstream string tables; sanitized "Jan" to "Sanctum" |
