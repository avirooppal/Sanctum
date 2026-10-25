import base64
import os
import shutil
import subprocess
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

    makensis = find_makensis()
    if makensis:
        print(f"=== Step 2: Compiling with NSIS ({makensis}) ===")
        nsi_path = os.path.join(ROOT, "deploy", "installer", "sanctum.nsi")
        cmd = [makensis, nsi_path]
        subprocess.run(cmd, check=True)
        print("NSIS build finished successfully.")
    else:
        print("=== Step 2: Compiling self-extracting NSIS-compatible installer wrapper ===")
        build_self_extracting_installer(out_installer)

    print("=== Step 3: Packaging Distribution Artifacts ===")
    from package_distribution import package

    package()
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
        Process[] runningProcs = Process.GetProcessesByName("Sanctum-Desktop");
        if (runningProcs.Length > 0) {
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
                MessageBox.Show("Sanctum 1.0.0 installed successfully!", "Sanctum Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);
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


if __name__ == "__main__":
    build_installer()
