use base64::Engine;
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
    pub tts: Option<TtsConfig>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TtsConfig {
    pub profile: PathBuf,
    pub model_id: String,
}

impl Config {
    pub fn call(
        &self,
        content_type: String,
        body: Vec<u8>,
        trace: String,
        synthesize: bool,
    ) -> Result<Value, String> {
        let limit = if synthesize { 65536 } else { 8 * 1024 * 1024 };
        if body.len() > limit || content_type.len() > 256 {
            return Err("speech request exceeds limit".into());
        }
        let (profile, model_id) = if synthesize {
            let tts = self.tts.as_ref().ok_or("TTS is not configured")?;
            (&tts.profile, &tts.model_id)
        } else {
            (&self.profile, &self.model_id)
        };
        let mut child = Command::new(std::env::current_exe().map_err(|e| e.to_string())?)
            .arg("--engine-child")
            .arg(&self.python)
            .arg("services/speech/worker.py")
            .arg(profile)
            .arg(model_id)
            .arg(content_type)
            .arg(trace)
            .arg(if synthesize {
                "synthesize"
            } else {
                "transcribe"
            })
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
            output.take(2 * 1024 * 1024 + 1).read_to_end(&mut data)?;
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
        if !status?.success() || written.is_err() || data.len() > 2 * 1024 * 1024 {
            return Err("speech worker failed".into());
        }
        serde_json::from_slice(&data).map_err(|_| "invalid speech response".into())
    }
}

pub fn decode_audio(value: &Value) -> Result<Vec<u8>, String> {
    if !matches!(
        value["content_type"].as_str(),
        Some("audio/wav" | "audio/pcm")
    ) {
        return Err("invalid audio type".into());
    }
    let encoded = value["audio_base64"].as_str().ok_or("missing audio")?;
    if encoded.len() > 1398104 {
        return Err("audio exceeds limit".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| "invalid audio encoding")?;
    if bytes.is_empty() || bytes.len() > 1024 * 1024 {
        return Err("invalid audio size".into());
    }
    Ok(bytes)
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
        assert!(config.tts.is_none());
    }

    #[test]
    fn audio_response_rejects_untrusted_types_and_invalid_encoding() {
        assert_eq!(
            decode_audio(&serde_json::json!({"content_type":"audio/pcm", "audio_base64":"AQI="}))
                .unwrap(),
            vec![1, 2]
        );
        assert!(decode_audio(
            &serde_json::json!({"content_type":"text/html", "audio_base64":"AQI="})
        )
        .is_err());
        assert!(decode_audio(
            &serde_json::json!({"content_type":"audio/wav", "audio_base64":"!!"})
        )
        .is_err());
        assert!(
            decode_audio(&serde_json::json!({"content_type":"audio/wav", "audio_base64":""}))
                .is_err()
        );
    }
}
