# ADR0093: B4 core contracts — IPC, packs, settings, permissions, egress, computer use, platform assurance

Date: 2026-10-20. Status: PROVISIONAL — owner review required before M2 implementation begins.
Builds on ADR0091 (shell) and ADR0092 (UI stack).

## 1. Core process model and IPC

### Process topology

The desktop application runs as a tree of OS processes:

```
sanctum-shell (wry/WebView host)
  └─ sanctum-gateway (local HTTP API, Rust)
       └─ llama-worker (llama.cpp, supervised)
       └─ [optional pack workers, on demand]
```

All inter-process communication uses **stdio pipes** or **Unix domain sockets
/ Windows named pipes** — not TCP loopback — to eliminate loopback-exposure
risks before OS containment is verified. The gateway binds to a random
localhost port only for the WebView IPC; it is not exposed to the LAN.

### IPC contract

- Shell-to-gateway: The WebView sends JSON-RPC requests over the Tauri/wry
  IPC channel (wry uses `ipc://` handler). The gateway is not a TCP server
  visible to the LAN.
- Gateway-to-worker: stdio pipes (stdin/stdout) for request/response;
  the supervisor manages the child process lifecycle.
- Cancellation: same supervisor-and-cancellation contract from the existing
  verified implementation (ADR0031, ADR0039).

### Windows IPC note (platform-specific)

On Windows, `AF_UNIX` is supported from Windows 10 1803+. If the target
Windows version is 10 1803+ (which Windows 11 always is), Unix domain sockets
can be used. Named pipes are also acceptable. **Do not use TCP loopback** for
engine IPC until the Windows network containment mechanism is verified and
tested (see Section 6, Platform Assurance).

## 2. Pack interface

Packs are optional capability bundles (RAG, speech, vision, computer-use, etc.)
that can be installed, imported offline, lazily loaded, unloaded, and uninstalled
without restarting the core gateway.

### Pack lifecycle

| State | Description |
|---|---|
| absent | Pack not installed; capability endpoint returns `unavailable` |
| installed | Pack present on disk; not loaded into memory |
| loaded | Pack worker process running; capability endpoint returns `available` |
| unloading | Worker shutdown in progress; no new requests accepted |
| error | Worker failed; gateway retries per ADR0036 policy |

### Pack interface contract

```
GET /api/capability          -> list of packs with state and capabilities
POST /api/pack/load {id}     -> load a pack worker (idempotent)
POST /api/pack/unload {id}   -> unload a pack worker (drain, then terminate)
POST /api/pack/install {id, source}   -> install from offline bundle
POST /api/pack/uninstall {id}         -> remove from disk
```

Install source must be a local file path or a hash-verified offline bundle.
No unauthenticated network download is permitted from this endpoint.

### RAM and size budgets per pack (proposed; B7 sets final)

| Pack | Max idle RSS | Max install size |
|---|---|---|
| RAG (sqlite-vec + embedder) | 512 MB | 2 GB (model-dependent) |
| Speech (whisper.cpp + TTS) | 1.5 GB | 1 GB |
| Vision (LLaVA worker) | As loaded model | As loaded model |
| Computer use | 64 MB daemon | 32 MB code |

These are proposals; B7 measures and confirms each.

### Offline import

Packs can be imported from a local `.sanctum-pack` bundle (tar + manifest + sha256).
The bundle must include: binary, model weights if any, license notices, and a
signed manifest. Verification: SHA256 of every file in the bundle against the
manifest before any file is written to disk.

## 3. Settings schema

### Schema fields

Every setting must declare:

| Field | Type | Description |
|---|---|---|
| key | string | Dot-path, e.g. `ui.theme` |
| type | string | `string`, `integer`, `boolean`, `enum`, `path` |
| default | any | Compile-time default value |
| scope | enum | `global`, `assistant`, `thread`, `model` |
| validation | object | JSON Schema fragment |
| risk | enum | `low`, `medium`, `high` |
| restart_required | boolean | Whether a gateway/worker restart is needed |
| description | string | Human-readable; max 200 characters |

### Config file

