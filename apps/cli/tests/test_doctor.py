import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from sanctum.doctor import Hardware, GPU, collect, load_profiles, recommend, report

ROOT = Path(__file__).resolve().parents[3]


class DoctorTests(unittest.TestCase):
    def setUp(self):
        self.profiles = load_profiles(ROOT / "profiles/hardware.json")

    def hw(self, ram=16, **kwargs):
        return Hardware(os="Linux", arch="x86_64", ram_bytes=ram * 1024**3, **kwargs)

    def test_tier_boundaries(self):
        for ram, expected in [(7, None), (8, "T0"), (15, "T0"), (16, "T1"), (128, "T1")]:
            result = recommend(self.hw(ram), self.profiles, "solo")
            self.assertEqual(result["tier"] if result else None, expected)

    def test_unknown_ram_has_no_recommendation(self):
        self.assertIsNone(recommend(Hardware("Linux", "x86_64"), self.profiles, "solo"))

    def test_team_requires_known_nvidia_vram(self):
        hw = self.hw(64, gpus=[GPU("NVIDIA", "nvidia", 48 * 1024**3)])
        self.assertEqual(recommend(hw, self.profiles, "team")["engine"], "vllm")
        self.assertEqual(recommend(hw, self.profiles, "solo")["engine"], "llama.cpp")
        hw.gpus[0].vram_bytes = None
        self.assertEqual(recommend(hw, self.profiles, "team")["tier"], "T1")

    def test_does_not_sum_non_sharded_gpus(self):
        hw = self.hw(64, gpus=[GPU("one", "nvidia", 24 * 1024**3)] * 2)
        self.assertEqual(recommend(hw, self.profiles, "team")["tier"], "T2")

    def test_apple_profile(self):
        hw = Hardware("Darwin", "arm64", ram_bytes=64 * 1024**3)
        self.assertEqual(recommend(hw, self.profiles, "solo")["id"], "t2-apple")

    def test_profiles_are_data(self):
        custom = [dict(self.profiles[-1], id="custom", engine="replacement")]
        self.assertEqual(recommend(self.hw(), custom, "solo")["engine"], "replacement")

    def test_probe_failure_is_unknown(self):
        with (
            patch("sanctum.doctor.platform.system", return_value="Windows"),
            patch("sanctum.doctor.run", return_value=None),
        ):
            hw = collect()
        self.assertIsNone(hw.ram_bytes)
        self.assertEqual(hw.gpus, [])

    def test_privacy_never_inferred_from_config(self):
        result = report(self.hw(), self.profiles, "solo")
        self.assertFalse(result["privacy"]["service_start_allowed"])
        self.assertEqual(result["privacy"]["egress_enforcement"], "unverified")

    def test_json_cli(self):
        proc = subprocess.run(
            [sys.executable, "-m", "sanctum", "doctor", "--json"],
            capture_output=True,
            text=True,
            cwd=ROOT,
            timeout=30,
        )
        self.assertIn(proc.returncode, (0, 2))
        self.assertEqual(json.loads(proc.stdout)["schema_version"], "1.0")

    def test_missing_config_is_error(self):
        proc = subprocess.run(
            [sys.executable, "-m", "sanctum", "doctor", "--profiles", "absent"],
            capture_output=True,
            text=True,
            cwd=ROOT,
            timeout=30,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertNotIn("Traceback", proc.stderr)
