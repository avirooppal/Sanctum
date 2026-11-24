# Part B Design Doc — Sanctum Feed Pane (`FEED_PANE_DESIGN.md`)

> Status: **B1 Spike Complete — Awaiting GO/NO-GO Decision**  
> Pinned WebView2 SDK: `Microsoft.Web.WebView2.Core.dll` **`1.0.2210.55`** (`vendor/webview2/`)

---

## 1. B1 Spike Findings & GO/NO-GO Recommendation
**SDK Audit (verified via reflection on `1.0.2210.55`) — ALL `True`:**
- Suspension & media: `TrySuspendAsync`, `Resume`, `IsSuspended`, `IsMuted`, `IsDocumentPlayingAudio`.
- Isolation & hardening: `IsWebMessageEnabled`, `AreDevToolsEnabled`, `AreDefaultScriptDialogsEnabled`, `IsStatusBarEnabled`, `IsGeneralAutofillEnabled`, `IsPasswordAutosaveEnabled`, `IsReputationCheckingRequired`, `WebResourceRequested`, `PermissionRequested`, `DownloadStarting`, `ProcessFailed`.
- InPrivate mode: `CoreWebView2ControllerOptions.IsInPrivateModeEnabled = true` supported.
- Shortcuts: `CoreWebView2Controller.AcceleratorKeyPressed` supported.

**Live Instagram Check (`https://www.instagram.com/`):**
- Top-level `HEAD` returns `HTTP 200`, `X-Frame-Options: DENY`, CSP referencing `cdninstagram.com` & `fbcdn.net`.
- Because `X-Frame-Options: DENY` blocks `<iframe>`, a **separate native `CoreWebView2` control** performing top-level navigation is required.
- **Honest Caveat**: We did **not** sign in with a real Instagram account during automated testing. Meta may present normal login/2FA challenges or change embedded WebView2 behavior at any time; Sanctum will **never** spoof User-Agent, inject scripts/CSS, or bypass login challenges.
- **GO/NO-GO Recommendation**: **GO (with generic preset architecture)**. Default preset is Instagram (`instagram.com`, `cdninstagram.com`, `fbcdn.net`, `fbsbx.com` + debug-loggable allowlist), alongside clean generic presets (e.g., Hacker News, Wikipedia) and trusted-channel custom domains — so if Meta ever blocks embedded WebView2, the pane remains useful as a generic side browser.

---

