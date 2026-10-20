"""Sanctum CLI configuration command handler for typed settings."""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

# Standard schema definitions matching ADR0093
SETTINGS_SCHEMA: Dict[str, Dict[str, Any]] = {
    "ui.theme": {
        "type": "enum",
        "default": "dark",
        "scope": "global",
        "risk": "low",
        "description": "Interface color theme: dark, light, or system",
    },
    "ui.scale_factor": {
        "type": "float",
        "default": 1.0,
        "scope": "global",
        "risk": "low",
        "description": "UI scaling multiplier (1.0 to 2.0)",
    },
    "ui.reduced_motion": {
        "type": "boolean",
        "default": False,
        "scope": "global",
        "risk": "low",
        "description": "Disable micro-interactions and animated transitions",
    },
    "models.default": {
        "type": "string",
        "default": "qwen2.5-coder-7b",
        "scope": "global",
        "risk": "low",
        "description": "Default model used for new conversations",
    },
    "engine.threads": {
        "type": "integer",
        "default": 6,
        "scope": "global",
        "risk": "medium",
        "description": "CPU inference thread count",
    },
    "engine.gpu_layers": {
        "type": "integer",
        "default": 32,
        "scope": "model",
        "risk": "medium",
        "description": "Number of layers offloaded to GPU (-1 for auto)",
    },
    "engine.context_window": {
        "type": "integer",
        "default": 8192,
        "scope": "thread",
        "risk": "low",
        "description": "Max tokens for context window",
    },
    "engine.temperature": {
        "type": "float",
        "default": 0.7,
        "scope": "thread",
        "risk": "low",
        "description": "Sampling temperature (0.0 to 2.0)",
    },
    "network.egress_enabled": {
        "type": "boolean",
        "default": False,
        "scope": "global",
        "risk": "high",
        "description": "Global network egress kill switch (false = completely offline)",
    },
    "computer_use.enabled": {
        "type": "boolean",
        "default": False,
        "scope": "global",
        "risk": "high",
        "description": "Experimental local-VLM computer use control",
    },
}


def get_config_path(custom_dir: Optional[Path] = None) -> Path:
    if custom_dir:
        return custom_dir / "config.json"
    if os.name == "nt":
        appdata = os.environ.get("APPDATA")
        if appdata:
            return Path(appdata) / "Sanctum" / "config.json"
    else:
        xdg = os.environ.get("XDG_DATA_HOME")
        if xdg:
            return Path(xdg) / "sanctum" / "config.json"
        return Path.home() / ".local" / "share" / "sanctum" / "config.json"
    return Path(".sanctum") / "config.json"


def load_config(config_path: Path) -> Dict[str, Any]:
    if config_path.exists():
        try:
            return json.loads(config_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_config(config_path: Path, data: Dict[str, Any]) -> None:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_setting(key: str, config_path: Optional[Path] = None) -> Any:
    # 1. Environment override: SANCTUM_CONFIG_<KEY_UPPER>
    env_var = "SANCTUM_CONFIG_" + key.replace(".", "_").upper()
    if env_var in os.environ:
        val = os.environ[env_var]
        try:
            return json.loads(val)
        except Exception:
            return val

    # 2. Disk config
    path = get_config_path(config_path)
    data = load_config(path)
    if key in data:
        return data[key]

    # 3. Default from schema
    if key in SETTINGS_SCHEMA:
        return SETTINGS_SCHEMA[key]["default"]

    raise KeyError(f"Unknown setting: {key}")


def set_setting(key: str, raw_value: str, config_path: Optional[Path] = None) -> None:
    if key not in SETTINGS_SCHEMA:
        raise KeyError(f"Unknown setting key: {key}")

    schema = SETTINGS_SCHEMA[key]
    val_type = schema["type"]

    # Parse value according to type
    parsed: Any = raw_value
    if val_type == "boolean":
        low = raw_value.strip().lower()
        if low in ("true", "1", "yes"):
            parsed = True
        elif low in ("false", "0", "no"):
            parsed = False
        else:
            raise ValueError(f"Setting '{key}' requires a boolean (true/false)")
    elif val_type == "integer":
        try:
            parsed = int(raw_value)
        except ValueError:
            raise ValueError(f"Setting '{key}' requires an integer")
    elif val_type == "float":
        try:
            parsed = float(raw_value)
        except ValueError:
            raise ValueError(f"Setting '{key}' requires a number")

    path = get_config_path(config_path)
    data = load_config(path)
    data[key] = parsed
    save_config(path, data)


def list_settings(
    scope: Optional[str] = None, config_path: Optional[Path] = None
) -> Dict[str, Any]:
    result = {}
    for key, meta in sorted(SETTINGS_SCHEMA.items()):
        if scope and meta.get("scope") != scope:
            continue
        # Check env or stored or default
        val = get_setting(key, config_path)
        result[key] = {
            "value": val,
            "default": meta["default"],
            "type": meta["type"],
            "scope": meta["scope"],
            "risk": meta["risk"],
            "description": meta["description"],
        }
    return result


def export_settings(config_path: Optional[Path] = None) -> Dict[str, Any]:
    path = get_config_path(config_path)
    return load_config(path)


def import_settings(import_path: Path, config_path: Optional[Path] = None) -> int:
    if not import_path.exists():
        raise FileNotFoundError(f"File not found: {import_path}")
    imported_data = json.loads(import_path.read_text(encoding="utf-8"))
    if not isinstance(imported_data, dict):
        raise ValueError("Import file must contain a JSON object")

    path = get_config_path(config_path)
    data = load_config(path)
    applied = 0
    for k, v in imported_data.items():
        if k in SETTINGS_SCHEMA:
            data[k] = v
            applied += 1
    save_config(path, data)
    return applied
