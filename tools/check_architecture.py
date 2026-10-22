#!/usr/bin/env python3
"""
Sanctum Architecture & Boundary Enforcement Gate
Verifies layer isolation, dependency direction, and absence of AI logic in UI components.

Usage:
    python tools/check_architecture.py [--report-only]
"""

import os
import re
import sys
import argparse

FORBIDDEN_PATTERNS_IN_UI = [
    (r"<think>", "AI Chain-of-Thought parsing regex embedded in UI component"),
    (r"num_gpu|num_ctx|num_thread", "Low-level engine hardware flags embedded in UI component"),
]

FORBIDDEN_IMPORTS_IN_CORE = [
    (r'from ["\'].*components/.*["\']', "Core module imports UI presentation component"),
    (r'from ["\']react["\']', "Core non-UI module imports React"),
]

def scan_file(filepath, patterns):
    matches = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            for pattern, desc in patterns:
                if re.search(pattern, content):
                    matches.append(desc)
    except Exception as e:
        matches.append(f"Error reading file: {e}")
    return matches

def check_architecture(report_only=False):
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    violations = []

    # 1. Scan UI directories for forbidden AI logic
    ui_dirs = [
        os.path.join(root_dir, "src", "components"),
        os.path.join(root_dir, "apps", "ui"),
    ]
    for d in ui_dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for file in files:
                if file.endswith((".tsx", ".jsx", ".ts", ".js")):
                    path = os.path.join(root, file)
                    rel = os.path.relpath(path, root_dir)
                    issues = scan_file(path, FORBIDDEN_PATTERNS_IN_UI)
                    for issue in issues:
                        violations.append(f"UI Violation in {rel}: {issue}")

    # 2. Scan core directories for forbidden UI imports
    core_dirs = [
        os.path.join(root_dir, "core"),
        os.path.join(root_dir, "src", "lib"),
    ]
    for d in core_dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for file in files:
                if file.endswith((".ts", ".js")):
                    path = os.path.join(root, file)
                    rel = os.path.relpath(path, root_dir)
                    issues = scan_file(path, FORBIDDEN_IMPORTS_IN_CORE)
                    for issue in issues:
                        violations.append(f"Core Violation in {rel}: {issue}")

    print("=" * 60)
    print("SANCTUM ARCHITECTURE ENFORCEMENT CHECK")
    print("=" * 60)

    if violations:
        print(f"Found {len(violations)} architectural boundary item(s):")
        for v in violations:
            print(f"  • {v}")
        if not report_only:
            print("\nFAILED: Architectural violations present.")
            return 1
        else:
            print("\nREPORT-ONLY: Recorded. Clean refactoring slice in progress.")
            return 0
    else:
        print("PASSED: 0 architectural violations found. Clean layer separation.")
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check Sanctum architecture boundaries")
    parser.add_argument("--report-only", action="store_true", help="Report violations without failing exit code")
    args = parser.parse_args()
    sys.exit(check_architecture(report_only=args.report_only))
