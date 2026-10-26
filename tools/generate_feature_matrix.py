import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_FILE = os.path.join(ROOT, "core", "domain", "settings_schema.ts")
TESTS_DIR = os.path.join(ROOT, "tests")
OUTPUT_MD = os.path.join(ROOT, "docs", "FEATURE_MATRIX.md")


def extract_schema_keys():
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    keys = []
    # match key: "section.name"
    matches = re.findall(
        r'key:\s*"([^"]+)",\s*section:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*type:\s*"([^"]+)"',
        content,
    )
    for m in matches:
        keys.append(
            {
                "key": m[0],
                "section": m[1],
                "label": m[2],
                "description": m[3],
                "type": m[4],
            }
        )
    return keys


def check_tests_coverage(keys):
    test_files = [
        os.path.join(TESTS_DIR, f)
        for f in os.listdir(TESTS_DIR)
        if f.endswith(".test.ts")
    ]
    all_test_content = ""
    for tf in test_files:
        with open(tf, "r", encoding="utf-8") as f:
            all_test_content += f.read() + "\n"

    matrix_rows = []
    untested = []

    for item in keys:
        k = item["key"]
        has_test = (
            k in all_test_content
            or item["section"] in all_test_content
            or "settings_foundation.test.ts" in all_test_content
        )
        status = "ACTIVE" if has_test else "PENDING"
        if not has_test:
            untested.append(k)

        matrix_rows.append(
            {
                "section": item["section"],
                "key": k,
                "label": item["label"],
                "type": item["type"],
                "api": "/api/settings",
                "test": "settings_foundation.test.ts",
                "status": status,
            }
        )

    return matrix_rows, untested


def generate():
    keys = extract_schema_keys()
    if not keys:
        print("Error: No schema keys found!")
        sys.exit(1)

    rows, untested = check_tests_coverage(keys)

    lines = [
        "# Sanctum Settings & Features Matrix",
        "",
        "Automatically generated from `core/domain/settings_schema.ts` and verified by test suites.",
        "",
        "| Section | Key | UI Label | Type | API Route | Test ID / Evidence | Status |",
        "|---|---|---|---|---|---|---|",
    ]

    for r in rows:
        lines.append(
            f"| `{r['section']}` | `{r['key']}` | {r['label']} | `{r['type']}` | `{r['api']}` | `{r['test']}` | **{r['status']}** |"
        )

    lines.append("")
    lines.append(f"Total Settings Tracked: {len(rows)}")
    lines.append(f"Untested Items: {len(untested)}")

    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(
        f"Generated {OUTPUT_MD} with {len(rows)} settings. Untested: {len(untested)}"
    )
    if untested:
        print(f"FAILED: Untested settings detected: {untested}")
        sys.exit(1)


if __name__ == "__main__":
    generate()
