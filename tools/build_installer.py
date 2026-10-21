import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def find_makensis():
    # Check PATH
    cmd = shutil.which("makensis")
    if cmd:
        return cmd

    # Check common Windows paths
    candidates = [
        r"C:\Program Files (x86)\NSIS\makensis.exe",
        r"C:\Program Files\NSIS\makensis.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def build_installer():
    # Step 1: Prepare Payload
    print("=== Step 1: Preparing Installer Payload ===")
    from prepare_installer_payload import prepare
    prepare()

    dist_dir = os.path.join(ROOT, "dist")
    os.makedirs(dist_dir, exist_ok=True)
    out_installer = os.path.join(dist_dir, "Sanctum-Setup-0.1.0-x64.exe")

    makensis = find_makensis()
    if makensis:
        print(f"=== Step 2: Compiling with NSIS ({makensis}) ===")
        nsi_path = os.path.join(ROOT, "deploy", "installer", "sanctum.nsi")
        cmd = [makensis, nsi_path]
        res = subprocess.run(cmd, check=True)
        print("NSIS build finished successfully.")
    else:
        print("=== Step 2: makensis not found in current environment ===")
        print("Compiling self-extracting NSIS-compatible installer wrapper...")
        build_self_extracting_installer(out_installer)

    # Step 3: Distribution Packaging (SHA256, SBOM, Licenses)
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

    # C# Setup wrapper code embedding payload.zip as byte array or base64
    with open(zip_path, "rb") as f:
        payload_bytes = f.read()
    payload_b64 = import_base64_payload(zip_path)

    cs_setup = r'''
using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

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

        try {
            Directory.CreateDirectory(installDir);

            // Extract embedded ZIP payload
            string tempZip = Path.Combine(Path.GetTempPath(), "sanctum_payload_" + Guid.NewGuid().ToString("N") + ".zip");
            byte[] zipData = Convert.FromBase64String("__PAYLOAD_B64__");
            File.WriteAllBytes(tempZip, zipData);

            // Unpack files
            ExtractZip(tempZip, installDir);
            File.Delete(tempZip);

            // Create Registry Entries in HKCU
            string uninstKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Sanctum";
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(uninstKey)) {
                if (key != null) {
                    key.SetValue("DisplayName", "Sanctum");
                    key.SetValue("DisplayVersion", "0.1.0");
                    key.SetValue("Publisher", "Sanctum Contributors");
                    key.SetValue("InstallLocation", installDir);
                    key.SetValue("UninstallString", "\"" + Path.Combine(installDir, "Uninstall.exe") + "\"");
                    key.SetValue("QuietUninstallString", "\"" + Path.Combine(installDir, "Uninstall.exe") + "\" /S");
                    key.SetValue("DisplayIcon", Path.Combine(installDir, "Sanctum-Desktop.exe"));
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
            }

            // Compile clean Uninstaller
            CompileUninstaller(installDir);

            // Create Shortcuts
            CreateShortcuts(installDir);

            if (!silent) {
                MessageBox.Show("Sanctum 0.1.0 has been successfully installed!", "Sanctum Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            return 0;
        } catch (Exception ex) {
            if (!silent) {
                MessageBox.Show("Installation failed: " + ex.Message, "Sanctum Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            return 1;
        }
    }

    private static void ExtractZip(string zipPath, string extractPath) {
        // Use PowerShell built-in Expand-Archive for maximum reliability across .NET versions
        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -Command \"Expand-Archive -Force -LiteralPath '" + zipPath + "' -DestinationPath '" + extractPath + "'\"",
            CreateNoWindow = true,
            UseShellExecute = false
        };
        using (Process p = Process.Start(psi)) {
            p.WaitForExit();
        }
    }

    private static void CreateShortcuts(string installDir) {
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        string sanctumMenu = Path.Combine(programs, "Sanctum");
        Directory.CreateDirectory(sanctumMenu);

        string exe = Path.Combine(installDir, "Sanctum-Desktop.exe");
        string ps = "$ws = New-Object -ComObject WScript.Shell; " +
                    "$s = $ws.CreateShortcut('" + Path.Combine(desktop, "Sanctum.lnk") + "'); $s.TargetPath = '" + exe + "'; $s.Save(); " +
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

    private static void CompileUninstaller(string installDir) {
        string uninstCs = Path.Combine(installDir, "uninstaller.cs");
        string uninstExe = Path.Combine(installDir, "Uninstall.exe");
        string code = @"
using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

public class Uninstaller {
    [STAThread]
    public static int Main(string[] args) {
        bool silent = false;
        foreach (string a in args) {
            if (a.Equals(""/S"", StringComparison.OrdinalIgnoreCase)) silent = true;
        }

        if (!silent) {
            DialogResult dr = MessageBox.Show(""Are you sure you want to uninstall Sanctum?"", ""Uninstall Sanctum"", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (dr != DialogResult.Yes) return 0;
        }

        string installDir = AppDomain.CurrentDomain.BaseDirectory;
        
        // Remove shortcuts
        try {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string desktopLnk = Path.Combine(desktop, ""Sanctum.lnk"");
            if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

            string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string sanctumMenu = Path.Combine(programs, ""Sanctum"");
            if (Directory.Exists(sanctumMenu)) Directory.Delete(sanctumMenu, true);
        } catch { }

        // Remove registry key
        try {
            Registry.CurrentUser.DeleteSubKeyTree(@""Software\Microsoft\Windows\CurrentVersion\Uninstall\Sanctum"", false);
            Registry.CurrentUser.DeleteSubKeyTree(@""Software\Sanctum"", false);
        } catch { }

        // Ask before deleting user data
        if (!silent) {
            DialogResult delData = MessageBox.Show(""Do you want to delete your local Sanctum chat history and settings in %APPDATA%\Sanctum?"", ""Sanctum Data"", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (delData == DialogResult.Yes) {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), ""Sanctum"");
                if (Directory.Exists(appData)) Directory.Delete(appData, true);
            }
        }

        // Self delete via batch
        string bat = Path.Combine(Path.GetTempPath(), ""sanctum_cleanup.bat"");
        File.WriteAllText(bat, ""@echo off\r\nping 127.0.0.1 -n 2 > nul\r\nrmdir /s /q \"""" + installDir + ""\""\r\ndel \""%~f0\""\r\n"");
        Process.Start(new ProcessStartInfo { FileName = bat, CreateNoWindow = true, UseShellExecute = false });

        return 0;
    }
}
";
        File.WriteAllText(uninstCs, code);
        string ps = "Add-Type -TypeDefinition (Get-Content -Raw '" + uninstCs + "') -Language CSharp -ReferencedAssemblies 'System.Windows.Forms.dll' -OutputAssembly '" + uninstExe + "' -OutputType WindowsApplication";
        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -Command \"" + ps + "\"",
            CreateNoWindow = true,
            UseShellExecute = false
        };
        using (Process p = Process.Start(psi)) {
            p.WaitForExit();
        }
        if (File.Exists(uninstCs)) File.Delete(uninstCs);
    }
}
'''.replace("__PAYLOAD_B64__", payload_b64)
    temp_cs = os.path.join(ROOT, "deploy", "installer", "temp_setup.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(cs_setup)

    ps_compile = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll" -OutputAssembly "{out_path}" -OutputType WindowsApplication
'''
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_compile]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(temp_cs):
        os.remove(temp_cs)
    if os.path.exists(zip_path):
        os.remove(zip_path)

    if res.returncode != 0:
        print(f"Setup compilation error: {res.stderr}")
        sys.exit(1)

    print(f"Compiled self-extracting installer to {out_path} ({os.path.getsize(out_path)} bytes)")

def import_base64_payload(zip_path: str) -> str:
    import base64
    with open(zip_path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")

if __name__ == "__main__":
    build_installer()
