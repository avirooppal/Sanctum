use serde::Deserialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub python: PathBuf,
    pub profile: PathBuf,
    pub model_id: String,
}

impl Config {
    pub fn call(
        &self,
        content_type: String,
        body: Vec<u8>,
        trace: String,
    ) -> Result<Value, String> {
        if body.len() > 8 * 1024 * 1024 || content_type.len() > 256 {
            return Err("speech request exceeds limit".into());
        }
        let mut child = Command::new(std::env::current_exe().map_err(|e| e.to_string())?)
            .arg("--engine-child")
            .arg(&self.python)
            .arg("services/speech/worker.py")
            .arg(&self.profile)
            .arg(&self.model_id)
            .arg(content_type)
            .arg(trace)
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        // These streams are guaranteed by Stdio::piped above.
        let mut input = child.stdin.take().expect("piped stdin");
        let output = child.stdout.take().expect("piped stdout");
        let writer = std::thread::spawn(move || input.write_all(&body));
        let reader = std::thread::spawn(move || {
            let mut data = Vec::new();
            output.take(1024 * 1024 + 1).read_to_end(&mut data)?;
            Ok::<_, std::io::Error>(data)
        });
        let deadline = Instant::now() + Duration::from_secs(160);
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(10));
                }
                _ => {
                    let _ = child.kill();
                    let _ = child.wait();
                    break Err("speech worker deadline or process failure");
                }
            }
        };
        let written = writer.join().map_err(|_| "speech input failed")?;
        let data = reader
            .join()
            .map_err(|_| "speech output failed")?
            .map_err(|_| "speech output failed")?;
        if !status?.success() || written.is_err() || data.len() > 1024 * 1024 {
            return Err("speech worker failed".into());
        }
        serde_json::from_slice(&data).map_err(|_| "invalid speech response".into())
    }
}

pub fn is_text_response(kind: &str) -> bool {
    matches!(
        kind,
        "text/plain" | "text/vtt" | "text/plain; charset=utf-8" | "text/vtt; charset=utf-8"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_the_documented_text_response_types() {
        assert!(is_text_response("text/plain; charset=utf-8"));
        assert!(is_text_response("text/vtt; charset=utf-8"));
        assert!(!is_text_response("text/html"));
        assert!(!is_text_response("text/plain\r\nX-Evil: true"));
    }

    #[test]
    fn speech_config_rejects_unknown_options() {
        let value = serde_json::json!({"python":"/python", "profile":"/profile", "model_id":"asr", "cloud":true});
        assert!(serde_json::from_value::<Config>(value).is_err());
    }

    #[test]
    fn speech_config_requires_all_local_fields() {
        assert!(serde_json::from_value::<Config>(serde_json::json!({"profile":"x"})).is_err());
        let config: Config = serde_json::from_value(
            serde_json::json!({"python":"/python", "profile":"/profile", "model_id":"asr"}),
        )
        .unwrap();
        assert_eq!(config.model_id, "asr");
    }
}
