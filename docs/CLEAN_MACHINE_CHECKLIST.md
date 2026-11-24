# Sanctum Clean-Machine Verification Checklist

Follow this scripted procedure on a fresh Windows 10/11 VM (offline / no internet) to verify installation, first run, upgrade migration, and uninstall.

## Prerequisites
- Clean Windows 10/11 x64 VM with network adapter disconnected (or Firewall outbound blocked except loopback).
- Copy `Sanctum.exe` and `SHA256SUMS` onto the VM.

## 1. Verify Checksum & Optional Authenticode Signature
```powershell
Get-FileHash .\Sanctum.exe -Algorithm SHA256
# Compare with SHA256SUMS
Get-AuthenticodeSignature .\Sanctum.exe | Select-Object Status, SignerCertificate
```

## 2. Offline First Run & Unpack
```powershell
.\Sanctum.exe --version
.\Sanctum.exe --health
```
- Expected: exits `0`, prints JSON `{"status":"ok",...}` and unpacks `%LOCALAPPDATA%\Programs\Sanctum\Sanctum-Desktop.exe` + `Uninstall.exe` + `resources\web\`.
- Launch `.\Sanctum.exe` normally. Verify UI loads on `https://sanctum.app` with zero outbound network errors.

## 3. Offline Mode & Egress Verification
1. Open **Settings -> Network activity**.
2. Click **Enable Offline Mode**.
3. Verify status badge shows `Active — Zero Non-Loopback Egress` and all outbound feature toggles are disabled.
4. Run a local chat / workspace file read turn; verify **Non-Loopback Egress Ledger** remains empty (`0` entries).

## 4. Upgrade & Cloud-Removal Migration Test
1. Close Sanctum.
2. Seed `%APPDATA%\Sanctum\cloud_providers.json` with `{"openai":{"apiKey":"sk-test-1234567890abcdef","enabled":true}}` and `%APPDATA%\Sanctum\threads.json` with a thread using `"modelId":"openai:gpt-4o"`.
3. Launch `Sanctum.exe`.
4. Verify:
   - `%APPDATA%\Sanctum\cloud_providers.json` is deleted.
   - One-time toast announces cloud providers were removed.
   - Previous thread history is intact with fallback local model ID and zero `sk-` strings on disk.

## 5. Erase All Data & Uninstall
1. Trigger `POST /v1/erase-all` (or Settings -> General -> Factory Reset).
2. Verify `%APPDATA%\Sanctum\sessions`, `memory.json`, `egress_ledger.jsonl`, `shadow-git`, `checkpoints`, `vault`, and `%LOCALAPPDATA%\Sanctum\browser-profile` are removed.
3. Run `%LOCALAPPDATA%\Programs\Sanctum\Uninstall.exe` and verify `%LOCALAPPDATA%\Programs\Sanctum` is cleanly removed.
