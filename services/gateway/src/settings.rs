//! Typed settings engine skeleton with schema validation, scope, disk persistence, and env overrides.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    env, fs, io,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SettingScope {
    Global,
    Assistant,
    Thread,
    Model,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingDefinition {
    pub key: String,
    pub setting_type: String,
    pub default_value: Value,
    pub scope: SettingScope,
    pub risk: RiskLevel,
    pub restart_required: bool,
    pub description: String,
}

pub struct SettingsRegistry {
    definitions: HashMap<String, SettingDefinition>,
}

impl SettingsRegistry {
    pub fn new() -> Self {
        let mut defs = HashMap::new();

        let entries = vec![
            SettingDefinition {
                key: "ui.theme".into(),
                setting_type: "enum".into(),
                default_value: json!("dark"),
                scope: SettingScope::Global,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "Interface color theme: dark, light, or system".into(),
            },
            SettingDefinition {
                key: "ui.scale_factor".into(),
                setting_type: "float".into(),
                default_value: json!(1.0),
                scope: SettingScope::Global,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "UI scaling multiplier (1.0 to 2.0)".into(),
            },
            SettingDefinition {
                key: "ui.reduced_motion".into(),
                setting_type: "boolean".into(),
                default_value: json!(false),
                scope: SettingScope::Global,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "Disable micro-interactions and animated transitions".into(),
            },
            SettingDefinition {
                key: "models.default".into(),
                setting_type: "string".into(),
                default_value: json!("qwen2.5-coder-7b"),
                scope: SettingScope::Global,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "Default model used for new conversations".into(),
            },
            SettingDefinition {
                key: "engine.threads".into(),
                setting_type: "integer".into(),
                default_value: json!(6),
                scope: SettingScope::Global,
                risk: RiskLevel::Medium,
                restart_required: true,
                description: "CPU inference thread count".into(),
            },
            SettingDefinition {
                key: "engine.gpu_layers".into(),
                setting_type: "integer".into(),
                default_value: json!(32),
                scope: SettingScope::Model,
                risk: RiskLevel::Medium,
                restart_required: true,
                description: "Number of layers offloaded to GPU (-1 for auto)".into(),
            },
            SettingDefinition {
                key: "engine.context_window".into(),
                setting_type: "integer".into(),
                default_value: json!(8192),
                scope: SettingScope::Thread,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "Max tokens for context window".into(),
            },
            SettingDefinition {
                key: "engine.temperature".into(),
                setting_type: "float".into(),
                default_value: json!(0.7),
                scope: SettingScope::Thread,
                risk: RiskLevel::Low,
                restart_required: false,
                description: "Sampling temperature (0.0 to 2.0)".into(),
            },
            SettingDefinition {
                key: "network.egress_enabled".into(),
                setting_type: "boolean".into(),
                default_value: json!(false),
                scope: SettingScope::Global,
                risk: RiskLevel::High,
                restart_required: false,
                description: "Global network egress kill switch (false = completely offline)"
                    .into(),
            },
            SettingDefinition {
                key: "computer_use.enabled".into(),
                setting_type: "boolean".into(),
                default_value: json!(false),
                scope: SettingScope::Global,
                risk: RiskLevel::High,
                restart_required: false,
                description: "Experimental local-VLM computer use control".into(),
            },
        ];

        for entry in entries {
            defs.insert(entry.key.clone(), entry);
        }

        Self { definitions: defs }
    }

    pub fn get_definition(&self, key: &str) -> Option<&SettingDefinition> {
        self.definitions.get(key)
    }

    pub fn all_definitions(&self) -> Vec<&SettingDefinition> {
        let mut list: Vec<&SettingDefinition> = self.definitions.values().collect();
        list.sort_by(|a, b| a.key.cmp(&b.key));
        list
    }

