"""Uncooperative nested worker, used only by the process supervision gate."""

import json
import os
import signal
import subprocess
import sys
import time

signal.signal(signal.SIGINT, signal.SIG_IGN)
signal.signal(signal.SIGTERM, signal.SIG_IGN)
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
print(
    json.dumps({"guardian": os.getppid(), "worker": os.getpid(), "grandchild": child.pid}),
    flush=True,
)
if "--natural" not in sys.argv:
    while True:
        time.sleep(0.05)
