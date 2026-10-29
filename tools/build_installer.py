import base64
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

    dist_dir = os.path.join(ROOT, "dist")
    os.makedirs(dist_dir, exist_ok=True)
    out_installer = os.path.join(dist_dir, f"Sanctum-Setup-{VERSION}-x64.exe")

    print("=== Step 2: Compiling self-extracting NSIS-compatible installer wrapper ===")
    build_self_extracting_installer(out_installer)
    print("=== Build Complete ===")


def build_self_extracting_installer(out_path: str):
    payload_dir = os.path.join(ROOT, "deploy", "installer", "build_payload")
    zip_path = os.path.join(ROOT, "deploy", "installer", "payload.zip")

    print("Creating compressed payload archive...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(payload_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, payload_dir)
                zf.write(full_path, rel_path)

    with open(zip_path, "rb") as f:
        payload_bytes = f.read()
    payload_b64 = base64.b64encode(payload_bytes).decode("ascii")

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
        using (ZipArchive archive = ZipFile.OpenRead(zipPath)) {
            foreach (ZipArchiveEntry entry in archive.Entries) {
                string destPath = Path.Combine(targetDir, entry.FullName);
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
            "$s1 = $ws.CreateShortcut('" + Path.Combine(desktop, "Sanctum.lnk") + "'); $s1.TargetPath = '" + exe + "'; $s1.Save(); " +
            "$s2 = $ws.CreateShortcut('" + Path.Combine(sanctumMenu, "Sanctum.lnk") + "'); $s2.TargetPath = '" + exe + "'; $s2.Save();";

        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -Command \"" + ps + "\"",
            CreateNoWindow = true,
            UseShellExecute = false
        };
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
    git_commit = hashlib.sha256(base64.b64decode(payload_b64)).hexdigest()

    cs_launcher = r"""using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;

[assembly: AssemblyTitle("Sanctum")]
[assembly: AssemblyDescription("Sanctum Standalone Desktop Application")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

public class SanctumLauncher {
    public static int Main(string[] args) {
        string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string appDir = Path.Combine(localApp, "Programs", "Sanctum");
        string exe = Path.Combine(appDir, "Sanctum-Desktop.exe");
        string wvLoader = Path.Combine(appDir, "WebView2Loader.dll");
        string stampFile = Path.Combine(appDir, "build_stamp.txt");
        string expectedStamp = "__BUILD_STAMP__";

        bool needsUnpack = !File.Exists(exe) || !File.Exists(wvLoader) || !File.Exists(stampFile);
        if (!needsUnpack) {
            try {
                string actualStamp = File.ReadAllText(stampFile).Trim();
                if (actualStamp != expectedStamp) needsUnpack = true;
            } catch {
                needsUnpack = true;
            }
        }

        if (needsUnpack) {
            try {
                foreach (Process oldProc in Process.GetProcessesByName("Sanctum-Desktop")) {
                    try {
                        if (!string.Equals(oldProc.MainModule.FileName, exe, StringComparison.OrdinalIgnoreCase)) continue;
                    } catch { continue; }
                    if (!oldProc.CloseMainWindow() || !oldProc.WaitForExit(10000)) {
                        System.Windows.Forms.MessageBox.Show("Please close Sanctum, then run this launcher again. Your workspace has been preserved.", "Sanctum update");
                        return 1;
                    }
                }
                Directory.CreateDirectory(appDir);
                string tempZip = Path.Combine(Path.GetTempPath(), "sanctum_unpack_" + Guid.NewGuid().ToString("N") + ".zip");
                byte[] zipData = Convert.FromBase64String("__PAYLOAD_B64__");
                File.WriteAllBytes(tempZip, zipData);
                using (ZipArchive archive = ZipFile.OpenRead(tempZip)) {
                    foreach (ZipArchiveEntry entry in archive.Entries) {
                        string destPath = Path.Combine(appDir, entry.FullName);
                        if (string.IsNullOrEmpty(entry.Name)) {
                            Directory.CreateDirectory(destPath);
                        } else {
                            Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                            entry.ExtractToFile(destPath, true);
                        }
                    }
                }
                File.WriteAllText(stampFile, expectedStamp);
                try { File.Delete(tempZip); } catch { }
            } catch (Exception error) {
                System.Windows.Forms.MessageBox.Show("Could not update Sanctum: " + error.Message, "Sanctum update failed");
                return 1;
            }
        }

        if (!File.Exists(exe)) return 1;

        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = exe,
            WorkingDirectory = appDir,
            Arguments = string.Join(" ", Array.ConvertAll(args, arg => "\"" + arg.Replace("\"", "\\\"") + "\"")),
            UseShellExecute = false
        };
        try {
            using (Process p = Process.Start(psi)) {
                p.WaitForExit();
                return p.ExitCode;
            }
        } catch {
            return 1;
        }
    }
}
""".replace("__PAYLOAD_B64__", payload_b64).replace("__BUILD_STAMP__", git_commit)

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


if __name__ == "__main__":
    build_installer()
