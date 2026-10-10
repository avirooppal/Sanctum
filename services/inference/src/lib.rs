//! Swappable local OpenAI-compatible inference adapter.
pub mod cancellation;
use serde_json::Value;
use std::{io::Read, time::Duration};

pub struct Reply {
    pub status: u16,
    pub content_type: String,
    pub body: Box<dyn Read + Send + Sync>,
}

pub trait Engine {
    fn send(&self, path: &str, payload: &Value) -> Result<Reply, String>;
    fn send_with_context(
        &self,
        path: &str,
        payload: &Value,
        context: &cancellation::Cancellation,
    ) -> Result<Reply, String> {
        context.check().map_err(|e| e.to_string())?;
        self.send(path, payload)
    }
    fn healthy(&self) -> bool;
}

pub struct LocalEngine {
    base: String,
    agent: ureq::Agent,
}

impl LocalEngine {
    pub fn new(base: &str) -> Result<Self, String> {
        let port = base
            .strip_prefix("http://127.0.0.1:")
            .ok_or("engine must use numeric loopback")?;
        if port.parse::<u16>().ok().filter(|p| *p != 0).is_none() {
            return Err("invalid engine port".into());
        }
        let agent = ureq::AgentBuilder::new()
            .try_proxy_from_env(false)
            .timeout_read(Duration::from_secs(180))
            .timeout_write(Duration::from_secs(10))
            .timeout_connect(Duration::from_secs(2))
            .redirects(0)
            .build();
        Ok(Self {
            base: base.into(),
            agent,
        })
    }
}

impl Engine for LocalEngine {
    fn send(&self, path: &str, payload: &Value) -> Result<Reply, String> {
        if !matches!(path, "/v1/chat/completions" | "/v1/embeddings") {
            return Err("unsupported engine path".into());
        }
        let result = self
            .agent
            .post(&format!("{}{path}", self.base))
            .send_json(payload);
        let response = match result {
            Ok(r) | Err(ureq::Error::Status(_, r)) => r,
            Err(error) => return Err(error.to_string()),
        };
        Ok(Reply {
            status: response.status(),
            content_type: response
                .header("Content-Type")
                .unwrap_or("application/json")
                .into(),
            body: response.into_reader(),
        })
    }
    fn healthy(&self) -> bool {
        self.agent
            .get(&format!("{}/health", self.base))
            .call()
            .is_ok()
    }
}
