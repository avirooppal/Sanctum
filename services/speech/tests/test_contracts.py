"""Contract tests run before any speech runtime implementation."""

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, RefResolver, ValidationError

ROOT = Path(__file__).resolve().parents[3]


class SpeechContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.openapi = json.loads((ROOT / "docs/contracts/speech.openapi.json").read_text())
        cls.stream = json.loads((ROOT / "docs/contracts/speech-stream.schema.json").read_text())
        cls.evaluation = json.loads((ROOT / "docs/contracts/speech-eval.schema.json").read_text())
        cls.benchmark = json.loads(
            (ROOT / "docs/contracts/speech-benchmark.schema.json").read_text()
        )

    def test_openai_audio_routes_are_local_and_authenticated(self):
        self.assertIn("localBearer", self.openapi["components"]["securitySchemes"])
        self.assertEqual(self.openapi["security"], [{"localBearer": []}])
        self.assertEqual(
            set(self.openapi["paths"]), {"/v1/audio/transcriptions", "/v1/audio/speech"}
        )
        for path in self.openapi["paths"].values():
            operation = path["post"]
            self.assertEqual(operation["x-egress"], "denied")
            self.assertIn("503", operation["responses"])
        transcription_response = self.openapi["paths"]["/v1/audio/transcriptions"]["post"][
            "responses"
        ]["200"]["content"]
        self.assertTrue(
            {"application/json", "text/plain", "text/vtt"}.issubset(transcription_response)
        )

    def test_transcription_requires_private_request_context(self):
        schema = self.openapi["components"]["schemas"]["TranscriptionRequest"]
        valid = {
            "file": "local-audio-bytes",
            "context": {
                "workspace_id": "workspace-1",
                "data_class": "sensitive",
                "trace_id": "a" * 32,
                "policy_context": {"cloud_enabled": False},
            },
        }
        resolver = RefResolver.from_schema(self.openapi)
        Draft202012Validator(schema, resolver=resolver).validate(valid)
        for invalid in (
            {"file": "audio"},
            {**valid, "unexpected": "value"},
            {
                **valid,
                "context": {**valid["context"], "policy_context": {"cloud_enabled": True}},
            },
        ):
            with self.assertRaises(ValidationError):
                Draft202012Validator(schema, resolver=resolver).validate(invalid)

    def test_speech_request_rejects_unknown_and_out_of_range_values(self):
        schema = self.openapi["components"]["schemas"]["SpeechRequest"]
        resolver = RefResolver.from_schema(self.openapi)
        valid = {
            "model": "profile-selected-local-tts",
            "input": "Hello, local world.",
            "voice": "licensed-local-voice",
            "context": {
                "workspace_id": "workspace-1",
                "data_class": "internal",
                "trace_id": "b" * 32,
                "policy_context": {"cloud_enabled": False},
            },
        }
        Draft202012Validator(schema, resolver=resolver).validate(valid)
        with self.assertRaises(ValidationError):
            Draft202012Validator(schema, resolver=resolver).validate({**valid, "speed": 3})
        with self.assertRaises(ValidationError):
            Draft202012Validator(schema, resolver=resolver).validate({**valid, "fallback": "cloud"})

    def test_realtime_event_schema_accepts_bounded_audio_and_rejects_unknown_events(self):
        Draft202012Validator.check_schema(self.stream)
        self.assertIn("aggregate byte limit", self.stream["description"])
        valid = {
            "type": "input_audio_buffer.append",
            "audio": "AQID",
            "sample_rate": 16000,
            "channels": 1,
        }
        Draft202012Validator(self.stream).validate(valid)
        for invalid in (
            {**valid, "sample_rate": 1000},
            {**valid, "extra": "ignored fields are forbidden"},
            {"type": "cloud_fallback", "audio": "AQID", "sample_rate": 16000},
        ):
            with self.assertRaises(ValidationError):
                Draft202012Validator(self.stream).validate(invalid)

    def test_speech_evaluation_requires_audio_hash_license_and_hardware_tier(self):
        Draft202012Validator.check_schema(self.evaluation)
        record = {
            "id": "sample-1",
            "audio_sha256": "c" * 64,
            "language": "en-US",
            "reference": "hello",
            "hypothesis": "hello",
            "audio_seconds": 1,
            "asr_seconds": 0.4,
        }
        payload = {
            "suite": "speech-fixture-v1",
            "dataset_license": "CC0-1.0",
            "profile_id": "cpu-test",
            "hardware_tier": "T0",
            "records": [record],
        }
        Draft202012Validator(self.evaluation).validate(payload)
        Draft202012Validator(self.evaluation).validate(
            {
                **payload,
                "voice_turns": [
                    {
                        "id": "turn-1",
                        "audio_sha256": "d" * 64,
                        "first_audio_ms": 500,
                        "barge_in_success": True,
                    }
                ],
            }
        )
        for invalid in (
            {**payload, "records": [{**record, "audio_sha256": "unknown"}]},
            {**payload, "hardware_tier": "unknown"},
            {**payload, "untracked": True},
        ):
            with self.assertRaises(ValidationError):
                Draft202012Validator(self.evaluation).validate(invalid)

    def test_local_benchmark_manifest_contract(self):
        Draft202012Validator.check_schema(self.benchmark)
        valid = {
            "suite": "local",
            "dataset_license": "CC-BY-4.0",
            "profile_id": "cpu",
            "hardware_tier": "T0",
            "wer_target": 0.1,
            "records": [
                {
                    "id": "one",
                    "audio_path": "audio/one.wav",
                    "audio_sha256": "e" * 64,
                    "language": "en-US",
                    "reference": "hello",
                }
            ],
        }
        Draft202012Validator(self.benchmark).validate(valid)
        with self.assertRaises(ValidationError):
            Draft202012Validator(self.benchmark).validate(
                {**valid, "records": [{**valid["records"][0], "extra": "forbidden"}]}
            )


if __name__ == "__main__":
    unittest.main()
