"""Unit tests for the sanctum config CLI commands."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
cli_path = str(ROOT / "apps" / "cli")
if cli_path not in sys.path:
    sys.path.insert(0, cli_path)

from sanctum import config  # noqa: E402


class ConfigCliTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_dir = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_get_default_setting(self):
        val = config.get_setting("ui.theme", self.config_dir)
        self.assertEqual(val, "dark")

    def test_set_and_get_roundtrip(self):
        config.set_setting("ui.theme", "light", self.config_dir)
        val = config.get_setting("ui.theme", self.config_dir)
        self.assertEqual(val, "light")

    def test_type_validation_error(self):
        with self.assertRaises(ValueError):
            config.set_setting("engine.threads", "not_an_int", self.config_dir)

    def test_env_override_precedence(self):
        with patch.dict(os.environ, {"SANCTUM_CONFIG_UI_THEME": "system"}):
            val = config.get_setting("ui.theme", self.config_dir)
            self.assertEqual(val, "system")

    def test_list_and_scope_filtering(self):
        all_settings = config.list_settings(config_path=self.config_dir)
        self.assertIn("ui.theme", all_settings)
        self.assertIn("engine.gpu_layers", all_settings)

        global_only = config.list_settings(scope="global", config_path=self.config_dir)
        self.assertIn("ui.theme", global_only)
        self.assertNotIn("engine.gpu_layers", global_only)

    def test_export_and_import(self):
        config.set_setting("ui.theme", "light", self.config_dir)
        config.set_setting("engine.threads", "10", self.config_dir)

        export_file = self.config_dir / "exported.json"
        exported = config.export_settings(self.config_dir)
        export_file.write_text(json.dumps(exported), encoding="utf-8")

        new_dir = Path(self.temp_dir.name) / "new_store"
        count = config.import_settings(export_file, new_dir)
        self.assertGreaterEqual(count, 2)
        self.assertEqual(config.get_setting("ui.theme", new_dir), "light")
        self.assertEqual(config.get_setting("engine.threads", new_dir), 10)


if __name__ == "__main__":
    unittest.main()
