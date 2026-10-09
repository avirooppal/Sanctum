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


class WorkerJudgeTests(unittest.TestCase):
    def test_judge_request_uses_worker_retrieval_evidence(self):
        from worker import answer_or_judge

        class StubModels:
            def judge(self, query, hits, answer):
                return {"supported": bool(hits and answer == "evidence")}

            def answer(self, query, hits):
                return {"answer": "generated"}

        result = answer_or_judge(
            StubModels(), {"query": "question", "judge_answer": "evidence"}, [{"text": "evidence"}]
        )
        self.assertTrue(result["supported"])

    def test_judge_answer_size_and_type_are_validated(self):
        from worker import answer_or_judge

        class StubModels:
            def judge(self, *_args):
                raise AssertionError("invalid candidate reached judge")

            def answer(self, *_args):
                return {}

        for candidate in (None, "x" * 12001):
            with self.assertRaisesRegex(ValueError, "invalid judge answer"):
                answer_or_judge(StubModels(), {"query": "question", "judge_answer": candidate}, [])


if __name__ == "__main__":
    unittest.main()
