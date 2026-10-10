from contextlib import nullcontext
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.engine_admission import wait_execution


class ExecutionDeadlineTests(unittest.TestCase):
    def test_expired_work_never_acquires_an_available_execution_lease(self):
        with patch(
            "sanctum_knowledge.engine_admission.acquire", return_value=nullcontext()
        ) as acquire:
            with self.assertRaises(TimeoutError):
                with wait_execution(Path("."), "port-9100", time.monotonic() - 1):
                    self.fail("expired work started")
            acquire.assert_not_called()
