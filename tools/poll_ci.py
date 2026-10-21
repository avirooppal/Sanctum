import json
import urllib.request


def check_runs():
    req = urllib.request.Request(
        "https://api.github.com/repos/avirooppal/Sanctum/actions/runs?per_page=5",
        headers={"User-Agent": "Sanctum-CI-Poller"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            runs = data.get("workflow_runs", [])
            for r in runs:
                print(
                    f"Run ID: {r['id']} | Name: {r['name']} | Branch: {r['head_branch']} | SHA: {r['head_sha'][:7]} | Status: {r['status']} | Conclusion: {r.get('conclusion')}"
                )

            if runs and runs[0]["status"] == "in_progress":
                run_id = runs[0]["id"]
                jobs_req = urllib.request.Request(
                    f"https://api.github.com/repos/avirooppal/Sanctum/actions/runs/{run_id}/jobs",
                    headers={"User-Agent": "Sanctum-CI-Poller"},
                )
                with urllib.request.urlopen(jobs_req) as jresp:
                    jdata = json.loads(jresp.read().decode("utf-8"))
                    for j in jdata.get("jobs", []):
                        print(
                            f"  - Job: {j['name']} | Status: {j['status']} | Conclusion: {j.get('conclusion')}"
                        )
    except Exception as e:
        print(f"Error fetching runs: {e}")


if __name__ == "__main__":
    check_runs()
