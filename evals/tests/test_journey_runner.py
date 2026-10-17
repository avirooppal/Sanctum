import importlib.util
import io
import unittest
from pathlib import Path
from unittest.mock import Mock

MODULE = Path(__file__).resolve().parents[1] / "journey_runner.py"
SPEC = importlib.util.spec_from_file_location("journey_runner", MODULE)
assert SPEC and SPEC.loader
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class JourneyReadinessTests(unittest.TestCase):
    def test_redirect_is_refused(self):
        with self.assertRaises(ValueError):
            runner.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.org")

    def test_health_cannot_turn_unknown_checks_into_privacy_proof(self):
        context = runner.Context.__new__(runner.Context)
        context.get = Mock(
            return_value={"status": "ok", "cloud_connectors": "disabled", "checks": {}}
        )
        with self.assertRaises(ValueError):
            context.health()

    def test_local_readiness_rejects_cloud_model(self):
        context = runner.Context.__new__(runner.Context)
        context.get = Mock(return_value={"data": [{"id": "remote", "owned_by": "cloud"}]})
        with self.assertRaises(ValueError):
            context.models()

    def test_response_is_bounded_without_content_in_diagnostics(self):
        context = runner.Context.__new__(runner.Context)
        context.base, context.token, context.requests = (
            "http://127.0.0.1:8769",
            "unit-test-local",
            [],
        )
        context.opener = Mock()
        context.opener.open.return_value = io.BytesIO(b"x" * (1024 * 1024 + 2))
        with self.assertRaisesRegex(ValueError, "exceeds1MiB"):
            context.get("/healthz")
        self.assertEqual(context.requests, [])
