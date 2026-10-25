import os
import subprocess
import sys

CSHARP_UNINSTALLER = r"""using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;

[assembly: AssemblyTitle("Sanctum Uninstaller")]
[assembly: AssemblyDescription("Sanctum Desktop Uninstaller")]
[assembly: AssemblyCompany("Sanctum Contributors")]
[assembly: AssemblyProduct("Sanctum")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

public class Uninstaller {
    [STAThread]
    public static int Main(string[] args) {
        bool silent = false;
        foreach (string a in args) {
            if (a.Equals("/S", StringComparison.OrdinalIgnoreCase) || a.Equals("-s", StringComparison.OrdinalIgnoreCase)) {
                silent = true;
            }
        }

        if (!silent) {
            DialogResult dr = MessageBox.Show("Are you sure you want to uninstall Sanctum?", "Uninstall Sanctum", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (dr != DialogResult.Yes) return 0;
        }

        string installDir = AppDomain.CurrentDomain.BaseDirectory;

        // 1. Remove Desktop & Start Menu Shortcuts
        try {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string desktopLnk = Path.Combine(desktop, "Sanctum.lnk");
            if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

            string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string sanctumMenu = Path.Combine(programs, "Sanctum");
            if (Directory.Exists(sanctumMenu)) Directory.Delete(sanctumMenu, true);
        } catch { }

        // 2. Remove Registry Keys
        try {
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Sanctum", false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Sanctum", false);
        } catch { }

        // 3. User Data Prompt (Prompt before deleting user data)
        if (!silent) {
            DialogResult delData = MessageBox.Show("Do you want to delete your local Sanctum chat history, models, and settings in %APPDATA%\\Sanctum?", "Sanctum Data", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (delData == DialogResult.Yes) {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sanctum");
                if (Directory.Exists(appData)) Directory.Delete(appData, true);
            }
        }

        // 4. Clean self-delete via batch script
        string bat = Path.Combine(Path.GetTempPath(), "sanctum_cleanup_" + Guid.NewGuid().ToString("N") + ".bat");
        string batCode = "@echo off\r\nping 127.0.0.1 -n 2 > nul\r\nrmdir /s /q \"" + installDir + "\"\r\ndel \"%~f0\"\r\n";
        File.WriteAllText(bat, batCode);
        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = bat,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        Process.Start(psi);

        return 0;
    }
}
"""


def compile_uninstaller(output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    temp_cs = os.path.abspath("temp_uninstaller.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(CSHARP_UNINSTALLER)

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    icon_path = os.path.abspath("deploy/installer/app-icon.ico")

    if os.path.exists(csc_path):
        cmd = [
            csc_path,
            "/target:winexe",
            f"/out:{output_path}",
            "/optimize+",
            "/platform:x64",
            "/reference:System.dll,System.Windows.Forms.dll",
        ]
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        print(f"Compiling Sanctum Uninstaller using csc.exe to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_script = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll" -OutputAssembly "{output_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        print(f"Compiling Sanctum Uninstaller using PowerShell to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(temp_cs):
        os.remove(temp_cs)

    if res.returncode != 0:
        print(f"Uninstaller compilation error: {res.stderr}\n{res.stdout}")
        sys.exit(1)

    print(f"Successfully compiled {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "deploy/installer/build_payload/Uninstall.exe"
    compile_uninstaller(out)