## 2. Isolation Architecture (Hostile Page Boundary)
- **Separate `CoreWebView2Environment` & Profile**: `%APPDATA%\Sanctum\feed-profile` (never the main app's environment, profile, or `sanctum.app` virtual host). Optional **InPrivate** mode (`IsInPrivateModeEnabled = true`) when toggled.
- **Zero Bridge / Zero Credentials**:
  - `IsWebMessageEnabled = false`, no `AddHostObjectToScript`, no `AddScriptToExecuteOnDocumentCreated`, no `X-Sanctum-Auth`.
  - `AreDevToolsEnabled = false`, `AreDefaultScriptDialogsEnabled = false`, `IsStatusBarEnabled = false`, `IsGeneralAutofillEnabled = false`, `IsPasswordAutosaveEnabled = false`, `IsReputationCheckingRequired = false`.
- **Network Allowlist & SSRF/Rebinding Block (`FeedNetworkPolicy.cs`)**:
  - Intercepts `NavigationStarting` and `WebResourceRequested` (`CoreWebView2WebResourceContext.All`).
  - Hard-blocks non-`https:` schemes (`file://`, `javascript:`, `data:` top-level, custom protocol handlers), loopback (`127.0.0.1`, `localhost`, `::1`), RFC1918 (`10/8`, `172.16/12`, `192.168/16`), link-local / cloud metadata (`169.254.0.0/16`), and resolves DNS (`Dns.GetHostAddresses`) with a short-TTL verified cache to block DNS rebinding to private/loopback IPs.
  - Allows only hosts matching the active preset's allowlist (`presets.json`). Adding any custom domain requires **trusted-channel approval**.
- **Permissions, Downloads & Popups**:
  - `PermissionRequested`: denies all (`Camera`, `Microphone`, `Geolocation`, `Notifications`, `ClipboardRead`, `Sensors`, `Autoplay` controlled by pause state, etc.).
  - `DownloadStarting`: `Cancel = true` unconditionally.
  - `NewWindowRequested`: if target URL matches active preset allowlist -> navigate in same pane; otherwise cancel and offer confirm dialog showing exact URL to open in system browser.
- **Agent Blindness (Privacy Invariant)**:
  - No harness tool, A2UI component, browser-agent pack, clipboard helper, or window screenshot API can access the feed controller or profile. Native screenshot/capture helpers hide or clip out the feed HWND rect before capture.
- **Consent, Offline Mode & Ledger**:
  - **Off by default**. Enabling requires a consent screen (explicitly stating Instagram/Meta sees activity as in any browser) + **trusted-channel approval** (`network_feature_enable` for `feed_pane`).
  - Global **Offline mode** immediately suspends/destroys the feed control and shows an Offline notice.
  - Logs host-level summaries ONLY (`feature: "feed_pane"`, `host`, `requestCount`, `approxBytes` — **zero URLs, paths, or content**) into `EgressHttpFactory` ledger.
  - `"Sign out and clear feed data"` wipes `%APPDATA%\Sanctum\feed-profile`; `/v1/erase-all` also deletes `feed-profile`.
- **Lifecycle**: Lazy creation on first open; auto-destroy after `N` idle minutes closed (default 10 min); `ProcessFailed` recreates cleanly without affecting main UI or running agents.

---

## 3. Layout & Airspace Strategy
- **Decision: Page-Reported Slot Rect + Host Overlay Control** (over host-owned WinForms splitter).
  - *Justification*: `ArtifactViewerPanel.tsx` already owns the resizable right panel (`Viewer` / `Browser` / new **`Feed`** tab) and responsive layout. A native WinForms splitter would duplicate resize state and break narrow-width responsive collapsing.
  - The React `FeedTab` renders a `<div data-testid="feed-slot">` and reports its `getBoundingClientRect()` (scaled by `window.devicePixelRatio`) via `ResizeObserver` + window move/resize/DPI change messages (`feedSlotBounds`) to `DesktopHost`, which positions the native `WebView2` control over the exact client rect.
  - **Airspace handling**: When any modal/dialog/dropdown opens over the slot (`[data-radix-popper-content-wrapper]` or `[role="dialog"]` observer), the UI posts `feedAirspaceOccluded: true`, hiding the native control (and showing a clean placeholder card) until closed.
  - **Responsive**: At narrow widths (`< 960px`), opening the `Feed` tab replaces the `Viewer` pane rather than squeezing the chat composer.
  - **Keyboard**: `Ctrl+Shift+F` toggles focus between Chat and Feed; `AcceleratorKeyPressed` forwards global Sanctum shortcuts (`Ctrl+K`, `Ctrl+Shift+W`, `Ctrl+N`, `Ctrl+Shift+F`, `Escape`) back to the host.

---

## 4. Host-Side Attention & Pause Engine (`FeedAttentionEngine.cs`)
- **Host Event Bus Subscription** (independent of page JS):
  - Configurable triggers (defaults): `approval_requested` from ANY workspace (**on**), `plan_ready` (**on**), `user_input_requested` (**on** — new event added to `PROTOCOL.md`), `present_file` / diff review (**on**), `a2ui_input_needed` (**on**), `run_finished` (**off**), `run_error` (**off**).
- **Pause Action (< 150 ms target)**:
  1. `CoreWebView2.IsMuted = true`
  2. Hide feed control (`Visible = false`)
  3. `await CoreWebView2.TrySuspendAsync()` (halts video/audio/timers -> ~0% CPU)
  4. Notify slot UI to render `"Sanctum needs you: <reason> (<workspace>)"` with Jump button + flash taskbar (`FlashWindowEx`) + optional chime.
- **State Machine**: `Off` | `Active` | `PausedAttention(reasons[])` | `PausedByUser` | `Suspended` (minimized/tray/Offline). Multiple pending reasons queue; resumes (with short configurable grace period, or manual `"Resume feed"` button) only when all reasons clear.
- **Abuse Limits**: Rate-limit pauses (default max 4/min, then coalesce into single banner); only foreground-visible sessions trigger media pauses; optional `"Approvals only"` strict mode; feed content can never trigger/cancel pauses (zero bridge).
- **Audit & Wellbeing**: Audit-log enable/disable/pause/resume transitions (zero URLs/content). Optional local-only wellbeing controls (all off by default): session timer, reminder after N min, daily cap (aggregate minutes only, deletable).

---

## 5. Implementation Phases (B2–B5)
- **B2**: `FeedNetworkPolicy.cs`, `FeedPaneController.cs` (separate WebView2 env, profile, presets, consent, Offline integration, host-only ledger summaries, `ProcessFailed` recovery, `erase-all`).
- **B3**: `FeedAttentionEngine.cs` (state machine, `<150 ms` mute+hide+`TrySuspendAsync`, queue, rate-limit, `user_input_requested` event, audit log, wellbeing counters).
- **B4**: `FeedTab.tsx` in `ArtifactViewerPanel`, slot `ResizeObserver`, airspace detector, consent screen, preset/domain manager, `"Feed paused: ..."` status chip, `Ctrl+Shift+F`, optional timer.
- **B5**: Automated isolation/pause/privacy/screenshot-exclusion tests, `THREATS.md` (malicious feed content attacker), `FEATURES.md`, `PROTOCOL.md`, manual real-Instagram checklist, and final deviation report.