Settings are stored in a TOML file at the platform data directory:
- Linux: `$XDG_DATA_HOME/sanctum/config.toml` (default `~/.local/share/sanctum/`)
- Windows: `%APPDATA%\Sanctum\config.toml`
- macOS: `~/Library/Application Support/Sanctum/config.toml`

The gateway reads the config on startup and on `SIGHUP` (Linux/macOS) or a
named-pipe signal (Windows). No hot-reload without explicit user action.

### CLI interface

```
sanctum config get <key>
sanctum config set <key> <value>
sanctum config list [--scope <scope>]
sanctum config import <file>
sanctum config export [--scope <scope>] [--output <file>]
```

### Environment overrides

`SANCTUM_CONFIG_<KEY>` environment variables override the config file for
the duration of the process. Keys are uppercased and dots replaced with
underscores. These are for development and CI only; secrets must not be
passed as environment variables in production.

### Import/export

Export: produces a TOML file with only non-default values. Secrets (API keys)
are redacted to `[REDACTED]` in exports. Import: validates each key against the
schema before applying; rejects unknown keys.

## 4. Permission broker and policy model

### Permission model

Each tool call or capability use is governed by a permission. Permissions have
four states:

| State | Meaning |
|---|---|
| Deny | Always rejected without user prompt |
| Ask | Prompt the user on each request |
| Allow-this-thread | Permitted for the current thread only; reverts on thread close |
| Always | Permitted permanently for this assistant |

### Arguments-bound approvals

Approvals are bound to the exact arguments, not just the tool name. Approving
`read_file("/home/user/notes.md")` does not approve `read_file("/etc/passwd")`.
The permission broker must verify that the argument set of the incoming call
matches the approved argument set exactly (or within an approved pattern).

### Taint rules

Any output from an external source (web fetch, file read, tool output, MCP
server) is tainted. Tainted data that reaches a tool argument without an
explicit user-review step triggers a `Taint-Elevated` prompt. The user must
explicitly approve tainted data entering a tool.

### Defaults

| Category | Default permission |
|---|---|
| File read (local, user data dir) | Ask |
| File write (local, user data dir) | Ask |
| File read/write (outside data dir) | Deny |
| Network fetch | Deny (unless user-initiated) |
| Shell execution | Deny |
| Computer use (any) | Deny |
| MCP server call | Ask |
| Model inference (local) | Always |

## 5. Egress broker

### Scope

All network activity from the application must pass through the egress broker.
The broker enforces:
- Per-feature allowlists: only explicitly approved endpoints may be contacted.
- User-initiated-only: no background downloads or analytics.
- Ledger events: every outbound connection attempt is logged to the privacy ledger.
- Kill switch: the user can disable all network activity with a single toggle.
- Secrets: API keys are retrieved from the OS keychain (Secret Service on Linux,
  Windows Credential Manager, macOS Keychain) or environment variables; never
  from the config file in plaintext.

### Allowlist structure

```toml
[[egress.allowed]]
feature = "openai-api"
host = "api.openai.com"
port = 443
protocol = "https"
user_initiated_only = true

[[egress.allowed]]
feature = "model-download"
host = "huggingface.co"
port = 443
protocol = "https"
user_initiated_only = true
```

### Default state

All egress is blocked by default. The user must explicitly enable each feature
in settings before any network connection is made.

### Secrets

API keys are stored in the OS keychain. The gateway retrieves them at request
time via the keychain API. Keys are never written to disk, logs, or the config file.

## 6. Computer use design

### Sandbox mode (per OS)

| OS | Sandbox mechanism | Admin required? |
|---|---|---|
| Linux | User-namespaced bubblewrap; existing verified containment from ADR0003/0006 | No |
| Windows | Job objects + restricted tokens (evaluated in B4; see below) | No (job objects); elevation required for AppContainer setup on some versions |
| macOS | Sandbox profiles (com.apple.security.app-sandbox equivalent) | No |

### Windows containment evaluation (B4 task)

