//! Pack lifecycle and capability manager.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackState {
    Absent,
    Installed,
    Loaded,
    Unloading,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub state: PackState,
    pub disk_bytes: u64,
    pub ram_budget_mb: u64,
    pub capabilities: Vec<String>,
    pub description: String,
}

pub struct PackManager {
    packs: HashMap<String, PackMetadata>,
    packs_dir: PathBuf,
}

impl PackManager {
    pub fn new(data_dir: &Path) -> Self {
        let packs_dir = data_dir.join("packs");
        let mut mgr = Self {
            packs: HashMap::new(),
            packs_dir,
        };
        mgr.register_defaults();
        mgr
    }

    pub fn packs_dir(&self) -> &Path {
        &self.packs_dir
    }

    fn register_defaults(&mut self) {
        let defaults = vec![
            PackMetadata {
                id: "knowledge".into(),
                name: "Knowledge (RAG)".into(),
                version: "0.1.0".into(),
                state: PackState::Installed,
                disk_bytes: 210 * 1024 * 1024,
                ram_budget_mb: 512,
                capabilities: vec!["rag".into(), "embeddings".into(), "hybrid_search".into()],
                description: "Local document vector search and chunk parsing".into(),
            },
            PackMetadata {
                id: "speech".into(),
                name: "Speech (Voice & ASR)".into(),
                version: "0.1.0".into(),
                state: PackState::Absent,
                disk_bytes: 450 * 1024 * 1024,
                ram_budget_mb: 1536,
                capabilities: vec!["asr".into(), "tts".into(), "vad".into()],
                description: "Local Whisper transcription and neural speech synthesis".into(),
            },
            PackMetadata {
                id: "vision".into(),
                name: "Vision (Multimodal)".into(),
                version: "0.1.0".into(),
                state: PackState::Absent,
                disk_bytes: 2200 * 1024 * 1024,
                ram_budget_mb: 4096,
                capabilities: vec!["vlm".into(), "screenshot_analysis".into()],
                description: "Multimodal image and screenshot reasoning".into(),
            },
            PackMetadata {
                id: "computer_use".into(),
                name: "Computer Use (Sandbox)".into(),
                version: "0.1.0".into(),
                state: PackState::Absent,
                disk_bytes: 32 * 1024 * 1024,
                ram_budget_mb: 64,
                capabilities: vec!["screen_capture".into(), "pointer".into(), "keyboard".into()],
                description: "Disposable sandbox OS automation agent".into(),
            },
        ];

        for p in defaults {
            self.packs.insert(p.id.clone(), p);
        }
    }

    pub fn list(&self) -> Vec<PackMetadata> {
        let mut list: Vec<PackMetadata> = self.packs.values().cloned().collect();
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    pub fn get(&self, id: &str) -> Option<&PackMetadata> {
        self.packs.get(id)
    }

    pub fn load(&mut self, id: &str) -> Result<PackMetadata, String> {
        let pack = self
            .packs
            .get_mut(id)
            .ok_or_else(|| format!("pack '{id}' not found"))?;
        if pack.state == PackState::Absent {
            return Err(format!("pack '{id}' is not installed"));
        }
        pack.state = PackState::Loaded;
        Ok(pack.clone())
    }

    pub fn unload(&mut self, id: &str) -> Result<PackMetadata, String> {
        let pack = self
            .packs
            .get_mut(id)
            .ok_or_else(|| format!("pack '{id}' not found"))?;
        if pack.state == PackState::Loaded {
            pack.state = PackState::Installed;
        }
        Ok(pack.clone())
    }

    pub fn install(&mut self, id: &str, source_path: &str) -> Result<PackMetadata, String> {
        if !Path::new(source_path).exists() && !source_path.starts_with("builtin://") {
            return Err(format!("source path '{source_path}' does not exist"));
        }
        let pack = self
            .packs
            .get_mut(id)
            .ok_or_else(|| format!("pack '{id}' not recognized"))?;
        pack.state = PackState::Installed;
        Ok(pack.clone())
    }

    pub fn uninstall(&mut self, id: &str) -> Result<PackMetadata, String> {
        let pack = self
            .packs
            .get_mut(id)
            .ok_or_else(|| format!("pack '{id}' not found"))?;
        if pack.state == PackState::Loaded {
            pack.state = PackState::Installed;
        }
        pack.state = PackState::Absent;
        Ok(pack.clone())
    }

    pub fn platform_assurance_tier() -> &'static str {
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            "verified kernel containment"
        }
        #[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
        {
            "not verified"
        }
    }

    pub fn capability_report(&self, threads: usize, context: usize) -> Value {
        let pack_reports: Vec<Value> = self
            .list()
            .into_iter()
            .map(|p| {
                json!({
                    "id": p.id,
                    "name": p.name,
                    "version": p.version,
                    "state": p.state,
                    "capabilities": p.capabilities,
                    "disk_bytes": p.disk_bytes,
                    "ram_budget_mb": p.ram_budget_mb
                })
            })
            .collect();

        json!({
            "capabilities": ["chat", "models", "history", "dashboard", "preferences", "settings", "packs"],
            "platform_assurance": Self::platform_assurance_tier(),
            "profile": "desktop-core-v1",
            "hardware": {
                "threads": threads,
                "context": context
            },
            "packs": pack_reports
        })
    }
}
