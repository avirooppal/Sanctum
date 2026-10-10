//! Per-request HTTP helpers keep resident models while making legacy HTTP cancellable.
use sanctum_gateway::{cancellable_io::ContextIo, supervision::OwnedChild};
use sanctum_inference::{cancellation::Cancellation, Engine, LocalEngine, Reply};
use serde::Deserialize;
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

pub struct SupervisedEngine {
    base: String,
    legacy: LocalEngine,
    admission_root: PathBuf,
    admission_key: String,
}
impl SupervisedEngine {
    pub fn new(base: &str, state: &Path, port: u16) -> Result<Self, String> {
        Ok(Self {
            base: base.into(),
            admission_root: state.join("engine-admission"),
            admission_key: format!("port-{port}"),
            legacy: LocalEngine::new(base)?,
        })
    }
}
struct Body {
    reader: BufReader<ContextIo<std::process::ChildStdout>>,
    _child: OwnedChild,
    _lease: std::fs::File,
    _execution: std::fs::File,
    context: Cancellation,
}
impl Read for Body {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let count = self.reader.read(buffer)?;
        if count == 0 && !buffer.is_empty() {
            let until = std::time::Instant::now() + std::time::Duration::from_millis(250);
            loop {
                self.context.check().map_err(|error| {
                    std::io::Error::new(std::io::ErrorKind::ConnectionAborted, error)
                })?;
                if let Some(status) = self._child.try_wait()? {
                    if !status.success() {
                        return Err(std::io::Error::other("inference helper failed"));
                    }
                    break;
                }
                if std::time::Instant::now() >= until {
                    return Err(std::io::Error::other(
                        "inference helper did not acknowledge completion",
                    ));
                }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        }
        Ok(count)
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Metadata {
    status: u16,
    content_type: String,
}
impl Engine for SupervisedEngine {
    fn send(&self, path: &str, payload: &Value) -> Result<Reply, String> {
        self.legacy.send(path, payload)
    }
    fn healthy(&self) -> bool {
        self.legacy.healthy()
    }
    fn send_with_context(
        &self,
        path: &str,
        payload: &Value,
        context: &Cancellation,
    ) -> Result<Reply, String> {
        let run = || -> Result<Reply, Box<dyn std::error::Error + Send + Sync>> {
            context.check()?;
            let lease = sanctum_gateway::engine_admission::acquire(
                &self.admission_root,
                &self.admission_key,
                2,
                false,
            )?;
            if !matches!(path, "/v1/chat/completions" | "/v1/embeddings") {
                return Err("unsupported engine path".into());
            }
            let payload = serde_json::to_vec(payload)?;
            if payload.len() > 1024 * 1024 {
                return Err("inference request exceeds limit".into());
            }
            let execution = sanctum_gateway::engine_admission::wait_execution(
                &self.admission_root,
                &self.admission_key,
                context,
            )?;
            let executable = std::env::current_exe()?;
            let mut child = OwnedChild(
                Command::new(&executable)
                    .arg("--engine-child")
                    .arg(&executable)
                    .arg("--inference-request")
                    .arg(&self.base)
                    .arg(path)
                    .env_clear()
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null())
                    .spawn()?,
            );
            let mut input = ContextIo::new(
                child.stdin.take().ok_or("missing request input")?,
                context.clone(),
            )?;
            input.write_all(&payload)?;
            drop(input);
            let mut reader = BufReader::new(ContextIo::new(
                child.stdout.take().ok_or("missing response output")?,
                context.clone(),
            )?);
            let mut metadata = Vec::new();
            reader
                .by_ref()
                .take(4097)
                .read_until(b'\n', &mut metadata)?;
            if metadata.len() > 4096 {
                return Err("oversized response metadata".into());
            }
            let metadata: Metadata = serde_json::from_slice(&metadata)?;
            if !(100..=599).contains(&metadata.status) {
                return Err("invalid response status".into());
            }
            Ok(Reply {
                status: metadata.status,
                content_type: metadata.content_type,
                body: Box::new(Body {
                    reader,
                    _child: child,
                    _lease: lease,
                    _execution: execution,
                    context: context.clone(),
                }),
            })
        };
        run().map_err(|error| error.to_string())
    }
}
