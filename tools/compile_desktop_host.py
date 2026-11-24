import os
import shutil
import subprocess
import sys


def compile_desktop_host(output_path: str):
    out_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(out_dir, exist_ok=True)

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    wv2_dir = os.path.join(root_dir, "vendor", "webview2")

    # Ensure WebView2 & Newtonsoft.Json DLLs are copied beside the output executable
    for dll_name in ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll"]:
        src_dll = os.path.join(wv2_dir, dll_name)
        dst_dll = os.path.join(out_dir, dll_name)
        if os.path.exists(src_dll) and os.path.abspath(src_dll) != os.path.abspath(dst_dll):
            shutil.copy2(src_dll, dst_dll)

    newtonsoft_dll = os.path.abspath(os.path.join(root_dir, "vendor", "newtonsoft", "Newtonsoft.Json.dll"))
    if os.path.exists(newtonsoft_dll):
        dst_nj = os.path.join(out_dir, "Newtonsoft.Json.dll")
        if os.path.abspath(newtonsoft_dll) != os.path.abspath(dst_nj):
            shutil.copy2(newtonsoft_dll, dst_nj)

    git_commit = "1d382e3"
    try:
        rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
        if rev.returncode == 0 and rev.stdout.strip():
            git_commit = rev.stdout.strip()
    except Exception:
        pass

    host_cs = os.path.join(root_dir, "tools", "native", "DesktopHost.cs")
    with open(host_cs, "r", encoding="utf-8") as f:
        cs_source = f.read().replace("__GIT_COMMIT__", git_commit)
    temp_cs = os.path.abspath("temp_desktop_host.cs")
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(cs_source)

    manifest_xml = r"""<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="Sanctum.Desktop"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 & 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
    </windowsSettings>
  </application>
</assembly>"""
    manifest_path = os.path.abspath("temp_app.manifest")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(manifest_xml)

    roslyn_csc = os.path.abspath(os.path.join(root_dir, "vendor", "roslyn", "csc.exe"))
    inbox_csc = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    csc_path = roslyn_csc if os.path.exists(roslyn_csc) else inbox_csc
    use_roslyn = (csc_path == roslyn_csc)
    icon_path = os.path.abspath("deploy/installer/app-icon.ico")
    wv2_core_dll = os.path.abspath(os.path.join(wv2_dir, "Microsoft.Web.WebView2.Core.dll"))
    wv2_winforms_dll = os.path.abspath(os.path.join(wv2_dir, "Microsoft.Web.WebView2.WinForms.dll"))

    if os.path.exists(csc_path):
        fx_dir = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319"
        refs = [
            os.path.join(fx_dir, "mscorlib.dll"),
            os.path.join(fx_dir, "System.dll"),
            os.path.join(fx_dir, "System.Core.dll"),
            os.path.join(fx_dir, "System.IO.Compression.dll"),
            os.path.join(fx_dir, "System.IO.Compression.FileSystem.dll"),
            r"C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Speech\v4.0_4.0.0.0__31bf3856ad364e35\System.Speech.dll",
            r"C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Management.Automation\v4.0_3.0.0.0__31bf3856ad364e35\System.Management.Automation.dll",
            os.path.join(fx_dir, "System.Web.Extensions.dll"),
            os.path.join(fx_dir, "System.Management.dll"),
            os.path.join(fx_dir, "System.Drawing.dll"),
            os.path.join(fx_dir, "System.Windows.Forms.dll"),
            os.path.join(fx_dir, "System.Runtime.Serialization.dll"),
            wv2_core_dll,
            wv2_winforms_dll,
        ]
        if os.path.exists(newtonsoft_dll):
            refs.append(newtonsoft_dll)
        cmd = [
            csc_path,
            "/nostdlib+" if use_roslyn else "/nologo",
            "/nologo",
            "/target:winexe",
            f"/out:{output_path}",
            f"/win32manifest:{manifest_path}",
            "/optimize+",
            "/platform:x64",
        ]
        if use_roslyn:
            cmd.append("/langversion:12.0")
        for r in refs:
            cmd.append(f"/reference:{r}")
        if os.path.exists(icon_path):
            cmd.append(f"/win32icon:{icon_path}")
        cmd.append(temp_cs)
        cmd.append(os.path.abspath("tools/native/DesktopServices.cs"))
        cmd.append(os.path.abspath("tools/native/DesktopWorkspaceEndpoints.cs"))
        cmd.append(os.path.abspath("tools/native/DesktopBrowserEndpoints.cs"))
        cmd.append(os.path.abspath("tools/native/DesktopMcpEndpoints.cs"))
        harness_dir = os.path.abspath(os.path.join(root_dir, "tools", "native", "harness"))
        if os.path.isdir(harness_dir):
            for fname in sorted(os.listdir(harness_dir)):
                if fname.endswith(".cs"):
                    cmd.append(os.path.join(harness_dir, fname))
        compiler_label = "vendored Roslyn 5.12.0 (C# 12 -> net472)" if use_roslyn else "inbox csc.exe"
        print(f"Compiling Sanctum Standalone Embedded WebView2 host using {compiler_label} to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)
    else:
        ps_script = f'''
$source = Get-Content -Raw -Path "{temp_cs}"
Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll", "{wv2_core_dll}", "{wv2_winforms_dll}" -OutputAssembly "{output_path}" -OutputType WindowsApplication
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        print(f"Compiling Sanctum Standalone Embedded WebView2 host using PowerShell to {output_path}...")
        res = subprocess.run(cmd, capture_output=True, text=True)

    for tmp in (temp_cs, manifest_path):
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass

    if res.returncode != 0:
        print(f"Compilation error: {res.stderr}\n{res.stdout}")
        sys.exit(1)

    if not os.path.exists(output_path):
        print(f"Output executable {output_path} was not created!")
        sys.exit(1)

    print(f"Successfully compiled {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "deploy/installer/build_payload/Sanctum-Desktop.exe"
    compile_desktop_host(out)
