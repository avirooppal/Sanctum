import urllib.request
import json
import sys
import time

def check_runs():
    req = urllib.request.Request(
        "https://api.github.com/repos/avirooppal/Sanctum/actions/runs?per_page=5",
        headers={"User-Agent": "Sanctum-CI-Poller"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for r in data.get("workflow_runs", []):
                print(f"Run ID: {r['id']} | Name: {r['name']} | Branch: {r['head_branch']} | SHA: {r['head_sha'][:7]} | Status: {r['status']} | Conclusion: {r.get('conclusion')}")
    except Exception as e:
        print(f"Error fetching runs: {e}")

if __name__ == "__main__":
    check_runs()
