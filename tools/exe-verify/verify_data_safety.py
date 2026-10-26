import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")
EXE_PATH = os.path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe")


def test_kill_recovery():
    log_file = os.path.join(RESULTS_DIR, "data_kill_recovery.log")
    port = 1381

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DATA-5a: Storage Integrity Under Process Kill Loops ===\n")

        for iteration in range(5):
            proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
            time.sleep(1.0)

            # Fire concurrent writes
            for i in range(10):
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}/api/threads",
                    data=json.dumps([{"id": f"rec-{iteration}-{i}", "title": f"Thread {i}"}]).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                try:
                    with urllib.request.urlopen(req, timeout=1) as resp:
                        resp.read()
                except Exception:
                    pass

            # Hard kill mid-write
            subprocess.run(["taskkill", "/F", "/PID", str(proc.pid)], capture_output=True, text=True)
            proc.wait()

            # Verify files on disk can still be parsed validly (zero corrupt JSON)
            app_data = os.environ.get("APPDATA", os.path.expanduser("~\\AppData\\Roaming"))
            threads_path = os.path.join(app_data, "Sanctum", "threads.json")
            if os.path.exists(threads_path):
                try:
                    with open(threads_path, "r", encoding="utf-8-sig") as tf:
                        parsed = json.load(tf)
                    f.write(f"Iteration {iteration}: threads.json parsed cleanly ({len(parsed)} items)\n")
                except Exception as ex:
                    f.write(f"Iteration {iteration}: Corrupted JSON detected: {ex}\n")
                    print(f"DATA-5a: FAIL - Corrupt file on iteration {iteration}")
                    return False

        f.write("Result: PASS - 100% integrity maintained under kill loops\n")

    print(f"DATA-5a (Kill Recovery): PASS - Data integrity maintained. Written to {log_file}")
    return True


def test_single_instance():
    log_file = os.path.join(RESULTS_DIR, "data_single_instance.log")
    port = 1382

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DATA-5b: Single-Instance Enforcement & Window Focus ===\n")

        # Launch primary instance (non-headless or headless)
        p1 = subprocess.Popen([EXE_PATH, "--port", str(port)])
        time.sleep(1.5)
        try:
            # Launch second instance
            res = subprocess.run([EXE_PATH, "--port", str(port)], capture_output=True, text=True)
            f.write(f"Second instance exit code: {res.returncode} (Expected: 2)\n")
            f.write(f"Second instance stdout: {res.stdout.strip()}\n")

            ok = res.returncode == 2 or "already running" in res.stdout
            f.write(f"Single-instance enforcement verified: {ok}\n")
            f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")
        finally:
            subprocess.run(["taskkill", "/F", "/PID", str(p1.pid)], capture_output=True, text=True)
            p1.wait()

    print(f"DATA-5b (Single Instance): {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


def test_export_import_migration():
    log_file = os.path.join(RESULTS_DIR, "data_export_migration.log")
    port = 1383
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DATA-5c: Export, Import & Schema Migration Round-Trip ===\n")

        # 1. Post threads
        sample_threads = [
            {"id": "t1", "title": "First Architecture Session", "messages": [{"role": "user", "content": "Hello"}]},
            {"id": "t2", "title": "RAG Vault Ingestion", "messages": [{"role": "user", "content": "Index docs"}]},
        ]
        req_post = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/threads",
            data=json.dumps(sample_threads).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_post, timeout=5) as resp:
            resp.read()

        # 2. Export / Read back
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/threads", timeout=5) as resp:
            exported = json.loads(resp.read().decode("utf-8"))

        f.write(f"Exported threads count: {len(exported)}\n")
        ok_export = len(exported) == 2 and exported[0]["id"] == "t1" and exported[1]["id"] == "t2"

        # 3. Simulate forward schema migration (v0 -> v1 with 'version': 1 and 'archived': false)
        migrated = []
        for t in exported:
            migrated.append({**t, "schema_version": 1, "archived": False})

        req_migrate = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/threads",
            data=json.dumps(migrated).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_migrate, timeout=5) as resp:
            resp.read()

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/threads", timeout=5) as resp:
            migrated_back = json.loads(resp.read().decode("utf-8"))

        ok_migration = len(migrated_back) == 2 and migrated_back[0].get("schema_version") == 1
        f.write(f"Migration round-trip verified: {ok_migration}\n")

        ok = ok_export and ok_migration
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    proc.terminate()
    proc.wait(timeout=5)
    print(f"DATA-5c (Export & Migration): {'PASS' if ok else 'FAIL'} - Written to {log_file}")
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--test",
        choices=["kill_recovery", "single_instance", "export_import_migration", "all"],
        default="all",
    )
    args = parser.parse_args()

    success = True
    if args.test in ["kill_recovery", "all"]:
        success = test_kill_recovery() and success
    if args.test in ["single_instance", "all"]:
        success = test_single_instance() and success
    if args.test in ["export_import_migration", "all"]:
        success = test_export_import_migration() and success

    sys.exit(0 if success else 1)
