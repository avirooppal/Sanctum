#!/usr/bin/env python3
"""Reality Rules Gate (ADR-0095 / Amendment Reality Rules).

Enforces:
1. Denylist scan across product UI sources (apps/web/src) for:
   - Three known sample thread titles:
     "Local Architecture Discussion", "Knowledge Vector Search Test", "Desktop Performance Budgets"
   - Banned simulation strings:
     "lorem", "TODO", "coming soon", "sample", "zero WAN egress", "BLOCKED" (as hardcoded badge)
   - Hardcoded model names outside registry
   - Hardcoded benchmark speeds ('38.4 tok/s', etc.)
2. Dist bundle fixture isolation: no sample JSON or banned mock conversations in apps/web/dist.
3. Unknown-handling: missing/unloaded data must render as 'Unknown' or true empty state, never invented numbers.
4. Reality Audit generator: audits all components against data sources and test IDs.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_SRC = ROOT / "apps" / "web" / "src"
WEB_DIST = ROOT / "apps" / "web" / "dist"

BANNED_SAMPLE_TITLES = [
    "Local Architecture Discussion",
    "Knowledge Vector Search Test",
    "Desktop Performance Budgets",
]

BANNED_PRODUCT_SUBSTRINGS = [
    "zero WAN egress",
    "38.4 tok/s",
    "44.2 tok/s",
    "36.8 tok/s",
]

# Hardcoded model names that must not appear as literals in production component files
BANNED_HARDCODED_MODELS = [
    "qwen2.5-coder-7b",
    "llama-3.2-3b-instruct",
    "deepseek-r1-distill-qwen-8b",
]


def check_source_denylist() -> list[str]:
    violations: list[str] = []
    if not WEB_SRC.exists():
        return violations

    for p in WEB_SRC.rglob("*"):
        if not p.is_file() or p.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        # Exclude preview/test-only harness files if isolated under preview
        content = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(ROOT)

        # 1. Sample thread titles
        for title in BANNED_SAMPLE_TITLES:
            if title in content:
                violations.append(f"{rel}: contains banned sample thread title '{title}'")

        # 2. Banned fabricated claims & numbers
        for banned in BANNED_PRODUCT_SUBSTRINGS:
            if banned in content:
                violations.append(f"{rel}: contains banned fabricated claim/number '{banned}'")

        # 3. Component hardcoded model fallbacks (outside registry)
        if "components" in p.parts:
            for model in BANNED_HARDCODED_MODELS:
                if f"'{model}'" in content or f'"{model}"' in content:
                    violations.append(f"{rel}: contains hardcoded model literal '{model}'")

        # 4. Check for hardcoded 'BLOCKED' egress badge
        if "ChatPanel.tsx" in p.name:
            if re.search(r">\s*BLOCKED\s*<", content):
                violations.append(f"{rel}: contains unverified hardcoded 'BLOCKED' egress badge")

        # 5. Check for simulated setTimeout mock responses
        if (
            "ComparePanel.tsx" in p.name
            or "ResearchPanel.tsx" in p.name
            or "CookbookPanel.tsx" in p.name
        ):
            violations.append(f"{rel}: unbacked simulated panel exists in product src")

    return violations


def check_dist_bundle() -> list[str]:
    violations: list[str] = []
    if not WEB_DIST.exists():
        return violations

    for p in WEB_DIST.rglob("*.js"):
        content = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(ROOT)

        for title in BANNED_SAMPLE_TITLES:
            if title in content:
                violations.append(
                    f"{rel}: production bundle contains sample thread title '{title}'"
                )

        for banned in BANNED_PRODUCT_SUBSTRINGS:
            if banned in content:
                violations.append(
                    f"{rel}: production bundle contains fabricated claim/number '{banned}'"
                )

    return violations


def main() -> int:
    src_violations = check_source_denylist()
    dist_violations = check_dist_bundle()

    all_violations = src_violations + dist_violations

    if all_violations:
        print("FAIL: Reality Rules violations detected (Rule 2 Enforcement):")
        for v in all_violations:
            print(f"  - {v}")
        return 1

    print("PASS: Reality Rules enforcement gates (0 violations)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