AppContainer and restricted tokens: these provide process isolation without
admin rights on Windows 10+. Job objects limit CPU/memory. The B4 platform
assurance evaluation must:
1. Build a test harness that spawns the computer-use worker inside a job object
   with a restricted token and no network access.
2. Attempt a real outbound TCP connection from within the container.
3. Verify the connection is refused by the OS (not just blocked by our code).
4. Record the exact result as b4-windows-containment-probe.json.

Windows Filtering Platform (WFP) rules require admin elevation and are not
acceptable for our single-user non-admin use case. The fallback if AppContainer
is insufficient is: display `network: not verified` in the UI and block computer
use network access at the application layer, with a clear label.

### On-screen banner

When computer use is active, a persistent always-on-top banner must be visible:
"Sanctum is controlling your computer. Press [hotkey] to stop."

### Global kill hotkey

A global hotkey (Ctrl+Shift+Escape or configurable) immediately:
1. Sends SIGTERM to the computer-use worker.
2. Waits 2 seconds.
3. Sends SIGKILL if still running.
4. Updates the UI to "stopped".

### User-input pause

The computer-use worker must not continue actions while the user is typing.
A 500ms debounce on user keyboard/mouse activity pauses the worker.

### Budgets

| Budget | Default | Override |
|---|---|---|
| Max actions per session | 100 | User setting |
| Max wall time per session | 30 minutes | User setting |
| Max files written | 50 | User setting |
| Max network fetches | 10 | User setting |

### Scope

Computer use is limited to the user's desktop environment. It may not:
- Access other users' files or processes.
- Modify system files outside `$HOME` / `%USERPROFILE%`.
- Install software without explicit user approval per-installer.

### Evaluation suite design

The computer use evaluation suite must include:
- Sandbox escape attempt: verify that a network connection from within the
  sandboxed worker is refused.
- File escape attempt: verify that file writes outside the allowed path are
  refused.
- Kill hotkey: verify that the global hotkey terminates the worker within 3 s.
- Budget enforcement: verify that the action count limit is enforced.

## 7. Platform assurance tiers

### Tier labels

| Label | Meaning |
|---|---|
| verified kernel containment | OS-level process isolation tested at startup; outbound network from worker is refused by the kernel |
| network blocked by OS rule and tested at startup | An OS-enforced network rule (firewall, namespace, AppContainer) blocks worker egress; tested on each startup |
| not verified | No OS-level containment; application-layer blocking only; label displayed to user |

### Linux

Existing verified containment (ADR0003/0006): user namespaces + seccomp filter.
Startup test: attempt a real outbound TCP connection from the worker subprocess;
verify ECONNREFUSED or EPERM.
Label: `verified kernel containment`.

### Windows

B4 evaluation task: test AppContainer + restricted token confinement.
If AppContainer blocks real outbound TCP (tested at startup): label
`network blocked by OS rule and tested at startup`.
If AppContainer is unavailable or insufficient: label `not verified`;
display this label in the security settings UI.
Do not claim Windows containment until the startup test passes on the target machine.

### macOS

Sandbox profiles (com.apple.security.app-sandbox). Must test that a sandboxed
worker cannot make outbound network connections to a non-allowlisted host.
If the sandbox test passes at startup: label `network blocked by OS rule and
tested at startup`.
macOS is not the current development platform; evaluation is deferred to when
a macOS CI runner is available.

### Startup tests

On each application launch, the gateway runs a quick containment probe:
1. Spawn a minimal test subprocess inside the containment mechanism.
2. Attempt a TCP connection to an internet address (e.g. 1.1.1.1:443).
3. Record the result.
4. Update the platform assurance label displayed in the security settings UI.

The UI labels must exactly match the tier labels above. "Verified" must not
appear unless the startup probe actually passed this session.

## REVIEW_QUEUE entries

- B4 contracts (this ADR): PROVISIONAL; all contracts require owner review
  before M2 implementation.
- Windows containment evaluation: OPEN — AppContainer/job-object test must
  produce real evidence before any "network blocked" claim is made.
- macOS containment evaluation: DEFERRED until macOS CI runner is available.
- Egress broker secrets: must verify OS keychain integration on each platform
  before M2 ships.
