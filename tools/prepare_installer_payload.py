import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def prepare():
    payload_dir = os.path.join(ROOT, "deploy", "installer", "build_payload")
    os.makedirs(payload_dir, exist_ok=True)

    # 1. Icon
    icon_src = os.path.join(ROOT, "deploy", "installer", "app-icon.ico")
    if not os.path.exists(icon_src):
        try:
            from generate_icon import generate_sanctum_icon

            generate_sanctum_icon(os.path.join(ROOT, "deploy", "installer"))
        except Exception:
            pass
    if os.path.exists(icon_src):
        shutil.copy2(icon_src, os.path.join(payload_dir, "app-icon.ico"))

    # 2. Prepare Web Frontend Assets from Next.js build
    target_web = os.path.join(payload_dir, "resources", "web")
    if os.path.exists(target_web):
        shutil.rmtree(target_web, ignore_errors=True)
    os.makedirs(target_web, exist_ok=True)

    # Check if .next build exists, build if not
    html_src = os.path.join(ROOT, ".next", "server", "app", "index.html")
    static_src = os.path.join(ROOT, ".next", "static")
    if not os.path.exists(html_src) or not os.path.exists(static_src):
        print("Building Next.js frontend...")
        subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True, shell=True)

    # Copy index.html
    shutil.copy2(html_src, os.path.join(target_web, "index.html"))

    # Copy _next/static
    target_next_static = os.path.join(target_web, "_next", "static")
    os.makedirs(os.path.dirname(target_next_static), exist_ok=True)
    shutil.copytree(static_src, target_next_static)

    # Copy public assets
    public_src = os.path.join(ROOT, "public")
    if os.path.exists(public_src):
        for item in os.listdir(public_src):
            s = os.path.join(public_src, item)
            d = os.path.join(target_web, item)
            if os.path.isdir(s):
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)

    print(f"Copied Next.js web bundle to {target_web}")

    # 3. Compile Desktop Host Executable
    exe_target = os.path.join(payload_dir, "Sanctum-Desktop.exe")
    from compile_desktop_host import compile_desktop_host

    compile_desktop_host(exe_target)

    # 4. Compile Uninstaller Executable
    uninst_target = os.path.join(payload_dir, "Uninstall.exe")
    from compile_uninstaller import compile_uninstaller

    compile_uninstaller(uninst_target)

    # 5. Resources bin directory
    bin_target = os.path.join(payload_dir, "resources", "bin")
    os.makedirs(bin_target, exist_ok=True)

    print("Payload preparation complete.")


if __name__ == "__main__":
    prepare()
