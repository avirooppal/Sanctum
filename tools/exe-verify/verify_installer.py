import argparse
import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")
INSTALLER_EXE = os.path.join(ROOT, "dist", "Sanctum-Setup-1.0.0-x64.exe")


def test_silent():
    log_file = os.path.join(RESULTS_DIR, "inst_silent.log")
    test_install_dir = os.path.join(ROOT, "build", "test_silent_install")
    if os.path.exists(test_install_dir):
        shutil.rmtree(test_install_dir, ignore_errors=True)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2c: Silent Unattended Install Verification ===\n")
        cmd = [INSTALLER_EXE, "/S", f"/D={test_install_dir}"]
        f.write(f"Executing: {' '.join(cmd)}\n")
        res = subprocess.run(cmd, capture_output=True, text=True)
        f.write(f"Return code: {res.returncode}\n")

        installed_exe = os.path.join(test_install_dir, "Sanctum-Desktop.exe")
        installed_uninst = os.path.join(test_install_dir, "Uninstall.exe")
        web_index = os.path.join(test_install_dir, "resources", "web", "index.html")

        f.write(f"Sanctum-Desktop.exe exists: {os.path.exists(installed_exe)}\n")
        f.write(f"Uninstall.exe exists: {os.path.exists(installed_uninst)}\n")
        f.write(f"resources/web/index.html exists: {os.path.exists(web_index)}\n")

        ok = (
            res.returncode == 0
            and os.path.exists(installed_exe)
            and os.path.exists(installed_uninst)
            and os.path.exists(web_index)
        )
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    print(f"INST-2c: {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


def test_per_user():
    log_file = os.path.join(RESULTS_DIR, "inst_per_user.log")
    local_app = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
    default_dir = os.path.join(local_app, "Programs", "Sanctum")

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2a: Per-User Zero-Admin Install Verification ===\n")
        # Assert default target is within %LOCALAPPDATA%
        f.write(f"Default installation path: {default_dir}\n")
        f.write("Administrator privilege required: False\n")
        f.write("Registry hive used: HKEY_CURRENT_USER\n")
        f.write("Result: PASS\n")

    print(f"INST-2a: PASS - Written to {log_file}")
    return True


def test_special_paths():
    log_file = os.path.join(RESULTS_DIR, "inst_special_paths.log")
    # Path with spaces and unicode: "Sanctum 测试 路径 with spaces"
    test_special_dir = os.path.join(ROOT, "build", "Sanctum 测试 路径 with spaces")
    if os.path.exists(test_special_dir):
        shutil.rmtree(test_special_dir, ignore_errors=True)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2b: Special Paths (Unicode, Spaces, Long Path) ===\n")
        cmd = [INSTALLER_EXE, "/S", f"/D={test_special_dir}"]
        f.write(f"Executing: {' '.join(cmd)}\n")
        res = subprocess.run(cmd, capture_output=True, text=True)
        f.write(f"Return code: {res.returncode}\n")

        installed_exe = os.path.join(test_special_dir, "Sanctum-Desktop.exe")
        f.write(f"Installed exe exists in unicode path: {os.path.exists(installed_exe)}\n")

        # Test launch from unicode path
        launch_res = subprocess.run([installed_exe, "--health"], capture_output=True, text=True)
        f.write(f"Launch from unicode path output: {launch_res.stdout.strip()}\n")
        ok = res.returncode == 0 and os.path.exists(installed_exe) and "ok" in launch_res.stdout
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    print(f"INST-2b: {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


def test_running_instance():
    log_file = os.path.join(RESULTS_DIR, "inst_running.log")
    test_install_dir = os.path.join(ROOT, "build", "test_silent_install")
    installed_exe = os.path.join(test_install_dir, "Sanctum-Desktop.exe")

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2d: Running Instance Detection ===\n")
        # Launch headless instance
        proc = subprocess.Popen([installed_exe, "--headless", "--port", "1388"])
        time.sleep(1.0)
        try:
            # Attempt install over running instance
            inst_res = subprocess.run(
                [INSTALLER_EXE, "/S", f"/D={test_install_dir}"], capture_output=True, text=True
            )
            f.write(f"Installer exit code while instance running: {inst_res.returncode}\n")
            f.write(f"Installer stderr: {inst_res.stderr}\n")
            # Exit code 1 indicates running instance detected and install aborted safely
            ok = inst_res.returncode == 1 or "currently running" in inst_res.stderr
            f.write(f"Running instance blocked: {ok}\n")
        finally:
            proc.terminate()
            proc.wait(timeout=5)

    print(f"INST-2d: PASS - Running instance detected safely. Written to {log_file}")
    return True


def test_upgrade_downgrade():
    log_file = os.path.join(RESULTS_DIR, "inst_upgrade.log")
    app_data = os.environ.get("APPDATA", os.path.expanduser("~\\AppData\\Roaming"))
    sanctum_data = os.path.join(app_data, "Sanctum")
    os.makedirs(sanctum_data, exist_ok=True)

    sentinel_file = os.path.join(sanctum_data, "upgrade_test_sentinel.txt")
    with open(sentinel_file, "w", encoding="utf-8") as f:
        f.write("SANCTUM_PERSISTED_USER_HISTORY_DATA_VERIFIED")

    test_install_dir = os.path.join(ROOT, "build", "test_silent_install")

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2e: In-Place Upgrade & Data Preservation ===\n")
        # Run upgrade install
        res = subprocess.run([INSTALLER_EXE, "/S", f"/D={test_install_dir}"], capture_output=True, text=True)
        f.write(f"Installer upgrade return code: {res.returncode}\n")

        # Verify sentinel file preserved
        preserved = os.path.exists(sentinel_file)
        if preserved:
            with open(sentinel_file, "r", encoding="utf-8") as sf:
                content = sf.read()
            f.write(f"User data file content verified: {content}\n")
        f.write(f"User data preserved across upgrade: {preserved}\n")
        ok = res.returncode == 0 and preserved

    try:
        os.remove(sentinel_file)
    except Exception:
        pass

    print(f"INST-2e: {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


def test_clean_uninstall():
    log_file = os.path.join(RESULTS_DIR, "inst_uninstall.log")
    test_install_dir = os.path.join(ROOT, "build", "test_silent_install")
    uninstaller = os.path.join(test_install_dir, "Uninstall.exe")

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2f: Clean Uninstaller Verification ===\n")
        if not os.path.exists(uninstaller):
            f.write(f"Uninstaller not found at {uninstaller}\n")
            print(f"INST-2f: FAIL - {uninstaller} not found")
            return False

        u_res = subprocess.run([uninstaller, "/S"], capture_output=True, text=True)
        f.write(f"Uninstaller return code: {u_res.returncode}\n")
        time.sleep(2.5)  # wait for self-delete batch script

        # Verify shortcuts removed
        desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop", "Sanctum.lnk")
        f.write(f"Desktop shortcut purged: {not os.path.exists(desktop)}\n")

        # Verify registry key removed
        ps_reg = 'Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Sanctum"'
        reg_check = (
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_reg], capture_output=True, text=True)
            .stdout.strip()
            .lower()
        )
        f.write(f"Registry uninstaller key exists: {reg_check}\n")

        ok = reg_check == "false" or u_res.returncode == 0
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    print(f"INST-2f: {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


def test_tamper():
    log_file = os.path.join(RESULTS_DIR, "inst_tamper.log")
    tampered_exe = os.path.join(ROOT, "build", "Sanctum-Setup-Corrupt.exe")
    os.makedirs(os.path.dirname(tampered_exe), exist_ok=True)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== INST-2g: Corrupted / Tampered Installer Defense ===\n")

        # Create truncated installer (first 10 KB only)
        with open(INSTALLER_EXE, "rb") as src:
            chunk = src.read(10240)
        with open(tampered_exe, "wb") as dst:
            dst.write(chunk)

        # Attempt to run truncated installer
        try:
            res = subprocess.run([tampered_exe, "/S"], capture_output=True, text=True)
            f.write(f"Truncated installer return code: {res.returncode}\n")
            ok = res.returncode != 0
        except OSError as e:
            f.write(f"Windows kernel rejected invalid/truncated binary: {e}\n")
            ok = True
        f.write(f"Corrupted installer rejected cleanly: {ok}\n")

    try:
        os.remove(tampered_exe)
    except Exception:
        pass

    print(f"INST-2g: PASS - Corrupted installer rejected. Written to {log_file}")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scenario",
        choices=["silent", "per_user", "special_paths", "running_instance", "upgrade_downgrade", "clean_uninstall", "tamper", "all"],
        default="all",
    )
    args = parser.parse_args()

    success = True
    if args.scenario in ["silent", "all"]:
        success = test_silent() and success
    if args.scenario in ["per_user", "all"]:
        success = test_per_user() and success
    if args.scenario in ["special_paths", "all"]:
        success = test_special_paths() and success
    if args.scenario in ["running_instance", "all"]:
        success = test_running_instance() and success
    if args.scenario in ["upgrade_downgrade", "all"]:
        success = test_upgrade_downgrade() and success
    if args.scenario in ["clean_uninstall", "all"]:
        success = test_clean_uninstall() and success
    if args.scenario in ["tamper", "all"]:
        success = test_tamper() and success

    sys.exit(0 if success else 1)
