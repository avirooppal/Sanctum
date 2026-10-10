"""Read-only evaluation counters inside the owner gateway's private network namespace."""

import json
from pathlib import Path
import selectors
import subprocess
import sys
import urllib.request


def active_slots(value):
    if not isinstance(value, list) or not value:
        raise ValueError("missing engine slot counters")
    if any(
        not isinstance(slot, dict) or type(slot.get("is_processing")) is not bool for slot in value
    ):
        raise ValueError("malformed engine slot counters")
    return sum(slot["is_processing"] for slot in value)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("observer redirects prohibited")


class Observer:
    def __init__(self, pid, config):
        self.process = subprocess.Popen(
            [
                "nsenter",
                "--no-fork",
                "-t",
                str(pid),
                "-U",
                "-n",
                "--preserve-credentials",
                "--",
                sys.executable,
                str(Path(__file__).resolve()),
                str(config.resolve()),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )

    def query(self, role):
        self.process.stdin.write(json.dumps({"role": role}) + "\n")
        self.process.stdin.flush()
        with selectors.DefaultSelector() as selector:
            selector.register(self.process.stdout, selectors.EVENT_READ)
            if not selector.select(timeout=1):
                raise TimeoutError("engine observer deadline")
        value = json.loads(self.process.stdout.readline())
        if type(value.get("active")) is not int or value["active"] < 0:
            raise ValueError("engine observer failed")
        return value["active"]

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try:
                self.process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.process.stdout.close()
        self.process.stderr.close()


def main():
    config = json.loads(Path(sys.argv[1]).read_text())
    ports = {
        role: config[role]["port"] for role in ["chat", "embedding", "reranker"] if config.get(role)
    }
    if any(type(port) is not int or not 1 <= port <= 65535 for port in ports.values()):
        raise ValueError("invalid observer port")
    interfaces = [
        line.split(":")[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()
        if ":" in line
    ]
    if interfaces != ["lo"]:
        raise ValueError("private namespace required")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    while True:
        line = sys.stdin.buffer.readline(257)
        if not line:
            break
        if len(line) > 256:
            raise ValueError("oversized observer request")
        request = json.loads(line)
        role = request["role"]
        if role not in ports:
            raise ValueError("unknown observer role")
        with opener.open(f"http://127.0.0.1:{ports[role]}/slots", timeout=0.5) as response:
            data = response.read(65537)
        if len(data) > 65536:
            raise ValueError("oversized observer counters")
        print(json.dumps({"active": active_slots(json.loads(data))}), flush=True)


if __name__ == "__main__":
    main()
