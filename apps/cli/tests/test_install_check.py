import unittest
from dataclasses import replace
from sanctum.install_check import CHECKS, Facts, assess, valid_probe


class InstallCheckTests(unittest.TestCase):
    def setUp(self):
        self.facts = Facts(
            "Linux",
            "x86_64",
            "glibc",
            "2.35",
            1000,
            8 * 1024**3,
            4 * 1024**3,
            True,
            False,
            False,
            ["sse2", "avx2"],
        )

    def test_all_required_checks(self):
        self.assertTrue(assess(self.facts, True, 2 * 1024**3)["ready_for_installation"])

    def test_platforms_fail_closed(self):
        for fields in [
            {"os": "Windows"},
            {"arch": "aarch64"},
            {"libc": "musl"},
            {"libc_version": "2.34"},
        ]:
            self.assertFalse(
                assess(replace(self.facts, **fields), True, 1)["ready_for_installation"]
            )

    def test_missing_probe_and_root_refuse(self):
        self.assertFalse(assess(self.facts, False, 1)["ready_for_installation"])
        self.assertFalse(assess(replace(self.facts, uid=0), True, 1)["ready_for_installation"])

    def test_low_disk_and_busy_port(self):
        for fields in [{"free_bytes": 0}, {"port_free": False}]:
            self.assertFalse(
                assess(replace(self.facts, **fields), True, 1)["ready_for_installation"]
            )

    def test_existing_install_is_reported_not_deleted(self):
        result = assess(replace(self.facts, existing_install=True), True, 1)
        self.assertTrue(result["facts"]["existing_install"])
        self.assertEqual(result["model_readiness"], "unverified")

    def test_restricted_apparmor_does_not_bypass_failed_probe(self):
        result = assess(replace(self.facts, apparmor_restricted=True), False, 1)
        self.assertFalse(result["ready_for_installation"])
        self.assertIn("do not disable", " ".join(result["messages"]))

    def test_partial_or_forged_probe_refuses(self):
        self.assertFalse(valid_probe({}, "a" * 32))
        self.assertFalse(valid_probe({"accepted": True, "trace_id": "a" * 32}, "a" * 32))
        self.assertFalse(valid_probe({"accepted": False}, "a" * 32))

    def test_complete_probe_and_wrong_trace(self):
        value = {
            "schema_version": "1.0",
            "accepted": True,
            "trace_id": "a" * 32,
            "worker_checks": dict.fromkeys(CHECKS, "denied"),
            "supervisor_checks": dict.fromkeys(CHECKS, "denied"),
        }
        self.assertTrue(valid_probe(value, "a" * 32))
        self.assertFalse(valid_probe(value, "b" * 32))
        value["worker_checks"]["exec"] = []
        self.assertFalse(valid_probe(value, "a" * 32))
