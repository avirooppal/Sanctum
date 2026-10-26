import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def verify_installer():
    dist_exe = os.path.join(ROOT, "dist", "Sanctum-Setup-0.1.0-x64.exe")
    if not os.path.exists(dist_exe):
        print(f"Error: {dist_exe} does not exist. Run tools/build_installer.py first.")
        sys.exit(1)

    test_dir = os.path.join(ROOT, "build", "test_install")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir, ignore_errors=True)

    print(f"=== 1. Testing Silent Install into {test_dir} ===")
    install_cmd = [dist_exe, "/S", f"/D={test_dir}"]
    res = subprocess.run(install_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Install failed with code {res.returncode}: {res.stderr}")
        sys.exit(1)

    installed_exe = os.path.join(test_dir, "Sanctum-Desktop.exe")
    if not os.path.exists(installed_exe):
        print(f"Error: Installed binary {installed_exe} not found!")
        sys.exit(1)
    print(f"Installed binary verified: {installed_exe} ({os.path.getsize(installed_exe)} bytes)")

    print("=== 2. Testing CLI Flags (--version, --health) ===")
    v_res = subprocess.run([installed_exe, "--version"], capture_output=True, text=True)
    if "Sanctum Desktop 0.1.0" not in v_res.stdout:
        print(f"Version output mismatch: {v_res.stdout}")
        sys.exit(1)
    print(f"Version OK: {v_res.stdout.strip()}")

    h_res = subprocess.run([installed_exe, "--health"], capture_output=True, text=True)
    try:
        health_json = json.loads(h_res.stdout.strip())
        if health_json.get("status") != "ok" or health_json.get("app") != "Sanctum":
            print(f"Health response mismatch: {health_json}")
            sys.exit(1)
        print(f"Health JSON OK: {health_json}")
    except Exception as e:
        print(f"Failed to parse health JSON: {h_res.stdout} ({e})")
        sys.exit(1)

    print("=== 3. Testing Loopback Server in Headless Mode ===")
    proc = subprocess.Popen([installed_exe, "--headless", "--port", "1339"])
    time.sleep(1.5)
    try:
        with urllib.request.urlopen("http://127.0.0.1:1339/api/health", timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") != "ok":
                print(f"HTTP health mismatch: {data}")
                sys.exit(1)
            print(f"HTTP Endpoint /api/health OK: {data}")

        # Check frontend index.html served
        with urllib.request.urlopen("http://127.0.0.1:1339/", timeout=5) as resp:
            html = resp.read().decode("utf-8")
            if "Sanctum" not in html and "<div id=\"root\">" not in html:
                print("HTML frontend did not serve root container!")
                sys.exit(1)
            print("HTTP Frontend index.html served cleanly.")
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    print("=== 4. Testing Clean Uninstaller ===")
    uninst_exe = os.path.join(test_dir, "Uninstall.exe")
    if os.path.exists(uninst_exe):
        u_res = subprocess.run([uninst_exe, "/S"], capture_output=True, text=True)
        time.sleep(2)
        print("Uninstaller executed cleanly.")

    print("\nALL INSTALLER VERIFICATIONS PASSED (Silent install, CLI flags, HTTP serving, uninstallation)")

if __name__ == "__main__":
    verify_installer()
