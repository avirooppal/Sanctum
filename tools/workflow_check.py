"""Validate canonical journey IDs, budgets, test mappings and documentation."""

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def registry(root: Path) -> dict:
    data = json.loads((root / "evals/journeys/manifest.json").read_text(encoding="utf-8"))
    entries = data["journeys"]
    if len(entries) != 12 or {j["id"] for j in entries} != {f"J{i}" for i in range(1, 13)}:
        raise ValueError("Registry requires exactly J1-J12")
    for entry in entries:
        identifier = entry["id"]
        if entry["test_id"] != f"journey:{identifier}":
            raise ValueError("Journey test ID mismatch")
        if entry["status"] not in {"VERIFIED", "PARTIAL", "PENDING"}:
            raise ValueError("Unknown journey status")
        if entry["status"] != "VERIFIED" and not entry["blocker"]:
            raise ValueError("Unverified journey needs a blocker")
        if entry["steps"] != [f"{identifier}.{i}" for i in range(1, len(entry["steps"]) + 1)]:
            raise ValueError("Journey steps must be ordered without gaps")
        if not entry["steps"]:
            raise ValueError("Journey requires steps")
    return data


def accepted_tests(root: Path) -> set[str]:
    identifiers = []
    files = sorted((root / "evals/journeys").glob("test_*.py"))
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(
                node, (ast.FunctionDef, ast.AsyncFunctionDef)
            ) or not node.name.startswith("test_"):
                continue
            tags = [
                decorator.args[0].value
                for decorator in node.decorator_list
                if isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Name)
                and decorator.func.id == "journey"
                and len(decorator.args) == 1
                and isinstance(decorator.args[0], ast.Constant)
            ]
            if len(tags) != 1:
                raise ValueError(f"Unannotated or multiply annotated journey test: {node.name}")
            identifiers.extend(tags)
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("Duplicate journey test ID")
    return set(identifiers)


def check(root: Path) -> list[str]:
    try:
        data = registry(root)
        entries = data["journeys"]
        expected = {j["id"]: j["status"] for j in entries}
        adr = (root / "docs/adr/0071-canonical-owner-journeys.md").read_text(encoding="utf-8")
        budgets = {
            identifier: {
                "clicks": int(clicks),
                "navigation_keys": int(keys),
                "text_entries": int(fields),
            }
            for identifier, clicks, keys, fields in re.findall(
                r"^\| (J\d+) \| (\d+) \| (\d+) \| (\d+) \|$", adr, re.M
            )
        }
        if any(entry["budget"] != budgets.get(entry["id"]) for entry in entries):
            raise ValueError("Journey budget drift from ADR0071")
        smoke = ast.parse((root / "tools/smoke_all.py").read_text(encoding="utf-8"))
        mapping, stage_names = None, []
        for node in ast.walk(smoke):
            if not isinstance(node, ast.Assign):
                continue
            names = {target.id for target in node.targets if isinstance(target, ast.Name)}
            if "STAGE_JOURNEYS" in names:
                mapping = ast.literal_eval(node.value)
            if "stages" in names and isinstance(node.value, ast.List):
                stage_names = [stage.elts[0].value for stage in node.value.elts]
        if not isinstance(mapping, dict) or set(mapping) != set(stage_names):
            raise ValueError("Missing or orphan smoke stage journey mapping")
        if any(
            not ids or any(identifier not in expected for identifier in ids)
            for ids in mapping.values()
        ):
            raise ValueError("Unknown journey in smoke mapping")
        supporting = data["supporting_test_roots"]
        if any(
            not group["journeys"] or not set(group["journeys"]) <= set(expected)
            for group in supporting
        ):
            raise ValueError("Unknown journey in supporting test mapping")
        for folder in (
            "apps/cli/tests",
            "apps/web/tests",
            "services",
            "tools/tests",
            "evals/tests",
        ):
            for path in (root / folder).rglob("*"):
                candidate = (
                    path.suffix == ".py"
                    and path.name.startswith("test_")
                    or path.name.endswith(".test.mjs")
                    or path.suffix == ".rs"
                    and "tests" in path.parts
                )
                if candidate and path.is_file():
                    relative = path.relative_to(root)
                    if not any(relative.is_relative_to(group["root"]) for group in supporting):
                        raise ValueError(f"Unmapped supporting test: {relative.as_posix()}")
        if accepted_tests(root) != set(expected):
            raise ValueError("Journey/test IDs do not match bidirectionally")
        for name in ("docs/WORKFLOW.md", "docs/RELEASE_CHECKLIST.md"):
            text = (root / name).read_text(encoding="utf-8")
            rows = re.findall(r"^\| (J\d+) \| (VERIFIED|PARTIAL|PENDING) \|", text, re.M)
            if len(rows) != 12 or dict(rows) != expected:
                raise ValueError(f"Journey status drift: {name}")
        workflow = (root / "docs/WORKFLOW.md").read_text(encoding="utf-8")
        if f"Version: {data['version']}." not in workflow:
            raise ValueError("Workflow version drift")
        steps = {step for entry in entries for step in entry["steps"]}
        for name in ("docs/WORKFLOW.md", "docs/WORKFLOW_GAPS.md"):
            rows = re.findall(
                r"^\| (J\d+\.\d+) \|", (root / name).read_text(encoding="utf-8"), re.M
            )
            if len(rows) != len(steps) or set(rows) != steps:
                raise ValueError(f"Missing,duplicate or orphan journey step: {name}")
    except (OSError, ValueError, KeyError, TypeError, SyntaxError) as exc:
        return [str(exc)]
    return []


def main() -> int:
    errors = check(ROOT)
    print(json.dumps({"workflow_check": "FAIL" if errors else "PASS", "errors": errors}))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
