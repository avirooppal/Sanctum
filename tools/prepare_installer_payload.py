import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def prepare():
    payload_dir = os.path.join(ROOT, "deploy", "installer", "build_payload")
    os.makedirs(payload_dir, exist_ok=True)

    # 1. Generate Sanctum Geometric Brand Icon
    print("Generating Sanctum brand icon...")
    from generate_icon import generate_sanctum_icon
    generate_sanctum_icon(os.path.join(ROOT, "deploy", "installer"))
    shutil.copy2(
        os.path.join(ROOT, "deploy", "installer", "app-icon.ico"),
        os.path.join(payload_dir, "app-icon.ico")
    )

    # 2. Build Web Frontend Assets
    web_dir = os.path.join(ROOT, "apps", "web")
    web_dist = os.path.join(web_dir, "dist")
    print(f"Building web frontend in {web_dir}...")
    subprocess.run(["npm", "run", "build"], cwd=web_dir, check=True, shell=True)

    target_web = os.path.join(payload_dir, "resources", "web")
    if os.path.exists(target_web):
        shutil.rmtree(target_web)
    os.makedirs(os.path.dirname(target_web), exist_ok=True)
    shutil.copytree(web_dist, target_web)

    # Provide index.html entrypoint for desktop web view
    index_html = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sanctum</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121214; color: #f4f4f5; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./desktop.js"></script>
</body>
</html>"""
    with open(os.path.join(target_web, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html)
    print(f"Copied web bundle and wrote index.html to {target_web}")

    # 3. Compile Desktop Host Executable
    exe_target = os.path.join(payload_dir, "Sanctum-Desktop.exe")
    from compile_desktop_host import compile_desktop_host
    compile_desktop_host(exe_target)

    # 4. Resources bin directory (engine worker / backend)
    bin_target = os.path.join(payload_dir, "resources", "bin")
    os.makedirs(bin_target, exist_ok=True)

    print("Payload preparation complete.")

if __name__ == "__main__":
    prepare()
