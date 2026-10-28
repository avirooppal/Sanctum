# Windows packaging

The supported desktop build uses the C# WebView2 host in
`tools/compile_desktop_host.py`. From the repository root on Windows:

```powershell
npm ci
python tools/build_installer.py
python tools/package_distribution.py
```

Prerequisites: Node.js 22.6+, Python 3, the Windows .NET Framework C# compiler,
and the checked-in WebView2 SDK assemblies under `vendor/webview2/`.
The installed application also requires the WebView2 runtime.

The build compiles the Next.js frontend, copies it into the generated
`deploy/installer/build_payload/`, and compiles the desktop host, uninstaller,
self-extracting installer and launcher. `package_distribution.py` produces the
portable ZIP, checksums and dependency manifest in `dist/`.

Generated payloads and test installations under `build/` are ignored. Published
`dist/` binaries remain tracked for users downloading the Windows application.
The NSIS recipe and `src-tauri/` configuration remain as documented alternate
packaging references; the build above does not invoke them.

See [verification procedures](../docs/EXE_VERIFICATION.md) and
[generated evidence policy](../evals/README.md).
