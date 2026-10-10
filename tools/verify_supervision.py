"""Real confined guardian: TERM, parent death, natural exit, no surviving PIDs."""

import ctypes
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import time


def main():
    # Act as init for guardians orphaned by the intentional gateway SIGKILL.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "subreaper failed")
    results = []
    for mode in ("term", "parent-death", "natural"):
        args = [str(Path(sys.argv[1]).resolve()), "--port", "0", "--supervision-probe"]
        if mode == "natural":
            args.append("--natural")
        process = subprocess.Popen(args, stdout=subprocess.PIPE, text=True)
        pids = {}
        completed = False
        try:
            assert select.select([process.stdout], [], [], 10)[0], "no readiness"
            record = json.loads(process.stdout.readline())
            assert set(record) == {"guardian", "worker", "grandchild"}, record
            assert all(type(pid) is int and pid > 1 for pid in record.values())
            pids = record
            start = time.monotonic()
            if mode == "term":
                process.terminate()
            elif mode == "parent-death":
                process.kill()
            process.wait(timeout=3)
            assert process.returncode == (-signal.SIGKILL if mode == "parent-death" else 0)
            until = start + 3
            while time.monotonic() < until:
                # Reap only PIDs from this known owned fixture tree.
                for pid in pids.values():
                    try:
                        os.waitpid(pid, os.WNOHANG)
                    except ChildProcessError:
                        pass
                if all(not Path(f"/proc/{pid}").exists() for pid in pids.values()):
                    break
                time.sleep(0.01)
            elapsed = time.monotonic() - start
            assert all(not Path(f"/proc/{pid}").exists() for pid in pids.values()), pids
            assert elapsed < 2, elapsed
            results.append({"scenario": mode, "release_seconds": elapsed, "surviving_pids": 0})
            completed = True
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=3)
            # Failure cleanup only, never convert failed assertions into passes.
            for pid in () if completed else pids.values():
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    Path("evals/results/process-supervision.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
