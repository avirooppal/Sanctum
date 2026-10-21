import json
import subprocess
import urllib.request


def get_github_auth():
    try:
        p = subprocess.Popen(
            ["git", "credential", "fill"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        out, _ = p.communicate(input="protocol=https\nhost=github.com\n\n")
        for line in out.splitlines():
            if line.startswith("password="):
                token = line.split("=", 1)[1].strip()
                if token:
                    return {"Authorization": f"Bearer {token}", "User-Agent": "Sanctum-CI-Poller"}
    except Exception:
        pass
    return {"User-Agent": "Sanctum-CI-Poller"}


def check_runs():
    headers = get_github_auth()
    req = urllib.request.Request(
        "https://api.github.com/repos/avirooppal/Sanctum/actions/runs?per_page=5",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            runs = data.get("workflow_runs", [])
            for r in runs:
                print(
                    f"Run ID: {r['id']} | Name: {r['name']} | Branch: {r['head_branch']} | SHA: {r['head_sha'][:7]} | Status: {r['status']} | Conclusion: {r.get('conclusion')}"
                )

            for r in runs:
                if r["status"] in ["in_progress", "queued"]:
                    run_id = r["id"]
                    jobs_req = urllib.request.Request(
                        f"https://api.github.com/repos/avirooppal/Sanctum/actions/runs/{run_id}/jobs",
                        headers=headers,
                    )
                    try:
                        with urllib.request.urlopen(jobs_req) as jresp:
                            jdata = json.loads(jresp.read().decode("utf-8"))
                            for j in jdata.get("jobs", []):
                                print(
                                    f"  [{r['head_branch']} {r['head_sha'][:7]}] Job: {j['name']} | Status: {j['status']} | Conclusion: {j.get('conclusion')}"
                                )
                    except Exception:
                        pass
    except Exception as e:
        print(f"Error fetching runs: {e}")


if __name__ == "__main__":
    check_runs()
