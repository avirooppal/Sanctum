"""Repeated real-engine start/active-stop, with the launcher reaping each gateway."""

import argparse
import json
from pathlib import Path
import selectors
import subprocess
import sys
import threading
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cycles", type=int, default=3)
    args = parser.parse_args()
    results = []
    try:
        for index in range(args.cycles):
            with args.output.with_suffix(f".{index}.log").open("w") as log:
                process = subprocess.Popen(
                    [str(args.binary.resolve()), "--config", str(args.config), "--port", "8769"],
                    stdout=subprocess.PIPE,
                    stderr=log,
                    text=True,
                )
                reaper = threading.Thread(target=process.wait)
                reaper.start()
                try:
                    with selectors.DefaultSelector() as selector:
                        selector.register(process.stdout, selectors.EVENT_READ)
                        assert selector.select(timeout=240), "runtime startup did not finish"
                    ready = json.loads(process.stdout.readline())
                    assert ready["ready"]
                    output = args.output.with_name(args.output.stem + f"-{index}.json")
                    started = time.monotonic()
                    completed = subprocess.run(
                        [
                            sys.executable,
                            "evals/active_shutdown.py",
                            "--pid",
                            str(process.pid),
                            "--token-file",
                            ready["token_file"],
                            "--output",
                            str(output),
                        ],
                        capture_output=True,
                        text=True,
                        timeout=60,
                    )
                    assert completed.returncode == 0, completed.stderr
                    reaper.join(timeout=5)
                    assert not reaper.is_alive() and process.returncode == 0
                    results.append(
                        {
                            "cycle": index,
                            "seconds_including_job_setup": time.monotonic() - started,
                            "evidence": str(output),
                            "result": json.loads(output.read_text()),
                        }
                    )
                    print(json.dumps(results[-1]), flush=True)
                finally:
                    if process.poll() is None:
                        process.terminate()
                        reaper.join(timeout=5)
                    if process.poll() is None:
                        process.kill()
                        reaper.join(timeout=5)
                    process.stdout.close()
    finally:
        args.output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
