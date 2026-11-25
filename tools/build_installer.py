import base64
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = "1.0.0"


def find_makensis():
    cmd = shutil.which("makensis")
    if cmd:
        return cmd

    candidates = [
        r"C:\Program Files (x86)\NSIS\makensis.exe",
        r"C:\Program Files\NSIS\makensis.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def build_installer():
    print("=== Step 1: Preparing Installer Payload ===")
    from prepare_installer_payload import prepare

    prepare()

    dist_dir = ROOT
    os.makedirs(dist_dir, exist_ok=True)

    # Sanctum.exe is the only end-user artifact: download, run, done.
    print("=== Step 2: Compiling single-file Sanctum.exe ===")
    exe_path = os.path.join(ROOT, "Sanctum.exe")
    build_direct_launcher(exe_path, build_payload_b64())
    # Keep SHA256SUMS in sync with Sanctum.exe so self-updater checksum verification passes
    h = hashlib.sha256()
    with open(exe_path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    sha_hex = h.hexdigest()
    with open(os.path.join(ROOT, "SHA256SUMS"), "w", encoding="utf-8", newline="\n") as sf:
        sf.write(f"{sha_hex}  Sanctum.exe\n")
    print(f"Updated SHA256SUMS: {sha_hex}  Sanctum.exe")
    print("=== Build Complete ===")


def build_payload_b64() -> str:
    payload_dir = os.path.join(ROOT, "deploy", "installer", "build_payload")
    zip_path = os.path.join(ROOT, "deploy", "installer", "payload.zip")
    if os.path.exists(zip_path):
        try:
            os.remove(zip_path)
        except Exception:
            pass

    print("Creating compressed payload archive...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(payload_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, payload_dir)
                zf.write(full_path, rel_path)

    with open(zip_path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def build_self_extracting_installer(out_path: str):
    """Legacy installer wrapper; not part of the default release."""
    payload_b64 = build_payload_b64()

    cs_setup = r"""using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;

[assembly: AssemblyTitle("Sanctum Setup")]
[assembly: AssemblyDescription("Sanctum Desktop Installer")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

public class SetupProgram {
    [STAThread]
    public static int Main(string[] args) {
        bool silent = false;
        string customDir = null;

        for (int i = 0; i < args.Length; i++) {
            if (args[i].Equals("/S", StringComparison.OrdinalIgnoreCase) || args[i].Equals("-s", StringComparison.OrdinalIgnoreCase)) {
                silent = true;
            } else if (args[i].StartsWith("/D=", StringComparison.OrdinalIgnoreCase)) {
                customDir = args[i].Substring(3).Trim('"');
            }
        }

        string installDir = customDir;
        if (string.IsNullOrEmpty(installDir)) {
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            installDir = Path.Combine(localApp, "Programs", "Sanctum");
        }

        // Check for running instance before overwriting
        while (IsTargetRunning(installDir)) {
            if (!silent) {
                DialogResult dr = MessageBox.Show("Sanctum is currently running. Please close it before continuing the installation.", "Sanctum Installer", MessageBoxButtons.RetryCancel, MessageBoxIcon.Warning);
                if (dr == DialogResult.Cancel) return 1;
            } else {
                Console.Error.WriteLine("Error: Sanctum-Desktop is currently running.");
                return 1;
            }
        }

        try {
            Directory.CreateDirectory(installDir);

            // Extract embedded ZIP payload
            string tempZip = Path.Combine(Path.GetTempPath(), "sanctum_payload_" + Guid.NewGuid().ToString("N") + ".zip");
            byte[] zipData = Convert.FromBase64String("__PAYLOAD_B64__");
            File.WriteAllBytes(tempZip, zipData);

            // Unpack files
            ExtractZip(tempZip, installDir);
            try { File.Delete(tempZip); } catch { }

            // Create Registry Entries in HKCU
            string uninstKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Sanctum";
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(uninstKey)) {
                if (key != null) {
                    key.SetValue("DisplayName", "Sanctum");
                    key.SetValue("DisplayVersion", "1.0.0");
                    key.SetValue("Publisher", "Sanctum Contributors");
                    key.SetValue("InstallLocation", installDir);
                    key.SetValue("UninstallString", "\"" + Path.Combine(installDir, "Uninstall.exe") + "\"");
                    key.SetValue("QuietUninstallString", "\"" + Path.Combine(installDir, "Uninstall.exe") + "\" /S");
                    key.SetValue("DisplayIcon", Path.Combine(installDir, "Sanctum-Desktop.exe"));
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
            }

            // Create Shortcuts
            CreateShortcuts(installDir);

            if (!silent) {
                try {
                    Process.Start(Path.Combine(installDir, "Sanctum-Desktop.exe"));
                } catch { }
            }
            return 0;
        } catch (Exception ex) {
            if (!silent) {
                MessageBox.Show("Installation failed: " + ex.Message, "Sanctum Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            } else {
                Console.Error.WriteLine("Installation error: " + ex.ToString());
            }
            return 1;
        }
    }

    private static bool IsTargetRunning(string installDir) {
        string target = Path.GetFullPath(Path.Combine(installDir, "Sanctum-Desktop.exe"));
        foreach (Process process in Process.GetProcessesByName("Sanctum-Desktop")) {
            try {
                if (string.Equals(process.MainModule.FileName, target, StringComparison.OrdinalIgnoreCase)) return true;
            } catch { }
        }
        return false;
    }

    private static void ExtractZip(string zipPath, string targetDir) {
        string rootFull = Path.GetFullPath(targetDir).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        using (ZipArchive archive = ZipFile.OpenRead(zipPath)) {
            foreach (ZipArchiveEntry entry in archive.Entries) {
                string destPath = Path.GetFullPath(Path.Combine(rootFull, entry.FullName));
                if (!destPath.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase) &&
                    !destPath.TrimEnd(Path.DirectorySeparatorChar).Equals(rootFull.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)) {
                    throw new InvalidDataException("Blocked Zip Slip entry: " + entry.FullName);
                }
                if (string.IsNullOrEmpty(entry.Name)) {
                    Directory.CreateDirectory(destPath);
                } else {
                    Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                    entry.ExtractToFile(destPath, true);
                }
            }
        }
    }

    private static void CreateShortcuts(string installDir) {
        string exe = Path.Combine(installDir, "Sanctum-Desktop.exe");
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        string sanctumMenu = Path.Combine(programs, "Sanctum");
        Directory.CreateDirectory(sanctumMenu);

        string ps = "$ws = New-Object -ComObject WScript.Shell; " +
            "$s1 = $ws.CreateShortcut($env:SANCTUM_LNK_1); $s1.TargetPath = $env:SANCTUM_TARGET_EXE; $s1.Save(); " +
            "$s2 = $ws.CreateShortcut($env:SANCTUM_LNK_2); $s2.TargetPath = $env:SANCTUM_TARGET_EXE; $s2.Save();";
        string encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(ps));

        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -NonInteractive -EncodedCommand " + encoded,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        psi.EnvironmentVariables["SANCTUM_LNK_1"] = Path.Combine(desktop, "Sanctum.lnk");
        psi.EnvironmentVariables["SANCTUM_LNK_2"] = Path.Combine(sanctumMenu, "Sanctum.lnk");
        psi.EnvironmentVariables["SANCTUM_TARGET_EXE"] = exe;
        using (Process p = Process.Start(psi)) {
            p.WaitForExit();
        }
    }
}
""".replace(
        "__PAYLOAD_B64__", payload_b64
    )

    temp_cs = os.path.join(ROOT, "deploy", "installer", "temp_setup.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(cs_setup)

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    icon_path = os.path.abspath("deploy/installer/app-icon.ico")

    if os.path.exists(csc_path):
        cmd = [
            csc_path,
            "/target:winexe",
            f"/out:{out_path}",
            "/optimize+",
            "/platform:x64",
            "/reference:System.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,System.Windows.Forms.dll,System.Drawing.dll",
        ]
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        print(f"Compiling self-extracting installer with csc.exe to {out_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_compile = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll", "System.Windows.Forms.dll", "System.Drawing.dll" -OutputAssembly "{out_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_compile]
        print(f"Compiling self-extracting installer with PowerShell to {out_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(temp_cs):
        os.remove(temp_cs)
    if os.path.exists(zip_path):
        os.remove(zip_path)

    if res.returncode != 0:
        print(f"Setup compilation error: {res.stderr}\n{res.stdout}")
        sys.exit(1)

    print(f"Compiled self-extracting installer to {out_path} ({os.path.getsize(out_path)} bytes)")

    out_direct = os.path.join(os.path.dirname(out_path), "Sanctum.exe")
    build_direct_launcher(out_direct, payload_b64)


def build_direct_launcher(out_path, payload_b64):
    import hashlib
    payload_bytes = base64.b64decode(payload_b64)
    build_stamp = hashlib.sha256(payload_bytes).hexdigest()
    stamp_out = os.path.join(ROOT, "deploy", "installer", "build_stamp.txt")
    with open(stamp_out, "w", encoding="utf-8") as sf:
        sf.write(build_stamp + "\n")

    cs_launcher = r"""using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;

[assembly: AssemblyTitle("Sanctum")]
[assembly: AssemblyDescription("Sanctum Standalone Desktop Application")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

public class SanctumLauncher {
    public static int Main(string[] args) {
        bool forceUpdate = false;
        var forwardArgs = new List<string>();
        foreach (string a in args) {
            if (string.Equals(a, "--update", StringComparison.OrdinalIgnoreCase)) {
                forceUpdate = true;
            } else {
                forwardArgs.Add(a);
            }
        }

        string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string appDir = Path.Combine(localApp, "Programs", "Sanctum");
        string exe = Path.Combine(appDir, "Sanctum-Desktop.exe");
        string wvLoader = Path.Combine(appDir, "WebView2Loader.dll");
        string stampFile = Path.Combine(appDir, "build_stamp.txt");
        string expectedStamp = "__BUILD_STAMP__";

        bool needsUnpack = forceUpdate || !File.Exists(exe) || !File.Exists(wvLoader) || !File.Exists(stampFile);
        if (!needsUnpack) {
            try {
                string actualStamp = File.ReadAllText(stampFile).Trim();
                if (actualStamp != expectedStamp) needsUnpack = true;
            } catch {
                needsUnpack = true;
            }
        }

        if (needsUnpack) {
            string tempZip = Path.Combine(Path.GetTempPath(), "sanctum_unpack_" + Guid.NewGuid().ToString("N") + ".zip");
            try {
                // Gracefully close then terminate any running Sanctum-Desktop host so files can be replaced cleanly
                for (int attempt = 0; attempt < 3; attempt++) {
                    var running = Process.GetProcessesByName("Sanctum-Desktop");
                    if (running.Length == 0) break;
                    foreach (Process oldProc in running) {
                        try {
                            if (attempt == 0) {
                                oldProc.CloseMainWindow();
                                if (oldProc.WaitForExit(1200)) continue;
                            }
                            if (!oldProc.HasExited) {
                                oldProc.Kill();
                                oldProc.WaitForExit(3000);
                            }
                        } catch { }
                    }
                    Thread.Sleep(350);
                }
                Directory.CreateDirectory(appDir);

                // Clean stale web assets before extracting fresh bundle to prevent conflicting webpack chunks
                string webDir = Path.Combine(appDir, "resources", "web");
                if (Directory.Exists(webDir)) {
                    try { Directory.Delete(webDir, true); } catch { }
                }

                byte[] zipData = Convert.FromBase64String("__PAYLOAD_B64__");
                File.WriteAllBytes(tempZip, zipData);
                string rootFull = Path.GetFullPath(appDir).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                using (ZipArchive archive = ZipFile.OpenRead(tempZip)) {
                    foreach (ZipArchiveEntry entry in archive.Entries) {
                        string destPath = Path.GetFullPath(Path.Combine(rootFull, entry.FullName));
                        if (!destPath.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase) &&
                            !destPath.TrimEnd(Path.DirectorySeparatorChar).Equals(rootFull.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)) {
                            throw new InvalidDataException("Blocked Zip Slip entry: " + entry.FullName);
                        }
                        if (string.IsNullOrEmpty(entry.Name)) {
                            Directory.CreateDirectory(destPath);
                        } else {
                            Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                            Exception lastErr = null;
                            for (int retry = 0; retry < 5; retry++) {
                                try {
                                    entry.ExtractToFile(destPath, true);
                                    lastErr = null;
                                    break;
                                } catch (IOException ioEx) {
                                    lastErr = ioEx;
                                    Thread.Sleep(300);
                                }
                            }
                            if (lastErr != null) throw lastErr;
                        }
                    }
                }
                File.WriteAllText(stampFile, expectedStamp);
            } catch (Exception error) {
                System.Windows.Forms.MessageBox.Show("Could not update Sanctum: " + error.Message, "Sanctum update failed");
                return 1;
            } finally {
                try { if (File.Exists(tempZip)) File.Delete(tempZip); } catch { }
            }
        }

        if (!File.Exists(exe)) return 1;

        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = exe,
            WorkingDirectory = appDir,
            Arguments = string.Join(" ", Array.ConvertAll(forwardArgs.ToArray(), arg => "\"" + arg.Replace("\"", "\\\"") + "\"")),
            UseShellExecute = false
        };
        try {
            if (forceUpdate) {
                // Launch updated desktop host detached so launcher exits cleanly
                Process.Start(psi);
                return 0;
            }
            using (Process p = Process.Start(psi)) {
                p.WaitForExit();
                return p.ExitCode;
            }
        } catch {
            return 1;
        }
    }
}
""".replace("__PAYLOAD_B64__", payload_b64).replace("__BUILD_STAMP__", build_stamp)

    temp_cs = os.path.join(ROOT, "deploy", "installer", "temp_launcher.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(cs_launcher)

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    icon_path = os.path.abspath("deploy/installer/app-icon.ico")

    if os.path.exists(csc_path):
        cmd = [
            csc_path,
            "/target:winexe",
            f"/out:{out_path}",
            "/optimize+",
            "/platform:x64",
            "/reference:System.dll,System.Windows.Forms.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll",
        ]
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        print(f"Compiling direct Sanctum.exe with csc.exe to {out_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_compile = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll" -OutputAssembly "{out_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_compile]
        print(f"Compiling direct Sanctum.exe with PowerShell to {out_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(temp_cs):
        os.remove(temp_cs)

    if res.returncode != 0:
        print(f"Launcher compilation error: {res.stderr}\n{res.stdout}")
        sys.exit(1)

    print(f"Compiled direct launcher to {out_path} ({os.path.getsize(out_path)} bytes)")
    sign_binary_if_configured(out_path)


def sign_binary_if_configured(binary_path: str) -> bool:
    """
    Authenticode-signs binary_path when SANCTUM_SIGN_PFX is set.
    No-op when no certificate is configured (suitable for unsigned local dev builds).
    """
    pfx_path = os.environ.get("SANCTUM_SIGN_PFX", "").strip()
    if not pfx_path:
        print(f"[sign] SANCTUM_SIGN_PFX not set; skipping Authenticode signing for {os.path.basename(binary_path)} (no-op).")
        return False
    if not os.path.exists(pfx_path):
        raise FileNotFoundError(f"SANCTUM_SIGN_PFX not found: {pfx_path}")

    pfx_pass = os.environ.get("SANCTUM_SIGN_PASS", "")
    ts_url = os.environ.get("SANCTUM_SIGN_TIMESTAMP_URL", "").strip()
    escaped_bin = os.path.abspath(binary_path).replace("'", "''")
    escaped_pfx = os.path.abspath(pfx_path).replace("'", "''")
    escaped_pass = pfx_pass.replace("'", "''")
    ts_flag = f"-TimestampServer '{ts_url}'" if ts_url else ""

    ps_script = (
        f"$sec = ConvertTo-SecureString -String '{escaped_pass}' -Force -AsPlainText; "
        f"$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{escaped_pfx}', $sec); "
        f"$r = Set-AuthenticodeSignature -FilePath '{escaped_bin}' -Certificate $cert -HashAlgorithm SHA256 {ts_flag}; "
        f"if (-not $r.SignerCertificate) {{ throw ('Signing failed: ' + $r.StatusMessage) }}; "
        f"Write-Output ('Signed: ' + $r.SignerCertificate.Subject + ' Status=' + $r.Status)"
    )
    res = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"Authenticode signing failed for {binary_path}: {res.stderr}\n{res.stdout}")
    print(f"[sign] {res.stdout.strip()}")
    return True


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--sign-only":
        sign_binary_if_configured(sys.argv[2])
    else:
        build_installer()
