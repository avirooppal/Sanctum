# Windows 10 22H2 Clean Environment Verification Steps (Owner Protocol)

To verify `Sanctum-Setup-1.0.0-x64.exe` in an isolated, clean Windows 10 22H2 / Windows 11 machine without any developer toolchains (no Node.js, Python, Rust, WSL, Docker, or external Visual C++ redists):

## 1. Quick Verification via Windows Sandbox

Windows Sandbox provides a disposable, completely pristine Windows desktop environment with zero pre-installed developer tools.

### Step 1: Launch Windows Sandbox Configuration
Save the following configuration as `Sanctum-Sandbox.wsb`:
```xml
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>C:\Users\aviroop\Desktop\Sru\dist</HostFolder>
      <SandboxFolder>C:\SanctumDist</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell -NoProfile -Command "Start-Process 'C:\SanctumDist\Sanctum-Setup-1.0.0-x64.exe' -ArgumentList '/S' -Wait; Start-Process (Join-Path $env:LOCALAPPDATA 'Programs\Sanctum\Sanctum-Desktop.exe')"</Command>
  </LogonCommand>
</Configuration>
```

### Step 2: Run the Sandbox Test
Run from PowerShell:
```powershell
Start-Process "Sanctum-Sandbox.wsb"
```

### Step 3: Verifications in Clean Sandbox
1. Observe that `Sanctum-Setup-1.0.0-x64.exe` installs cleanly to `%LOCALAPPDATA%\Programs\Sanctum` with **zero UAC elevation prompts**.
2. Confirm the desktop shortcut `Sanctum.lnk` is present on the clean desktop.
3. Confirm `Sanctum-Desktop.exe` launches to interactive UI with zero dependencies installed.
4. Open Settings in the app, confirm persistent configuration works.
5. In Windows Add/Remove Programs (Settings > Apps), click Uninstall and confirm the uninstaller prompts before deleting user data.

---

## 2. Air-Gapped Physical Host Test

To verify offline operation without internet connectivity:
```powershell
# 1. Disable network adapter
Disable-NetAdapter -Name "Wi-Fi" -Confirm:$false

# 2. Run silent install
.\dist\Sanctum-Setup-1.0.0-x64.exe /S

# 3. Launch application
& "$env:LOCALAPPDATA\Programs\Sanctum\Sanctum-Desktop.exe" --health

# 4. Re-enable network adapter
Enable-NetAdapter -Name "Wi-Fi" -Confirm:$false
```
Expected output:
```json
{"status":"ok","app":"Sanctum","version":"1.0.0","core":"active"}
```
