import json
import subprocess
import time
import urllib.request


def get_github_token():
    try:
        proc = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n",
            capture_output=True,
            text=True,
            check=True,
        )
        for line in proc.stdout.splitlines():
            if line.startswith("password="):
                return line.split("password=", 1)[1].strip()
    except Exception:
        pass
    return None


def poll_ci():
    token = get_github_token()
    headers = {"User-Agent": "Sanctum-CI-Poller"}
    if token:
        headers["Authorization"] = f"token {token}"

    for attempt in range(60):
        try:
            req = urllib.request.Request(
                "https://api.github.com/repos/avirooppal/Sanctum/actions/runs?per_page=5",
                headers=headers,
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                runs = data.get("workflow_runs", [])

                target_runs = [r for r in runs if r["head_sha"].startswith("58a5a9d")]
                if not target_runs:
                    print("No runs found for commit 58a5a9d yet...")
                    time.sleep(10)
                    continue

                all_done = True
                for r in target_runs:
                    print(
                        f"Run {r['id']} ({r.get('event')}/{r.get('head_branch')}): status={r['status']} conclusion={r.get('conclusion')}",
                        flush=True,
                    )
                    jobs_req = urllib.request.Request(
                        f"https://api.github.com/repos/avirooppal/Sanctum/actions/runs/{r['id']}/jobs",
                        headers=headers,
                    )
                    with urllib.request.urlopen(jobs_req) as jresp:
                        jdata = json.loads(jresp.read().decode("utf-8"))
                        for j in jdata.get("jobs", []):
                            print(
                                f"  - Job: {j['name']} | status={j['status']} conclusion={j.get('conclusion')}"
                            )
                    if r["status"] != "completed":
                        all_done = False

                if all_done:
                    print("All runs for 58a5a9d completed!")
                    return True
        except Exception as e:
            print(f"Polling error: {e}")
        time.sleep(15)
    return False


if __name__ == "__main__":
    poll_ci()
