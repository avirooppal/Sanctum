import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from chat_cache_cost import content_delta, cached_tokens, is_model_worker


class ChatCacheCostTests(unittest.TestCase):
    def test_guardian_alias_does_not_count_as_model_worker(self):
        argv = [b"engine", b"--alias", b"chat-tiny-q8"]
        self.assertFalse(is_model_worker("sanctum-runtime", argv, "chat-tiny-q8"))
        self.assertTrue(is_model_worker("llama-server", argv, "chat-tiny-q8"))

    def test_role_event_is_not_first_token(self):
        self.assertEqual(content_delta({"choices": [{"delta": {"role": "assistant"}}]}), "")
        self.assertEqual(content_delta({"choices": [{"delta": {"content": "OK"}}]}), "OK")

    def test_cache_evidence_requires_integer_counter(self):
        self.assertEqual(cached_tokens({"timings": {"cache_n": 12}}), 12)
        with self.assertRaises(ValueError):
            cached_tokens({"tokens_cached": 12})
        with self.assertRaises(ValueError):
            cached_tokens({})
        with self.assertRaises(ValueError):
            cached_tokens({"timings": {"cache_n": True}})
