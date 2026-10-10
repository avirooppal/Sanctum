import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evals"))
from speech_eval import evaluate, word_error_rate  # noqa: E402


class SpeechEvaluationTests(unittest.TestCase):
    def test_word_error_rate_normalizes_case_unicode_and_punctuation(self):
        self.assertEqual(word_error_rate("HÉLLO, WORLD!", "héllo world"), 0.0)
        self.assertEqual(word_error_rate("don't stop", "dont stop"), 0.0)

    def test_word_error_rate_counts_substitutions_insertions_and_deletions(self):
        self.assertEqual(word_error_rate("the quick brown fox", "the slow brown"), 0.5)

    def test_empty_reference_is_rejected(self):
        with self.assertRaises(ValueError):
            word_error_rate("", "recognized words")

    def test_evaluate_reports_weighted_wer_by_language_and_voice_metrics(self):
        payload = {
            "suite": "fixture",
            "dataset_license": "CC0-1.0",
            "profile_id": "test-profile",
            "hardware_tier": "T1",
            "wer_target": 0.25,
            "records": [
                {
                    "id": "one",
                    "audio_sha256": "a" * 64,
                    "language": "en-US",
                    "reference": "one two three",
                    "hypothesis": "one too three",
                    "audio_seconds": 4,
                    "asr_seconds": 2,
                },
                {
                    "id": "two",
                    "audio_sha256": "b" * 64,
                    "language": "en-US",
                    "reference": "four five",
                    "hypothesis": "four five",
                    "audio_seconds": 2,
                    "asr_seconds": 1,
                },
            ],
            "voice_turns": [
                {
                    "id": "one",
                    "audio_sha256": "a" * 64,
                    "first_audio_ms": 700,
                    "barge_in_success": True,
                },
                {
                    "id": "two",
                    "audio_sha256": "b" * 64,
                    "first_audio_ms": 900,
                    "barge_in_success": False,
                },
            ],
        }
        with tempfile.TemporaryDirectory() as temp:
            dataset = Path(temp) / "speech.json"
            output = Path(temp) / "result.json"
            dataset.write_text(json.dumps(payload))
            result = evaluate(dataset, output)
        self.assertEqual(result["wer"], 0.2)
        self.assertEqual(result["by_language"]["en-US"]["wer"], 0.2)
        self.assertEqual(result["asr_real_time_factor"], 0.5)
        self.assertEqual(result["voice_first_audio_p95_ms"], 900)
        self.assertEqual(result["barge_in_success_rate"], 0.5)
        self.assertTrue(result["wer_pass"])
        self.assertFalse(result["latency_pass"])

    def test_asr_only_does_not_claim_voice_metrics_or_phase_slo(self):
        payload = {
            "suite": "asr-only",
            "dataset_license": "CC0-1.0",
            "profile_id": "cpu",
            "hardware_tier": "T1",
            "wer_target": 0.2,
            "records": [
                {
                    "id": "one",
                    "audio_sha256": "a" * 64,
                    "language": "en-US",
                    "reference": "hello",
                    "hypothesis": "hello",
                    "audio_seconds": 1,
                    "asr_seconds": 0.5,
                }
            ],
        }
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "input.json"
            path.write_text(json.dumps(payload))
            result = evaluate(path)
        self.assertIsNone(result["voice_first_audio_p95_ms"])
        self.assertIsNone(result["latency_pass"])
        self.assertIsNone(result["barge_in_success_rate"])
        self.assertFalse(result["phase3_slo_verified"])


if __name__ == "__main__":
    unittest.main()
