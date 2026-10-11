import json
import unittest
from pathlib import Path
import jsonschema


class RealtimeControlTests(unittest.TestCase):
    def test_control_shapes_fail_closed(self):
        path = (
            Path(__file__).resolve().parents[2] / "docs/contracts/realtime-control-v1.schema.json"
        )
        schema = json.loads(path.read_text())
        for value in [
            {"type": "start"},
            {"type": "interrupt"},
            {"type": "config", "sample_rate": 16000},
        ]:
            jsonschema.validate(value, schema)
        for value in [
            {"type": "shell"},
            {"type": "start", "url": "http://external"},
            {"type": "config", "sample_rate": 48000},
        ]:
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.validate(value, schema)