    pub fn validate_value(&self, key: &str, value: &Value) -> Result<(), String> {
        let def = self
            .definitions
            .get(key)
            .ok_or_else(|| format!("unknown setting key: {key}"))?;
        match def.setting_type.as_str() {
            "boolean" if !value.is_boolean() => {
                return Err(format!("setting '{key}' requires boolean value"));
            }
            "integer" if !value.is_i64() && !value.is_u64() => {
                return Err(format!("setting '{key}' requires integer value"));
            }
            "float" if !value.is_f64() && !value.is_number() => {
                return Err(format!("setting '{key}' requires number value"));
            }
            "string" if !value.is_string() => {
                return Err(format!("setting '{key}' requires string value"));
            }
            "enum" if !value.is_string() => {
                return Err(format!("setting '{key}' requires string enum value"));
            }
            _ => {}
        }
        Ok(())
    }
}

impl Default for SettingsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub struct SettingsEngine {
    registry: SettingsRegistry,
    values: HashMap<String, Value>,
    config_path: PathBuf,
}

impl SettingsEngine {
    pub fn new(data_dir: &Path) -> Self {
        let registry = SettingsRegistry::new();
        let config_path = data_dir.join("config.json");
        let mut engine = Self {
            registry,
            values: HashMap::new(),
            config_path,
        };
        let _ = engine.load_from_disk();
        engine
    }

    pub fn default_data_dir() -> PathBuf {
        #[cfg(windows)]
        {
            if let Ok(appdata) = env::var("APPDATA") {
                return PathBuf::from(appdata).join("Sanctum");
            }
        }
        #[cfg(unix)]
        {
            if let Ok(xdg) = env::var("XDG_DATA_HOME") {
                return PathBuf::from(xdg).join("sanctum");
            }
            if let Ok(home) = env::var("HOME") {
                return PathBuf::from(home).join(".local/share/sanctum");
            }
        }
        PathBuf::from(".sanctum")
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        // 1. Check environment override: SANCTUM_CONFIG_<KEY_UPPER>
        let env_key = format!("SANCTUM_CONFIG_{}", key.replace('.', "_").to_uppercase());
        if let Ok(val) = env::var(&env_key) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&val) {
                return Some(parsed);
            }
            return Some(json!(val));
        }

        // 2. Check explicitly set user values
        if let Some(v) = self.values.get(key) {
            return Some(v.clone());
        }

        // 3. Fallback to schema default
        self.registry
            .get_definition(key)
            .map(|d| d.default_value.clone())
    }

    pub fn set(&mut self, key: &str, value: Value) -> Result<(), String> {
        self.registry.validate_value(key, &value)?;
        self.values.insert(key.to_string(), value);
        let _ = self.save_to_disk();
        Ok(())
    }

    pub fn list(&self, scope_filter: Option<SettingScope>) -> Vec<(SettingDefinition, Value)> {
        let mut out = Vec::new();
        for def in self.registry.all_definitions() {
            if let Some(ref filter) = scope_filter {
                if &def.scope != filter {
                    continue;
                }
            }
            let current = self
                .get(&def.key)
                .unwrap_or_else(|| def.default_value.clone());
            out.push((def.clone(), current));
        }
        out
    }

    pub fn load_from_disk(&mut self) -> io::Result<()> {
        if !self.config_path.exists() {
            return Ok(());
        }
        let text = fs::read_to_string(&self.config_path)?;
        if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&text) {
            for (k, v) in map {
                if self.registry.validate_value(&k, &v).is_ok() {
                    self.values.insert(k, v);
                }
            }
        }
        Ok(())
    }

    pub fn save_to_disk(&self) -> io::Result<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let text = serde_json::to_string_pretty(&self.values)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&self.config_path, text)?;
        Ok(())
    }

    pub fn export_json(&self) -> Value {
        let mut map = serde_json::Map::new();
        for (k, v) in &self.values {
            map.insert(k.clone(), v.clone());
        }
        Value::Object(map)
    }

    pub fn import_json(&mut self, input: &Value) -> Result<usize, String> {
        let obj = input.as_object().ok_or("input must be a JSON object")?;
        let mut count = 0;
        for (k, v) in obj {
            if self.registry.validate_value(k, v).is_ok() {
                self.values.insert(k.clone(), v.clone());
                count += 1;
            }
        }
        let _ = self.save_to_disk();
        Ok(count)
    }
}
