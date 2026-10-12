#!/usr/bin/env python3
import json
import sys
import urllib.request


def check_ci(branch="ui-workspace", target_sha=None):
    url = f"https://api.github.com/repos/avirooppal/Sanctum/actions/runs?branch={branch}&per_page=5"
    req = urllib.request.Request(url, headers={"User-Agent": "Sanctum-CI-Poller"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Failed to query CI: {e}")
        return False, None

    runs = data.get("workflow_runs", [])
    if not runs:
        print("No workflow runs found.")
        return False, None

    latest = runs[0]
    run_id = latest["id"]
    sha = latest["head_sha"]
    status = latest["status"]
    conclusion = latest["conclusion"]

    print(f"Run {run_id} (commit {sha[:7]}): status={status}, conclusion={conclusion}")
    if target_sha and not sha.startswith(target_sha):
        print(f"Waiting for target commit {target_sha} (currently at {sha[:7]})")
        return False, latest

    if status == "completed":
        if conclusion == "success":
            return True, latest
        else:
            print(f"CI failed with conclusion: {conclusion}")
            sys.exit(1)
    return False, latest


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    done, run = check_ci(target_sha=target)
    if done:
        print("CI SUCCESS!")
        sys.exit(0)
    else:
        sys.exit(2)
