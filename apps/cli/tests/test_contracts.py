import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, ValidationError
from sanctum.doctor import Hardware, load_profiles, report

ROOT = Path(__file__).resolve().parents[3]


class ContractTests(unittest.TestCase):
    def test_measured_runtime_health(self):
        spec = json.loads((ROOT / "docs/contracts/runtime.openapi.json").read_text())
        evidence = json.loads((ROOT / "evals/results/runtime-linux.json").read_text())
        Draft202012Validator(spec["components"]["schemas"]["Health"]).validate(evidence["health"])

    def test_measured_bootstrap_response(self):
        schema = json.loads((ROOT / "docs/contracts/bootstrap.schema.json").read_text())
        measured = json.loads((ROOT / "evals/results/containment-linux.json").read_text())
        Draft202012Validator(schema).validate(measured)

    def test_shared_envelope_fixtures(self):
        validator = Draft202012Validator(self.schemas["RequestEnvelope"])
        cases = json.loads((ROOT / "docs/contracts/envelope-fixtures.json").read_text())
        for case in cases:
            self.assertEqual(validator.is_valid(case["value"]), case["valid"], case["name"])

    def test_committed_registry(self):
        schema = json.loads((ROOT / "docs/contracts/registry.schema.json").read_text())
        registry = json.loads((ROOT / "profiles/registry.json").read_text())
        Draft202012Validator(schema, format_checker=FormatChecker()).validate(registry)

    def test_legacy_ggml_is_restricted_to_asr_or_vad(self):
        schema = json.loads((ROOT / "docs/contracts/registry.schema.json").read_text())
        registry = json.loads((ROOT / "profiles/registry.json").read_text())
        entry = registry["models"][0]
        entry["format"] = "ggml"
        entry["capabilities"] = ["asr"]
        validator = Draft202012Validator(schema)
        validator.validate(registry)
        entry["capabilities"] = ["vad"]
        validator.validate(registry)
        entry["capabilities"] = ["text", "asr"]
        with self.assertRaises(ValidationError):
            validator.validate(registry)

    def test_attribution_license_requires_provenance(self):
        schema = json.loads((ROOT / "docs/contracts/registry.schema.json").read_text())
        registry = json.loads((ROOT / "profiles/registry.json").read_text())
        entry = registry["models"][0]
        entry.update(license="MIT AND CC-BY-4.0", capabilities=["asr"])
        for key in ("attribution", "upstream_source", "upstream_revision"):
            entry.pop(key, None)
        validator = Draft202012Validator(schema)
        with self.assertRaises(ValidationError):
            validator.validate(registry)
        entry.update(
            attribution="NVIDIA; converted and quantized by ggml-org",
            upstream_source="https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3",
            upstream_revision="pinned",
        )
        validator.validate(registry)
        entry["license"] = "CC-BY-NC-4.0"
        with self.assertRaises(ValidationError):
            validator.validate(registry)

    def setUp(self):
        self.schemas = json.loads((ROOT / "docs/contracts/diagnostics.openapi.json").read_text())[
            "components"
        ]["schemas"]

    def test_doctor_report(self):
        schema = self.schemas["DoctorReport"]
        Draft202012Validator.check_schema(schema)
        value = report(
            Hardware("Linux", "x86_64"), load_profiles(ROOT / "profiles/hardware.json"), "solo"
        )
        Draft202012Validator(schema).validate(value)

    def test_envelope_rejects_missing_identity_and_invalid_traces(self):
        validator = Draft202012Validator(self.schemas["RequestEnvelope"])
        valid = dict(
            user="user-1",
            workspace="workspace-1",
            data_class="restricted",
            trace_id="a" * 32,
            policy_context={"cloud_connectors": []},
        )
        validator.validate(valid)
        for field in valid:
            bad = dict(valid)
            del bad[field]
            with self.assertRaises(ValidationError):
                validator.validate(bad)
        for trace in ["0" * 32, "a" * 31, "Z" * 32]:
            with self.assertRaises(ValidationError):
                validator.validate(dict(valid, trace_id=trace))
        with self.assertRaises(ValidationError):
            validator.validate(dict(valid, policy_context={"cloud_connectors": ["cloud"]}))

    def test_registry_rejects_noncommercial_and_unhashed_weights(self):
        schema = json.loads((ROOT / "docs/contracts/registry.schema.json").read_text())
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        value = dict(
            schema_version="1.0",
            dependencies=[],
            models=[
                dict(
                    id="fixture-only",
                    license="Apache-2.0",
                    license_url="https://example.invalid/license",
                    verified_at="2026-10-08",
                    sha256="a" * 64,
                    format="gguf",
                    capabilities=["text"],
                    source="file:///fixture",
                    revision="test-only",
                )
            ],
        )
        validator.validate(value)
        for field, invalid in [
            ("license", "CC-BY-NC-4.0"),
            ("sha256", ""),
            ("verified_at", "yesterday"),
        ]:
            bad = copy.deepcopy(value)
            bad["models"][0][field] = invalid
            with self.assertRaises(ValidationError):
                validator.validate(bad)
