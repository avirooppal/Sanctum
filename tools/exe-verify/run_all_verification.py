import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERIFY_DIR = os.path.join(ROOT, "tools", "exe-verify")
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")


def run_suite(name: str, script_name: str, *args):
    print(f"\n============================================================")
    print(f"RUNNING SUITE: {name}")
    print(f"============================================================")
    cmd = [sys.executable, os.path.join(VERIFY_DIR, script_name)] + list(args)
    res = subprocess.run(cmd, cwd=ROOT)
    if res.returncode != 0:
        print(f"SUITE {name} FAILED with return code {res.returncode}")
        return False
    print(f"SUITE {name} PASSED.")
    return True


def main():
    print("STARTING SANCTUM WINDOWS .EXE COMPLETE VERIFICATION RUN")
    suites = [
        ("STANDALONE EMBEDDED WINDOW (Section 0)", "verify_standalone_window.py", "--test=all"),
        ("BUILD & HYGIENE (Section 1)", "verify_build.py", "--step=all"),
        ("INSTALLER LIFECYCLE (Section 2)", "verify_installer.py", "--scenario=all"),
        ("RUNTIME RESOURCES (Section 3)", "verify_resources.py", "--scenario=all", "--duration=10", "--cycles=15"),
        ("DOWNLOADS & EGRESS (Section 4)", "verify_downloads.py", "--test=all"),
        ("DATA SAFETY & CORRECTNESS (Section 5)", "verify_data_safety.py", "--test=all"),
        ("SECURITY & PRIVACY (Section 6)", "verify_security.py", "--test=all"),
        ("PERFORMANCE & UX (Section 7)", "verify_performance.py", "--test=all"),
    ]

    results = {}
    for name, script, *args in suites:
        ok = run_suite(name, script, *args)
        results[name] = ok

    all_pass = all(results.values())
    summary_file = os.path.join(RESULTS_DIR, "compat_win11.log")
    with open(summary_file, "w", encoding="utf-8") as f:
        f.write("=== COMPAT-8a: Windows 11 Native Host Complete Verification ===\n\n")
        f.write(f"OS: Windows 11 x64\n")
        f.write(f"Overall Result: {'PASS' if all_pass else 'FAIL'}\n\n")
        for name, ok in results.items():
            f.write(f"  - {name}: {'PASS' if ok else 'FAIL'}\n")

    print("\n============================================================")
    print("VERIFICATION RUN SUMMARY")
    print("============================================================")
    for name, ok in results.items():
        print(f"{name:45}: {'PASS' if ok else 'FAIL'}")
    print(f"\nFinal Status: {'ALL PASS' if all_pass else 'FAILURES DETECTED'}")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
