import signal
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class WorkerDeadlineTests(unittest.TestCase):
    def test_operation_deadline_raises_recoverable_timeout(self):
        from worker import operation_deadline

        with self.assertRaisesRegex(TimeoutError, "operation deadline exceeded"):
            operation_deadline(getattr(signal, "SIGALRM", 14), None)


if __name__ == "__main__":
    unittest.main()
