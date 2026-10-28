import json
import subprocess
import sys
import time
import urllib.request


def get_current_sha():
    try:
        proc = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        return proc.stdout.strip()
    except Exception:
        return ""


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


def poll_ci(target_sha=None):
    if not target_sha:
        target_sha = sys.argv[1] if len(sys.argv) > 1 else get_current_sha()
    short_sha = target_sha[:7]
    print(f"Polling CI for head_sha={target_sha} ({short_sha})...", flush=True)

    token = get_github_token()
    headers = {"User-Agent": "Sanctum-CI-Poller"}
    if token:
        headers["Authorization"] = f"token {token}"

    for attempt in range(60):
        try:
            req = urllib.request.Request(
                "https://api.github.com/repos/avirooppal/Sanctum/actions/runs?per_page=10",
                headers=headers,
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                runs = data.get("workflow_runs", [])

                target_runs = [r for r in runs if r["head_sha"].startswith(short_sha)]
                if not target_runs:
                    print(f"Waiting for run on commit {short_sha} (attempt {attempt+1}/60)...", flush=True)
                    time.sleep(10)
                    continue

                all_done = True
                any_failed = False
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
                                f"  - Job: {j['name']} | status={j['status']} conclusion={j.get('conclusion')}",
                                flush=True,
                            )
                    if r["status"] != "completed":
                        all_done = False
                    elif r.get("conclusion") != "success":
                        any_failed = True

                if all_done:
                    if any_failed:
                        print(f"Runs for {short_sha} completed with FAILURE!", flush=True)
                        return False
                    print(f"All runs for {short_sha} completed successfully!", flush=True)
                    return True
        except Exception as e:
            print(f"Polling error: {e}", flush=True)
        time.sleep(15)
    return False


if __name__ == "__main__":
    success = poll_ci()
    sys.exit(0 if success else 1)

