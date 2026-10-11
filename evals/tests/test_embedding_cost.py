import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from embedding_cost import rates, validated_vectors


class EmbeddingCostTests(unittest.TestCase):
    def test_full_ingestion_rates(self):
        self.assertEqual(rates(3, 12, 6), {"documents_per_minute": 30, "chunks_per_second": 2})
        with self.assertRaises(ValueError):
            rates(3, 12, 0)

    def test_historical_batch_order_and_validation(self):
        rows = [{"index": 1, "embedding": [2.0]}, {"index": 0, "embedding": [1.0]}]
        self.assertEqual(validated_vectors({"data": rows}, 2), [[1.0], [2.0]])
        with self.assertRaises(ValueError):
            validated_vectors({"data": rows}, 3)
        with self.assertRaises(ValueError):
            validated_vectors({"data": [{"index": 0, "embedding": [float("nan")]}]}, 1)
