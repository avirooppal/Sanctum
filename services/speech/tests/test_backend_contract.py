import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]


class SpeechProfileContractTests(unittest.TestCase):
    def test_profile_requires_local_model_path_and_egress_denial(self):
        schema = json.loads((ROOT / "docs/contracts/speech-profile.schema.json").read_text())
        valid = {
            "schema_version": "1.0",
            "id": "test-cpu",
            "asr": {
                "engine": "whisper.cpp",
                "model_path": "./.sanctum/models/asr",
                "model_sha256": "a" * 64,
                "executable_path": "./.sanctum/engines/whisper-cli.exe",
                "executable_sha256": "b" * 64,
                "threads": 4,
            },
            "vad": {"engine": "none"},
            "egress": "denied",
        }
        validator = Draft202012Validator(schema)
        self.assertTrue(validator.is_valid(valid))
        for legacy_vad in ({"engine": "none"}, {"engine": "silero", "model_path": "/old-model"}):
            self.assertTrue(validator.is_valid({**valid, "vad": legacy_vad}))
        self.assertFalse(validator.is_valid({**valid, "vad": {"engine": "silero.cpp"}}))
        pinned_vad = {
            "engine": "silero.cpp",
            "model_id": "vad",
            "model_path": "/model",
            "model_sha256": "a" * 64,
            "executable_path": "/vad",
            "executable_sha256": "b" * 64,
            "threads": 1,
            "timeout_seconds": 20,
        }
        self.assertTrue(validator.is_valid({**valid, "vad": pinned_vad}))
        for key, value in (
            ("egress", "allowed"),
            ("asr", {**valid["asr"], "model_path": "Systran/model"}),
        ):
            invalid = {**valid, key: value}
            self.assertFalse(validator.is_valid(invalid))


if __name__ == "__main__":
    unittest.main()
