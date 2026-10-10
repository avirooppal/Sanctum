import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cancellation_release import descendants


class DescendantTests(unittest.TestCase):
    def test_follows_children_from_every_thread_and_nested_process(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for pid, tid, children in [(101, 101, "102"), (101, 103, "104"), (102, 102, "105")]:
                target = root / str(pid) / "task" / str(tid)
                target.mkdir(parents=True)
                (target / "children").write_text(children)
            self.assertEqual(descendants(101, root), {102, 104, 105})
