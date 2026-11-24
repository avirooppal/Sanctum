# Sanctum Threat Model (`THREATS.md`)

Sanctum is a strictly local, private AI workspace and agent harness for Windows. The single security enforcement point is the native C# host (`Sanctum-Desktop.exe`); UI checks are cosmetic.

---

## 1. Protected Assets
1. **User files & workspace contents** (outside-workspace files, credential stores like `.ssh`, `.aws`, `.gnupg`, `.kube`, `.azure`, `C:\Windows`).
2. **Local session logs, memory, vault index, and blobs** (`%APPDATA%\Sanctum\`).
3. **Host authentication & IPC secrets** (`runtime.json` bearer token, Named Pipe ACLs, single-use `X-Sanctum-Approval` tokens).
4. **Network privacy** (zero cloud LLM providers, zero telemetry, zero background network egress).
5. **Executable integrity** (`Sanctum.exe`, `Sanctum-Desktop.exe`, downloaded Ollama/model/sidecar packs).

---

## 2. Trust Boundaries
- **T1: Host Process <-> WebView2 Renderer (`https://sanctum.app`)**: Renderer is treated as semi-trusted UI; high-risk mutations require the trusted channel (Named Pipe ACL or native `X-Sanctum-Approval` minted by `WebMessageReceived`).
- **T2: Host Process <-> Local Model Output**: All LLM outputs, tool arguments, and (in Phase 3b) A2UI payloads are untrusted data.
- **T3: Host Process <-> Workspace Content**: Any file, repo config (`.sanctum/*`, `AGENTS.md`, `mcp.json`, `hooks.json`), or RAG chunk inside a workspace is untrusted until explicitly trusted by content hash.
- **T4: Host Process <-> External Network**: Deny-by-default `EgressHttpFactory` + global Offline mode switch + append-only redacted egress ledger.
- **T5: Host Process <-> Child Processes (Shell / MCP / Sidecars)**: Supervised by Windows Job Objects with `KILL_ON_JOB_CLOSE`, memory/process caps, and stripped secret env vars.

---

## 3. Attacker Models, Mitigations & Proving Tests

| Attacker Type | Threat / Attack Vector | Host Mitigation | Explicit Limit / Caveat | Proving Test(s) |
|---|---|---|---|---|
| **Malicious File** | Prompt injection in a workspace file instructing the model to exfiltrate data, run obfuscated PowerShell, or poison memory | Untrusted content wrapping (`<untrusted_file>`), PowerShell AST evaluator (blocks `iex`, `-EncodedCommand`, aliases, backticks, here-strings, call operators), mandatory approval for `memory_save` after untrusted content (even in `full_auto`), deny-by-default `EgressHttpFactory` | `workspace_only` does **not** OS-sandbox approved shell commands; users must review shell approval cards | `tests/phase2_shell_confinement.test.ts`, `tests/phase2_memory_poisoning.test.ts`, `tests/phase1_egress_factory.test.ts` |
| **Malicious Cloned Repo** | Repo ships hostile `AGENTS.md`, `.sanctum/hooks.json`, `.sanctum/mcp.json`, `.sanctum/agents/*.md`, or packs | Content-hashed `WorkspaceTrustManager`: untrusted repos allow chat & read-only tools only; `AGENTS.md`, hooks, MCP, `run_command`, and subagents stay disabled until trusted via trusted channel for exact SHA-256 hash; any file edit invalidates trust (`hash_changed`) | Once a user trusts a repo's hash, its hooks/agents are permitted until modified or revoked | `tests/phase2_workspace_trust.test.ts` |
| **Malicious Web Page** | SSRF, DNS rebinding, private IP access, or prompt injection in fetched/browsed pages | `EgressHttpFactory` blocks non-loopback unless feature enabled & Offline mode OFF; browser policy hard-blocks `file://`, `javascript:`, RFC1918, `169.254.169.254`, Sanctum/Ollama ports, DNS rebinding; web output wrapped as untrusted; `memory_save` gated | Browser agent & web tools are off by default; enabling them requires trusted-channel approval | `tests/phase2_browser_agent.test.ts`, `tests/phase1_egress_ledger_and_offline.test.ts`, `tests/phase2_memory_poisoning.test.ts` |
| **Malicious MCP Server** | Unauthorized server registration, orphan background processes, tool poisoning | Registering/deleting MCP servers requires trusted channel (`403` over HTTP bearer); stdio MCP servers run inside `ProcessJobObject` (`KILL_ON_JOB_CLOSE`); tool outputs treated as untrusted | Approved local stdio MCP servers execute with the current Windows user's privileges | `tests/phase2_trusted_channel_audit.test.ts`, `tests/phase4_extensibility_and_clients.test.ts` |
| **Compromised UI / Replay Attack** | XSS or script in renderer attempting to escalate to `full_auto`, disable Offline mode, add persistent rules, or replay an approval | Single enforcement point in host; `MutatingRouteRegistry` enforces trusted channel on all high-risk routes; approvals are single-use and bound to `(approvalId, callId, argsSha256)` | Same-user native process can access Named Pipe (see Local Malware below) | `tests/phase2_trusted_channel_audit.test.ts`, `tests/phase3_one_chat_path.test.ts` |
| **Supply-Chain / MITM Update** | Tampered update binary, unsigned release, or version downgrade attack | `UpdateVerifier` enforces pinned RSA-2048 public key signature, mandatory 64-hex SHA-256 checksum, strict SemVer upgrade (`candidate > current`), manual-only check; `build_installer.py` supports Authenticode signing (`SANCTUM_SIGN_PFX`) | Production builds must be signed with a real CA-issued Authenticode certificate before public distribution | `tests/phase2_updater_and_signing.test.ts` |
| **Other Local User (Shared PC)** | Another Windows account reading sessions, tokens, or memory | User-only NTFS ACLs (`WindowsAclHelper`) on `runtime.json`, sessions, blobs, memory, ledger, and Named Pipe; optional Windows DPAPI (`CurrentUser`) encryption at rest; PBKDF2-HMAC-SHA256 (100k iter) + AES-256-CBC + HMAC-SHA256 for portable archives | Windows Administrators can bypass standard user ACLs | `tests/phase2_data_at_rest.test.ts`, `tests/phase1a_harness.test.ts` |
| **Local Malware (Same User)** | Malware already running as the same Windows user | **Out of scope for full prevention.** Same-user processes share OS privileges and DPAPI `CurrentUser` scope. Sanctum reduces blast radius via stripped child env vars, secret redaction before disk writes, and complete `erase-all` | OS-level user isolation cannot defend against already-running same-user malware | `tests/phase2_shell_confinement.test.ts`, `tests/phase2_data_at_rest.test.ts` |

---

## 4. Known Limits (Stated Plainly)
- **Windows-only** (`.NET Framework 4.7.2` + WebView2 + Windows Named Pipes + DPAPI + Job Objects).
- **Shell confinement**: `workspace_only` does **not** OS-sandbox `run_command` (Windows Sandbox requires Hyper-V/Pro; Low-Integrity tokens break workspace writes). Confinement relies on PowerShell AST evaluation, explicit approval, Job Object memory/process-tree limits, and stripped secret environment variables.
- **Data-at-rest performance** (measured on 100 KB payload via `--bench-crypto`):
  - DPAPI (`CurrentUser`) roundtrip: ~16.5 ms
  - PBKDF2 (100k iterations) + AES-256-CBC + HMAC-SHA256 portable archive roundtrip: ~865 ms
